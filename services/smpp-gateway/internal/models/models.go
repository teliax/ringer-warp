package models

import (
	"time"
)

// Vendor represents an upstream SMPP carrier (e.g., Sinch)
type Vendor struct {
	ID           string    `json:"id"`
	InstanceName string    `json:"instance_name"`
	DisplayName  string    `json:"display_name"`
	Host         string    `json:"host"`
	Port         int       `json:"port"`
	UseTLS       bool      `json:"use_tls"`
	Username     string    `json:"username"`   // SMPP system_id
	Password     string    `json:"-"`          // SMPP password (not serialized in JSON)
	SystemType   string    `json:"system_type"` // SMPP system_type (e.g. "cp" for Sinch)
	BindType     string    `json:"bind_type"` // "transceiver", "transmitter", "receiver"
	Throughput   int       `json:"throughput"` // msgs/sec limit
	Priority     int       `json:"priority"`
	IsPrimary    bool      `json:"is_primary"`
	IsActive     bool      `json:"is_active"`
	Status       string    `json:"status"` // "connected", "disconnected", "error"
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Message represents an SMS message
type Message struct {
	ID            string     `json:"id"`
	SourceAddr    string     `json:"source_addr"`
	DestAddr      string     `json:"dest_addr"`
	Content       string     `json:"content"`
	Encoding      string     `json:"encoding"` // "gsm7" or "ucs2"
	CustomerID    string     `json:"customer_id"`
	VendorID      string     `json:"vendor_id"`
	Status        string     `json:"status"` // "pending", "sent", "delivered", "failed"
	DLRStatus     string     `json:"dlr_status"`
	Segments      int        `json:"segments"`
	Cost          float64    `json:"cost"`
	SubmittedAt   time.Time  `json:"submitted_at"`
	DeliveredAt   *time.Time `json:"delivered_at,omitempty"`
	FailureReason string     `json:"failure_reason,omitempty"`
}

// DeliveryReceipt represents an SMPP DLR
type DeliveryReceipt struct {
	MessageID    string    `json:"message_id"`
	VendorMsgID  string    `json:"vendor_msg_id"`
	Status       string    `json:"status"` // "DELIVRD", "EXPIRED", "DELETED", "UNDELIV", "ACCEPTD", "UNKNOWN", "REJECTD"
	ErrorCode    string    `json:"error_code"`
	ReceivedAt   time.Time `json:"received_at"`
	SubmitDate   time.Time `json:"submit_date"`
	DoneDate     time.Time `json:"done_date"`
	Text         string    `json:"text"` // Optional DLR text
}

// SMPPSession represents a client SMPP session
type SMPPSession struct {
	SessionID    string
	SystemID     string
	CustomerID   string
	BindType     string
	BoundAt      time.Time
	LastActivity time.Time
	MessageCount int64
	ErrorCount   int64
}

// ConnectorHealth represents vendor connector health status
type ConnectorHealth struct {
	VendorID        string    `json:"vendor_id"`
	VendorName      string    `json:"vendor_name"`
	Status          string    `json:"status"` // "connected", "disconnected", "reconnecting"
	ConnectedAt     time.Time `json:"connected_at"`
	LastError       string    `json:"last_error,omitempty"`
	MessagesSent    int64     `json:"messages_sent"`
	MessagesSuccess int64     `json:"messages_success"`
	MessagesFailed  int64     `json:"messages_failed"`
	DLRsReceived    int64     `json:"dlrs_received"`
}

// RoutingRule represents message routing logic
type RoutingRule struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Priority         int     `json:"priority"`
	SourcePattern    string  `json:"source_pattern"`    // Regex
	DestPattern      string  `json:"dest_pattern"`      // Regex
	VendorID         string  `json:"vendor_id"`
	FailoverVendorID string  `json:"failover_vendor_id"`
	Rate             float64 `json:"rate"` // Cost per message
	IsActive         bool    `json:"is_active"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	VendorID       string `json:"vendor_id"`
	MessagesPerSec int    `json:"messages_per_sec"`
	MessagesPerMin int    `json:"messages_per_min"`
	MessagesPerHour int   `json:"messages_per_hour"`
}
