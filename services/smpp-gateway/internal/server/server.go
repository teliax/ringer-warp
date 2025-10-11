package server

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/linxGnu/gosmpp/data"
	"github.com/linxGnu/gosmpp/pdu"
	"github.com/ringer-warp/smpp-gateway/internal/config"
	"github.com/ringer-warp/smpp-gateway/internal/connectors"
	"github.com/ringer-warp/smpp-gateway/internal/dlr"
	"github.com/ringer-warp/smpp-gateway/internal/models"
	"github.com/ringer-warp/smpp-gateway/internal/ratelimit"
	"github.com/ringer-warp/smpp-gateway/internal/routing"
	log "github.com/sirupsen/logrus"
)

// SMPPServer handles inbound SMPP connections from customers
type SMPPServer struct {
	config       *config.Config
	connectorMgr *connectors.Manager
	router       *routing.Router
	dlrTracker   *dlr.Tracker
	rateLimiter  *ratelimit.Limiter
	listener     net.Listener
	tlsListener  net.Listener
	sessions     map[string]*Session
	sessionsMu   sync.RWMutex
	shutdownChan chan struct{}
	wg           sync.WaitGroup

	// Metrics
	activeSessionsCount atomic.Int64
	totalBinds          atomic.Int64
	totalSubmitSM       atomic.Int64
	totalDeliverSM      atomic.Int64
}

// Session represents an active customer SMPP session
type Session struct {
	SystemID     string
	Password     string
	CustomerID   string
	BindType     string // "transceiver", "transmitter", "receiver"
	Conn         net.Conn
	RemoteAddr   string
	BoundAt      time.Time
	LastActivity time.Time
	SequenceNum  uint32
	mu           sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
	dlrQueue     chan *models.DeliveryReceipt
}

// NewSMPPServer creates a new SMPP server
func NewSMPPServer(cfg *config.Config, connMgr *connectors.Manager) (*SMPPServer, error) {
	return &SMPPServer{
		config:       cfg,
		connectorMgr: connMgr,
		sessions:     make(map[string]*Session),
		shutdownChan: make(chan struct{}),
	}, nil
}

// SetRouter sets the message router
func (s *SMPPServer) SetRouter(router *routing.Router) {
	s.router = router
}

// SetDLRTracker sets the DLR tracker
func (s *SMPPServer) SetDLRTracker(tracker *dlr.Tracker) {
	s.dlrTracker = tracker
}

// SetRateLimiter sets the rate limiter
func (s *SMPPServer) SetRateLimiter(limiter *ratelimit.Limiter) {
	s.rateLimiter = limiter
}

// Start starts the SMPP server
func (s *SMPPServer) Start(ctx context.Context) error {
	// Start plain SMPP listener
	addr := fmt.Sprintf("%s:%d", s.config.SMPPHost, s.config.SMPPPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}
	s.listener = listener

	log.WithField("addr", addr).Info("SMPP server listening")

	// Start accept loop in goroutine
	s.wg.Add(1)
	go s.acceptLoop(ctx)

	return nil
}

// acceptLoop accepts and handles incoming SMPP connections
func (s *SMPPServer) acceptLoop(ctx context.Context) {
	defer s.wg.Done()

	for {
		select {
		case <-ctx.Done():
			log.Info("Accept loop shutting down...")
			return
		case <-s.shutdownChan:
			return
		default:
			// Set accept deadline to allow periodic checking of context
			s.listener.(*net.TCPListener).SetDeadline(time.Now().Add(1 * time.Second))

			conn, err := s.listener.Accept()
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue // Deadline exceeded, check context again
				}
				log.WithError(err).Error("Failed to accept connection")
				continue
			}

			// Handle connection in goroutine
			s.wg.Add(1)
			go s.handleConnection(ctx, conn)
		}
	}
}

