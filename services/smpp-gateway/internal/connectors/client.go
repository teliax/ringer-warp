package connectors

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/linxGnu/gosmpp"
	"github.com/linxGnu/gosmpp/data"
	"github.com/linxGnu/gosmpp/pdu"
	"github.com/ringer-warp/smpp-gateway/internal/config"
	"github.com/ringer-warp/smpp-gateway/internal/models"
	log "github.com/sirupsen/logrus"
)

// SMPPClient represents an SMPP client connection to a vendor (e.g., Sinch)
type SMPPClient struct {
	vendor  *models.Vendor
	config  *config.Config
	session *gosmpp.Session
	connected atomic.Bool
	mu      sync.RWMutex

	// Metrics (atomic for thread-safety)
	messagesSent    atomic.Int64
	messagesSuccess atomic.Int64
	messagesFailed  atomic.Int64
	dlrsReceived    atomic.Int64

	connectedAt time.Time
	lastError   string
	dlrHandler  DLRHandler
}

// DLRHandler interface for handling delivery receipts
type DLRHandler interface {
	HandleDLR(ctx context.Context, dlr *models.DeliveryReceipt) error
}

// NewSMPPClient creates a new SMPP client for a vendor
func NewSMPPClient(vendor *models.Vendor, cfg *config.Config) (*SMPPClient, error) {
	client := &SMPPClient{
		vendor: vendor,
		config: cfg,
	}
	client.connected.Store(false)

	return client, nil
}

// SetDLRHandler sets the DLR handler
func (c *SMPPClient) SetDLRHandler(handler DLRHandler) {
	c.dlrHandler = handler
}

// maskPassword masks a password for logging (shows first 2 and last 2 chars)
func maskPassword(password string) string {
	if password == "" {
		return "<empty>"
	}
	if len(password) <= 4 {
		return "***"
	}
	return password[:2] + "****" + password[len(password)-2:]
}

// Connect establishes SMPP connection to vendor with automatic retry
func (c *SMPPClient) Connect(ctx context.Context) error {
	if c.connected.Load() {
		return nil
	}

	logger := log.WithFields(log.Fields{
		"vendor": c.vendor.InstanceName,
		"host":   c.vendor.Host,
		"port":   c.vendor.Port,
	})

	logger.Info("Connecting to vendor SMPP server...")

	// Create authentication - all fields from DB
	auth := gosmpp.Auth{
		SMSC:       fmt.Sprintf("%s:%d", c.vendor.Host, c.vendor.Port),
		SystemID:   c.vendor.Username,  // From DB (can be empty for IP-based)
		Password:   c.vendor.Password,  // From DB (can be empty for IP-based)
		SystemType: c.vendor.SystemType, // From DB (e.g. "cp" for Sinch, "smpp" default)
	}

	// Log exact bind parameters being sent (before TLS encryption)
	logger.WithFields(log.Fields{
		"smsc":         auth.SMSC,
		"system_id":    auth.SystemID,
		"password":     maskPassword(auth.Password),
		"system_type":  auth.SystemType,
		"bind_type":    "TRX (transceiver)",
		"tls_enabled":  c.vendor.UseTLS,
		"smpp_version": "3.4",
	}).Info("SMPP Bind Request Parameters")

	// Create connector (TRX mode for transceiver)
	// Use TLS if vendor requires it
	var dialer gosmpp.Dialer
	if c.vendor.UseTLS {
		// Custom TLS dialer with proper config and detailed logging
		dialer = func(addr string) (net.Conn, error) {
			logger.WithField("address", addr).Debug("Initiating TLS connection...")
			conn, err := tls.Dial("tcp", addr, &tls.Config{
				ServerName:         c.vendor.Host,
				MinVersion:         tls.VersionTLS12,
				InsecureSkipVerify: false, // Verify certificates
			})
			if err != nil {
				logger.WithError(err).Error("TLS dial failed")
				return nil, err
			}
			logger.Info("TLS handshake successful, connection established")

			// Log TLS connection details
			state := conn.ConnectionState()
			logger.WithFields(log.Fields{
				"tls_version":   state.Version,
				"cipher_suite":  state.CipherSuite,
				"server_name":   state.ServerName,
				"negotiated_proto": state.NegotiatedProtocol,
			}).Debug("TLS connection state")

			return conn, nil
		}
	} else {
		dialer = gosmpp.NonTLSDialer
	}
	connector := gosmpp.TRXConnector(dialer, auth)

	// Configure session settings
	settings := gosmpp.Settings{
		ReadTimeout:  60 * time.Second,  // Must be > EnquireLink
		WriteTimeout: 10 * time.Second,
		EnquireLink:  30 * time.Second,
		OnPDU:        c.handlePDU, // Correct signature: func(pdu.PDU, bool)
		OnSubmitError: func(p pdu.PDU, err error) {
			c.messagesFailed.Add(1)
			logger.WithError(err).Error("Submit error from vendor")
		},
		OnReceivingError: func(err error) {
			logger.WithError(err).Warn("Receiving error from vendor")
		},
		OnRebindingError: func(err error) {
			c.connected.Store(false)
			c.mu.Lock()
			c.lastError = err.Error()
			c.mu.Unlock()
			logger.WithError(err).Error("Rebinding error - will retry")
		},
		OnClosed: func(state gosmpp.State) {
			c.connected.Store(false)
			logger.Warn("Connection closed by vendor - will retry")
		},
	}

	// Create session with auto-rebind every 5 seconds
	logger.Info("Attempting SMPP bind (TRX mode)...")
	session, err := gosmpp.NewSession(connector, settings, 5*time.Second)
	if err != nil {
		c.mu.Lock()
		c.lastError = err.Error()
		c.mu.Unlock()
		logger.WithFields(log.Fields{
			"error":        err.Error(),
			"error_type":   fmt.Sprintf("%T", err),
			"bind_type":    "TRX",
			"system_id":    auth.SystemID,
			"system_type":  auth.SystemType,
		}).Error("SMPP bind failed")
		return fmt.Errorf("failed to create session: %w", err)
	}

	logger.Info("SMPP bind successful!")

	c.mu.Lock()
	c.session = session
	c.connected.Store(true)
	c.connectedAt = time.Now()
	c.lastError = ""
	c.mu.Unlock()

	logger.WithField("system_id", c.vendor.InstanceName).Info("Successfully bound to vendor")
	return nil
}

