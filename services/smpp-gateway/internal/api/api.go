package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/ringer-warp/smpp-gateway/internal/connectors"
	"github.com/ringer-warp/smpp-gateway/internal/dlr"
	"github.com/ringer-warp/smpp-gateway/internal/server"
	log "github.com/sirupsen/logrus"
)

// Server provides HTTP management API
type Server struct {
	port         int
	httpServer   *http.Server
	smppServer   *server.SMPPServer
	connectorMgr *connectors.Manager
	dlrTracker   *dlr.Tracker
}

// NewServer creates a new management API server
func NewServer(port int, smppSrv *server.SMPPServer, connMgr *connectors.Manager, dlrTrk *dlr.Tracker) *Server {
	return &Server{
		port:         port,
		smppServer:   smppSrv,
		connectorMgr: connMgr,
		dlrTracker:   dlrTrk,
	}
}

// Start starts the management API server
func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/ready", s.handleReady)

	// Metrics (Prometheus)
	mux.Handle("/metrics", promhttp.Handler())

	// Vendor management
	mux.HandleFunc("/api/v1/vendors", s.handleListVendors)
	mux.HandleFunc("/api/v1/vendors/status", s.handleVendorStatus)
	mux.HandleFunc("/api/v1/vendors/reconnect/", s.handleVendorReconnect)     // POST /api/v1/vendors/reconnect/{id}
	mux.HandleFunc("/api/v1/vendors/disconnect/", s.handleVendorDisconnect)   // POST /api/v1/vendors/disconnect/{id}
	mux.HandleFunc("/api/v1/vendors/connect/", s.handleVendorConnect)         // POST /api/v1/vendors/connect/{id}

	// Message tracking
	mux.HandleFunc("/api/v1/messages/", s.handleMessageStatus) // Handles /api/v1/messages/{id}

	// Admin operations
	mux.HandleFunc("/api/v1/admin/stats", s.handleStats)
	mux.HandleFunc("/api/v1/admin/sessions", s.handleSessions)

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      s.loggingMiddleware(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.WithField("port", s.port).Info("Starting management API server")

	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.WithError(err).Error("Management API server error")
		}
	}()

	return nil
}

// Stop gracefully stops the API server
func (s *Server) Stop(ctx context.Context) error {
	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}

// loggingMiddleware logs HTTP requests
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.WithFields(log.Fields{
			"method":   r.Method,
			"path":     r.URL.Path,
			"duration": time.Since(start),
			"remote":   r.RemoteAddr,
		}).Info("HTTP request")
	})
}

// handleHealth returns health status
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "warp-smpp-gateway",
		"status":  "healthy",
		"version": "1.0.0",
		"time":    time.Now().UTC(),
	})
}

// handleReady returns readiness status
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	// Check if at least one vendor is connected
	health := s.connectorMgr.HealthCheck()
	connected := 0
	for _, h := range health {
		if h.Status == "connected" {
			connected++
		}
	}

	if connected == 0 {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ready":  false,
			"reason": "no vendors connected",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ready":             true,
		"vendors_connected": connected,
	})
}

// handleListVendors lists all vendors and their status
func (s *Server) handleListVendors(w http.ResponseWriter, r *http.Request) {
	health := s.connectorMgr.HealthCheck()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"vendors": health,
		"count":   len(health),
	})
}

// handleVendorStatus returns detailed vendor status
func (s *Server) handleVendorStatus(w http.ResponseWriter, r *http.Request) {
	health := s.connectorMgr.HealthCheck()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    health,
	})
}

// handleMessageStatus returns status of a specific message
func (s *Server) handleMessageStatus(w http.ResponseWriter, r *http.Request) {
	// Extract message ID from path
	messageID := r.URL.Path[len("/api/v1/messages/"):]
	if messageID == "" {
		http.Error(w, "Message ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	msg, err := s.dlrTracker.GetMessageStatus(ctx, messageID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Message not found",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    msg,
	})
}

// handleStats returns overall statistics
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	smppMetrics := s.smppServer.GetMetrics()
	vendorHealth := s.connectorMgr.HealthCheck()

	// Calculate vendor stats
	vendorStats := make(map[string]interface{})
	totalSent := int64(0)
	totalSuccess := int64(0)
	totalFailed := int64(0)

	for _, h := range vendorHealth {
		totalSent += h.MessagesSent
		totalSuccess += h.MessagesSuccess
		totalFailed += h.MessagesFailed
	}

	vendorStats["total_sent"] = totalSent
	vendorStats["total_success"] = totalSuccess
	vendorStats["total_failed"] = totalFailed

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"smpp_server": smppMetrics,
			"vendors":     vendorStats,
			"timestamp":   time.Now().UTC(),
		},
	})
}

// handleSessions returns active customer sessions
func (s *Server) handleSessions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"active_count": s.smppServer.GetMetrics()["active_sessions"],
			"note":         "Detailed session info coming soon",
		},
	})
}

// handleVendorReconnect reloads vendor config and reconnects
func (s *Server) handleVendorReconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract vendor ID from path
	vendorID := r.URL.Path[len("/api/v1/vendors/reconnect/"):]
	if vendorID == "" {
		http.Error(w, "Vendor ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	if err := s.connectorMgr.ReconnectVendor(ctx, vendorID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Vendor reconnection initiated",
		"vendor_id": vendorID,
	})
}

// handleVendorDisconnect disconnects a vendor
func (s *Server) handleVendorDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract vendor ID from path
	vendorID := r.URL.Path[len("/api/v1/vendors/disconnect/"):]
	if vendorID == "" {
		http.Error(w, "Vendor ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	if err := s.connectorMgr.DisconnectVendor(ctx, vendorID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Vendor disconnected",
		"vendor_id": vendorID,
	})
}

// handleVendorConnect connects a vendor
func (s *Server) handleVendorConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract vendor ID from path
	vendorID := r.URL.Path[len("/api/v1/vendors/connect/"):]
	if vendorID == "" {
		http.Error(w, "Vendor ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	if err := s.connectorMgr.ConnectVendor(ctx, vendorID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Vendor connection initiated",
		"vendor_id": vendorID,
	})
}