// handleConnection handles a single SMPP connection
func (s *SMPPServer) handleConnection(ctx context.Context, conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	remoteAddr := conn.RemoteAddr().String()
	logger := log.WithField("remote_addr", remoteAddr)
	logger.Info("New SMPP connection")

	// Create session context
	sessionCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	var session *Session

	// Read and process PDUs
	for {
		select {
		case <-sessionCtx.Done():
			logger.Info("Session context cancelled")
			return
		default:
			// Set read deadline
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))

			// Read PDU
			p, err := s.readPDU(conn)
			if err != nil {
				if err == io.EOF {
					logger.Info("Connection closed by client")
				} else {
					logger.WithError(err).Warn("Error reading PDU")
				}
				if session != nil {
					s.removeSession(session.SystemID)
				}
				return
			}

			// Handle PDU based on command ID (types may not be exported in v0.3.1)
			switch p.GetHeader().CommandID {
			case data.BIND_TRANSCEIVER:
				session = s.handleBindTransceiver(sessionCtx, conn, p, remoteAddr)
			case data.BIND_TRANSMITTER:
				session = s.handleBindTransmitter(sessionCtx, conn, p, remoteAddr)
			case data.BIND_RECEIVER:
				session = s.handleBindReceiver(sessionCtx, conn, p, remoteAddr)
			case data.UNBIND:
				s.handleUnbind(conn, p, session)
				return
			case data.SUBMIT_SM:
				s.handleSubmitSM(sessionCtx, conn, p, session)
			case data.QUERY_SM:
				s.handleQuerySM(conn, p, session)
			case data.ENQUIRE_LINK:
				s.handleEnquireLink(conn, p)
			default:
				logger.WithField("command_id", p.GetHeader().CommandID).Warn("Unhandled PDU")
			}
		}
	}
}

// readPDU reads a single PDU from the connection
func (s *SMPPServer) readPDU(conn net.Conn) (pdu.PDU, error) {
	// Read PDU header (16 bytes)
	header := make([]byte, 16)
	if _, err := io.ReadFull(conn, header); err != nil {
		return nil, err
	}

	// Parse command length
	commandLength := binary.BigEndian.Uint32(header[0:4])
	if commandLength < 16 || commandLength > 65536 {
		return nil, fmt.Errorf("invalid PDU length: %d", commandLength)
	}

	// Read remaining PDU body
	body := make([]byte, commandLength-16)
	if commandLength > 16 {
		if _, err := io.ReadFull(conn, body); err != nil {
			return nil, err
		}
	}

	// Combine header and body
	fullPDU := append(header, body...)

	// Parse PDU (v0.3.1 API: Parse takes io.Reader)
	p, err := pdu.Parse(bytes.NewReader(fullPDU))
	if err != nil {
		return nil, fmt.Errorf("failed to parse PDU: %w", err)
	}

	return p, nil
}

// writePDU writes a PDU to the connection
func (s *SMPPServer) writePDU(conn net.Conn, p pdu.PDU) error {
	// v0.3.1 API: Marshal takes *ByteBuffer
	buf := pdu.NewBuffer(nil)
	p.Marshal(buf)

	if _, err := conn.Write(buf.Bytes()); err != nil {
		return fmt.Errorf("failed to write PDU: %w", err)
	}

	return nil
}