// Send sends a message through this vendor
func (c *SMPPClient) Send(ctx context.Context, msg *models.Message) (string, error) {
	if !c.connected.Load() {
		return "", fmt.Errorf("not connected to vendor %s", c.vendor.InstanceName)
	}

	c.messagesSent.Add(1)

	logger := log.WithFields(log.Fields{
		"vendor":  c.vendor.InstanceName,
		"msg_id":  msg.ID,
		"source":  msg.SourceAddr,
		"dest":    msg.DestAddr,
		"content": fmt.Sprintf("%.20s...", msg.Content),
	})

	// Build submit_sm PDU (cast to concrete type)
	submitSM := pdu.NewSubmitSM().(*pdu.SubmitSM)

	// Set source address
	submitSM.SourceAddr = pdu.NewAddress()
	submitSM.SourceAddr.SetAddress(msg.SourceAddr)
	submitSM.SourceAddr.SetTon(1) // International
	submitSM.SourceAddr.SetNpi(1) // ISDN/E.164

	// Set destination address
	submitSM.DestAddr = pdu.NewAddress()
	submitSM.DestAddr.SetAddress(msg.DestAddr)
	submitSM.DestAddr.SetTon(1) // International
	submitSM.DestAddr.SetNpi(1) // ISDN/E.164

	// Set message content with encoding
	if msg.Encoding == "ucs2" {
		submitSM.Message.SetMessageWithEncoding(msg.Content, data.UCS2)
	} else {
		submitSM.Message.SetMessageWithEncoding(msg.Content, data.GSM7BIT)
	}

	// Request DLR
	submitSM.RegisteredDelivery = 1

	// Submit to vendor (returns error only in v0.3.1)
	err := c.session.Transceiver().Submit(submitSM)
	if err != nil {
		c.messagesFailed.Add(1)
		c.mu.Lock()
		c.lastError = err.Error()
		c.mu.Unlock()

		logger.WithError(err).Error("Failed to submit message to vendor")
		return "", fmt.Errorf("submit failed: %w", err)
	}

	c.messagesSuccess.Add(1)

	// Generate vendor message ID (we don't get it back from Submit in this API version)
	vendorMsgID := fmt.Sprintf("%s-%d", c.vendor.InstanceName, time.Now().UnixNano())

	logger.WithField("vendor_msg_id", vendorMsgID).Info("Message submitted to vendor")
	return vendorMsgID, nil
}

