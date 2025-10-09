package models

import (
	"time"
)

// SMPPVendor represents an SMPP vendor/carrier configuration
type SMPPVendor struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"instance_name" binding:"required"`
	Host        string    `json:"host" db:"host" binding:"required"`
	Port        int       `json:"port" db:"port" binding:"required,min=1,max=65535"`
	UseTLS      bool      `json:"use_tls" db:"use_tls"`
	BindType    string    `json:"bind_type" db:"bind_type" binding:"required,oneof=transceiver transmitter receiver"`
	Priority    int       `json:"priority" db:"priority"`
	Throughput  int       `json:"throughput" db:"throughput"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	IsPrimary   bool      `json:"is_primary" db:"is_primary"`
	Status      string    `json:"status" db:"health_status"` // connected, disconnected, error
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	LastChecked time.Time `json:"last_checked" db:"last_health_check"`
}

// CreateSMPPVendorRequest represents the request to create an SMPP vendor
type CreateSMPPVendorRequest struct {
	Name       string `json:"name" binding:"required"`
	Host       string `json:"host" binding:"required"`
	Port       int    `json:"port" binding:"required,min=1,max=65535"`
	UseTLS     bool   `json:"use_tls"`
	BindType   string `json:"bind_type" binding:"required,oneof=transceiver transmitter receiver"`
	Priority   int    `json:"priority"`
	Throughput int    `json:"throughput" binding:"min=1,max=1000"`
}

// SMPPVendorStatus represents the current status of an SMPP vendor
type SMPPVendorStatus struct {
	VendorID      string    `json:"vendor_id"`
	VendorName    string    `json:"vendor_name"`
	Status        string    `json:"status"` // bound, unbound, error
	Bound         bool      `json:"bound"`
	MessagesSent  int64     `json:"messages_sent"`
	MessagesRecv  int64     `json:"messages_received"`
	LastBind      time.Time `json:"last_bind_time"`
	LastUnbind    time.Time `json:"last_unbind_time"`
	ErrorMessage  string    `json:"error_message,omitempty"`
}