// handleBindTransceiver handles bind_transceiver requests
func (s *SMPPServer) handleBindTransceiver(ctx context.Context, conn net.Conn, p pdu.PDU, remoteAddr string) *Session {
	// Cast to BindRequest (all bind types use same struct)
	bindReq := p.(*pdu.BindRequest)
	systemID := bindReq.SystemID
	password := bindReq.Password

	logger := log.WithFields(log.Fields{
		"system_id":   systemID,
		"remote_addr": remoteAddr,
	})
	logger.Info("Bind transceiver request")

	s.totalBinds.Add(1)

	// Authenticate (placeholder - accept all for now)
	if !s.authenticate(systemID, password) {
		logger.Warn("Authentication failed")
		resp := pdu.NewBindTransceiverResp().(*pdu.BindResp)
		resp.CommandStatus = data.ESME_RINVPASWD
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return nil
	}

	// Create session
	sessionCtx, cancel := context.WithCancel(ctx)
	session := &Session{
		SystemID:     systemID,
		Password:     password,
		CustomerID:   systemID, // For now, system_id == customer_id
		BindType:     "transceiver",
		Conn:         conn,
		RemoteAddr:   remoteAddr,
		BoundAt:      time.Now(),
		LastActivity: time.Now(),
		ctx:          sessionCtx,
		cancel:       cancel,
		dlrQueue:     make(chan *models.DeliveryReceipt, 100),
	}

	s.addSession(systemID, session)
	s.activeSessionsCount.Add(1)

	// Send bind response
	resp := pdu.NewBindTransceiverResp().(*pdu.BindResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	if err := s.writePDU(conn, resp); err != nil {
		logger.WithError(err).Error("Failed to send bind response")
		return nil
	}

	logger.Info("Bind transceiver successful")

	// Start DLR delivery goroutine
	s.wg.Add(1)
	go s.deliverDLRs(session)

	return session
}

// handleBindTransmitter handles bind_transmitter requests
func (s *SMPPServer) handleBindTransmitter(ctx context.Context, conn net.Conn, p pdu.PDU, remoteAddr string) *Session {
	bindReq := p.(*pdu.BindRequest)
	systemID := bindReq.SystemID
	logger := log.WithFields(log.Fields{
		"system_id":   systemID,
		"remote_addr": remoteAddr,
	})
	logger.Info("Bind transmitter request")

	s.totalBinds.Add(1)

	if !s.authenticate(systemID, bindReq.Password) {
		logger.Warn("Authentication failed")
		resp := pdu.NewBindTransmitterResp().(*pdu.BindResp)
		resp.CommandStatus = data.ESME_RINVPASWD
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return nil
	}

	sessionCtx, cancel := context.WithCancel(ctx)
	session := &Session{
		SystemID:     systemID,
		CustomerID:   systemID,
		BindType:     "transmitter",
		Conn:         conn,
		RemoteAddr:   remoteAddr,
		BoundAt:      time.Now(),
		LastActivity: time.Now(),
		ctx:          sessionCtx,
		cancel:       cancel,
	}

	s.addSession(systemID, session)
	s.activeSessionsCount.Add(1)

	resp := pdu.NewBindTransmitterResp().(*pdu.BindResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	if err := s.writePDU(conn, resp); err != nil {
		logger.WithError(err).Error("Failed to send bind response")
		return nil
	}

	logger.Info("Bind transmitter successful")
	return session
}

// handleBindReceiver handles bind_receiver requests
func (s *SMPPServer) handleBindReceiver(ctx context.Context, conn net.Conn, p pdu.PDU, remoteAddr string) *Session {
	bindReq := p.(*pdu.BindRequest)
	systemID := bindReq.SystemID
	logger := log.WithFields(log.Fields{
		"system_id":   systemID,
		"remote_addr": remoteAddr,
	})
	logger.Info("Bind receiver request")

	s.totalBinds.Add(1)

	if !s.authenticate(systemID, bindReq.Password) {
		logger.Warn("Authentication failed")
		resp := pdu.NewBindReceiverResp().(*pdu.BindResp)
		resp.CommandStatus = data.ESME_RINVPASWD
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return nil
	}

	sessionCtx, cancel := context.WithCancel(ctx)
	session := &Session{
		SystemID:     systemID,
		CustomerID:   systemID,
		BindType:     "receiver",
		Conn:         conn,
		RemoteAddr:   remoteAddr,
		BoundAt:      time.Now(),
		LastActivity: time.Now(),
		ctx:          sessionCtx,
		cancel:       cancel,
		dlrQueue:     make(chan *models.DeliveryReceipt, 100),
	}

	s.addSession(systemID, session)
	s.activeSessionsCount.Add(1)

	resp := pdu.NewBindReceiverResp().(*pdu.BindResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	if err := s.writePDU(conn, resp); err != nil {
		logger.WithError(err).Error("Failed to send bind response")
		return nil
	}

	logger.Info("Bind receiver successful")

	// Start DLR delivery goroutine
	s.wg.Add(1)
	go s.deliverDLRs(session)

	return session
}

// handleSubmitSM handles submit_sm PDUs from customers
func (s *SMPPServer) handleSubmitSM(ctx context.Context, conn net.Conn, p pdu.PDU, session *Session) {
	submitReq := p.(*pdu.SubmitSM)

	if session == nil {
		log.Warn("Received submit_sm without active session")
		return
	}

	if session.BindType == "receiver" {
		log.WithField("system_id", session.SystemID).Warn("Receiver session cannot transmit")
		// Send error response
		resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
		resp.CommandStatus = data.ESME_RINVBNDSTS
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return
	}

	session.UpdateActivity()
	s.totalSubmitSM.Add(1)

	logger := log.WithFields(log.Fields{
		"system_id":  session.SystemID,
		"source":     submitReq.SourceAddr.Address(),
		"dest":       submitReq.DestAddr.Address(),
		"registered": submitReq.RegisteredDelivery,
		"seq_num":    p.GetHeader().SequenceNumber,
	})

	logger.Info("Submit SM received")

	// Check rate limit
	if s.rateLimiter != nil {
		allowed, _, err := s.rateLimiter.CheckCustomerLimit(ctx, session.CustomerID, 100) // 100 msgs/min default
		if err != nil {
			logger.WithError(err).Error("Rate limit check failed")
		} else if !allowed {
			logger.Warn("Rate limit exceeded")
			resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
			resp.CommandStatus = data.ESME_RTHROTTLED
			resp.SequenceNumber = p.GetHeader().SequenceNumber
			s.writePDU(conn, resp)
			return
		}
	}

	// Generate message ID
	msgID := uuid.New().String()

	// Create message model
	msgContent, _ := submitReq.Message.GetMessage()
	msg := &models.Message{
		ID:         msgID,
		SourceAddr: submitReq.SourceAddr.Address(),
		DestAddr:   submitReq.DestAddr.Address(),
		Content:    msgContent,
		Encoding:   "gsm7", // TODO: Determine from DataCoding
		CustomerID: session.CustomerID,
		Status:     "pending",
		Segments:   1, // TODO: Calculate actual segments
		SubmittedAt: time.Now(),
	}

	// Route message to vendor
	if s.router == nil {
		logger.Error("Router not configured")
		resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
		resp.CommandStatus = data.ESME_RSYSERR
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return
	}

	vendor, err := s.router.RouteMessage(ctx, msg)
	if err != nil {
		logger.WithError(err).Error("Failed to route message")
		resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
		resp.CommandStatus = data.ESME_RSUBMITFAIL
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return
	}

	// Check vendor rate limit
	if s.rateLimiter != nil {
		allowed, _, err := s.rateLimiter.CheckVendorLimit(ctx, msg.VendorID, vendor.GetVendor().Throughput)
		if err != nil {
			logger.WithError(err).Error("Vendor rate limit check failed")
		} else if !allowed {
			logger.WithField("vendor_id", msg.VendorID).Warn("Vendor rate limit exceeded")
			resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
			resp.CommandStatus = data.ESME_RTHROTTLED
			resp.SequenceNumber = p.GetHeader().SequenceNumber
			s.writePDU(conn, resp)
			return
		}
	}

	// Store message for DLR tracking
	if s.dlrTracker != nil && submitReq.RegisteredDelivery > 0 {
		if err := s.dlrTracker.StoreMessage(ctx, msg); err != nil {
			logger.WithError(err).Error("Failed to store message for DLR tracking")
		}
	}

	// Send to vendor
	vendorMsgID, err := vendor.Send(ctx, msg)
	if err != nil {
		logger.WithError(err).WithField("vendor_id", msg.VendorID).Error("Failed to send to vendor")
		resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
		resp.CommandStatus = data.ESME_RSUBMITFAIL
		resp.SequenceNumber = p.GetHeader().SequenceNumber
		s.writePDU(conn, resp)
		return
	}

	// Send successful response to customer
	resp := pdu.NewSubmitSMResp().(*pdu.SubmitSMResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	resp.MessageID = vendorMsgID
	if err := s.writePDU(conn, resp); err != nil {
		logger.WithError(err).Error("Failed to send submit_sm_resp")
		return
	}

	logger.WithFields(log.Fields{
		"msg_id":        msgID,
		"vendor_msg_id": vendorMsgID,
		"vendor_id":     msg.VendorID,
	}).Info("Message submitted successfully")
}

// handleUnbind handles unbind requests
func (s *SMPPServer) handleUnbind(conn net.Conn, p pdu.PDU, session *Session) {
	if session != nil {
		log.WithField("system_id", session.SystemID).Info("Unbind request")
		s.removeSession(session.SystemID)
		session.cancel()
	}

	// Send unbind response
	resp := pdu.NewUnbindResp().(*pdu.UnbindResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	s.writePDU(conn, resp)
}

// handleQuerySM handles query_sm requests
func (s *SMPPServer) handleQuerySM(conn net.Conn, p pdu.PDU, session *Session) {
	if session == nil {
		return
	}

	queryReq := p.(*pdu.QuerySM)
	logger := log.WithFields(log.Fields{
		"system_id": session.SystemID,
		"msg_id":    queryReq.MessageID,
	})
	logger.Debug("Query SM received")

	// TODO: Look up message status from DLR tracker
	// For now, return default response
	resp := pdu.NewQuerySMResp().(*pdu.QuerySMResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	s.writePDU(conn, resp)
}

// handleEnquireLink handles enquire_link requests
func (s *SMPPServer) handleEnquireLink(conn net.Conn, p pdu.PDU) {
	log.Debug("Enquire link received")

	// Send enquire_link_resp
	resp := pdu.NewEnquireLinkResp().(*pdu.EnquireLinkResp)
	resp.CommandStatus = data.ESME_ROK
	resp.SequenceNumber = p.GetHeader().SequenceNumber
	s.writePDU(conn, resp)
}

// deliverDLRs delivers DLRs to customer session
func (s *SMPPServer) deliverDLRs(session *Session) {
	defer s.wg.Done()

	logger := log.WithField("system_id", session.SystemID)
	logger.Info("Starting DLR delivery goroutine")

	for {
		select {
		case <-session.ctx.Done():
			logger.Info("DLR delivery goroutine stopping")
			return
		case dlrMsg := <-session.dlrQueue:
			s.totalDeliverSM.Add(1)
			if err := s.sendDLRToCustomer(session, dlrMsg); err != nil {
				logger.WithError(err).Error("Failed to deliver DLR")
			}
		}
	}
}

// sendDLRToCustomer sends a DLR to customer as deliver_sm
func (s *SMPPServer) sendDLRToCustomer(session *Session, dlrMsg *models.DeliveryReceipt) error {
	logger := log.WithFields(log.Fields{
		"system_id":  session.SystemID,
		"message_id": dlrMsg.MessageID,
		"status":     dlrMsg.Status,
	})

	// Build deliver_sm PDU
	deliverSM := pdu.NewDeliverSM().(*pdu.DeliverSM)

	// Set source address (use message ID as source for DLR)
	deliverSM.SourceAddr = pdu.NewAddress()
	deliverSM.SourceAddr.SetAddress(dlrMsg.MessageID)

	// Set destination address
	deliverSM.DestAddr = pdu.NewAddress()

	// Set ESM class for DLR
	deliverSM.EsmClass = 0x04 // SMSC Delivery Receipt

	// Format DLR text (SMPP standard format)
	dlrText := fmt.Sprintf("id:%s sub:001 dlvrd:001 submit date:%s done date:%s stat:%s err:%s",
		dlrMsg.MessageID,
		dlrMsg.SubmitDate.Format("0601021504"),
		dlrMsg.DoneDate.Format("0601021504"),
		dlrMsg.Status,
		dlrMsg.ErrorCode,
	)

	// Set message content
	deliverSM.Message.SetMessageWithEncoding(dlrText, data.GSM7BIT)

	// Set sequence number
	session.mu.Lock()
	session.SequenceNum++
	deliverSM.SequenceNumber = int32(session.SequenceNum)
	session.mu.Unlock()

	// Send to customer
	if err := s.writePDU(session.Conn, deliverSM); err != nil {
		return fmt.Errorf("failed to send deliver_sm: %w", err)
	}

	logger.Info("DLR delivered to customer")
	return nil
}

// authenticate authenticates a customer (placeholder)
func (s *SMPPServer) authenticate(systemID, password string) bool {
	// TODO: Implement real authentication against PostgreSQL
	log.WithField("system_id", systemID).Debug("Authenticating (placeholder - accepting all)")
	return true
}

// addSession adds a session to the map
func (s *SMPPServer) addSession(systemID string, session *Session) {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()
	s.sessions[systemID] = session
}

// removeSession removes a session from the map
func (s *SMPPServer) removeSession(systemID string) {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()

	if session, exists := s.sessions[systemID]; exists {
		session.cancel()
		delete(s.sessions, systemID)
		s.activeSessionsCount.Add(-1)
		log.WithField("system_id", systemID).Info("Session removed")
	}
}

// QueueDLRForCustomer queues a DLR for delivery to customer
func (s *SMPPServer) QueueDLRForCustomer(customerID string, dlr *models.DeliveryReceipt) error {
	s.sessionsMu.RLock()
	defer s.sessionsMu.RUnlock()

	// Find session that can receive (transceiver or receiver)
	for _, session := range s.sessions {
		if session.CustomerID == customerID && (session.BindType == "transceiver" || session.BindType == "receiver") {
			select {
			case session.dlrQueue <- dlr:
				return nil
			default:
				return fmt.Errorf("DLR queue full for customer %s", customerID)
			}
		}
	}

	return fmt.Errorf("no receiver-capable session for customer %s", customerID)
}

// Shutdown gracefully shuts down the server
func (s *SMPPServer) Shutdown(ctx context.Context) error {
	log.Info("Shutting down SMPP server...")

	// Stop accepting new connections
	close(s.shutdownChan)

	// Close listeners
	if s.listener != nil {
		s.listener.Close()
	}
	if s.tlsListener != nil {
		s.tlsListener.Close()
	}

	// Close all sessions
	s.sessionsMu.Lock()
	for systemID, session := range s.sessions {
		log.WithField("system_id", systemID).Info("Closing session")
		session.cancel()
		if session.Conn != nil {
			session.Conn.Close()
		}
	}
	s.sessions = make(map[string]*Session)
	s.sessionsMu.Unlock()

	// Wait for all goroutines
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Info("All sessions closed")
	case <-time.After(30 * time.Second):
		log.Warn("Timeout waiting for sessions to close")
	}

	log.Info("SMPP server shutdown complete")
	return nil
}

// UpdateActivity updates session activity timestamp
func (sess *Session) UpdateActivity() {
	sess.mu.Lock()
	defer sess.mu.Unlock()
	sess.LastActivity = time.Now()
}

// GetMetrics returns server metrics
func (s *SMPPServer) GetMetrics() map[string]int64 {
	return map[string]int64{
		"active_sessions": s.activeSessionsCount.Load(),
		"total_binds":     s.totalBinds.Load(),
		"total_submit_sm": s.totalSubmitSM.Load(),
		"total_deliver_sm": s.totalDeliverSM.Load(),
	}
}