// handlePDU handles incoming PDUs from vendor (primarily DLRs)
// Signature for v0.3.1: func(pdu.PDU, bool)
func (c *SMPPClient) handlePDU(p pdu.PDU, responded bool) {
	// Skip if already responded to
	if responded {
		return
	}

	logger := log.WithFields(log.Fields{
		"vendor":     c.vendor.InstanceName,
		"command_id": p.GetHeader().CommandID,
	})

	switch p.GetHeader().CommandID {
	case data.DELIVER_SM:
		// Handle delivery receipt (DLR)
		c.dlrsReceived.Add(1)
		if deliverSM, ok := p.(*pdu.DeliverSM); ok {
			c.handleDeliverSM(deliverSM)
		}

	case data.SUBMIT_SM_RESP:
		// Response to our submit_sm
		logger.Debug("Submit response received")

	case data.ENQUIRE_LINK:
		// Handled automatically by gosmpp
		logger.Debug("Enquire link received")

	default:
		logger.WithField("command_id", p.GetHeader().CommandID).Debug("Unhandled PDU received")
	}
}

// handleDeliverSM processes delivery receipts from vendor
func (c *SMPPClient) handleDeliverSM(deliverSM *pdu.DeliverSM) {
	logger := log.WithFields(log.Fields{
		"vendor": c.vendor.InstanceName,
		"source": deliverSM.SourceAddr.Address(),
		"dest":   deliverSM.DestAddr.Address(),
	})

	// Check if this is a DLR (ESM class bit 2 set)
	if deliverSM.EsmClass&0x04 != 0 {
		// This is a delivery receipt
		dlr := c.parseDLR(deliverSM)

		logger.WithFields(log.Fields{
			"msg_id": dlr.MessageID,
			"status": dlr.Status,
		}).Info("DLR received from vendor")

		// Pass to DLR handler if configured
		if c.dlrHandler != nil {
			ctx := context.Background()
			if err := c.dlrHandler.HandleDLR(ctx, dlr); err != nil {
				logger.WithError(err).Error("Failed to process DLR")
			}
		}
	} else {
		// Mobile-originated message (MO)
		logger.Info("MO message received (not yet implemented)")
		// TODO: Handle MO messages in future
	}
}

// parseDLR extracts delivery receipt information from deliver_sm
func (c *SMPPClient) parseDLR(deliverSM *pdu.DeliverSM) *models.DeliveryReceipt {
	// Parse DLR text format (vendor-specific, Sinch uses standard format)
	// Example: "id:1234567890 sub:001 dlvrd:001 submit date:2510091200 done date:2510091205 stat:DELIVRD err:000"

	// Get message text
	msgText, err := deliverSM.Message.GetMessage()
	if err != nil {
		msgText = ""
	}

	dlr := &models.DeliveryReceipt{
		ReceivedAt: time.Now(),
		Text:       msgText,
	}

	// TODO: Parse DLR text to extract fields
	// For now, use basic extraction
	dlr.MessageID = deliverSM.SourceAddr.Address()
	dlr.Status = "DELIVRD"

	return dlr
}

// GetHealth returns current health status
func (c *SMPPClient) GetHealth() *models.ConnectorHealth {
	c.mu.RLock()
	lastError := c.lastError
	c.mu.RUnlock()

	status := "disconnected"
	if c.connected.Load() {
		status = "connected"
	}

	return &models.ConnectorHealth{
		VendorID:        c.vendor.ID,
		VendorName:      c.vendor.InstanceName,
		Status:          status,
		ConnectedAt:     c.connectedAt,
		LastError:       lastError,
		MessagesSent:    c.messagesSent.Load(),
		MessagesSuccess: c.messagesSuccess.Load(),
		MessagesFailed:  c.messagesFailed.Load(),
		DLRsReceived:    c.dlrsReceived.Load(),
	}
}

// Disconnect closes the SMPP connection gracefully
func (c *SMPPClient) Disconnect(ctx context.Context) error {
	if !c.connected.Load() {
		return nil
	}

	logger := log.WithField("vendor", c.vendor.InstanceName)
	logger.Info("Disconnecting from vendor...")

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.session != nil {
		// Close session gracefully
		c.session.Close()
	}

	c.connected.Store(false)
	logger.Info("Disconnected from vendor")

	return nil
}

// IsConnected returns connection status
func (c *SMPPClient) IsConnected() bool {
	return c.connected.Load()
}

// GetVendor returns the vendor configuration
func (c *SMPPClient) GetVendor() *models.Vendor {
	return c.vendor
}
