package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Customer represents a WARP platform customer
type Customer struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	BAN             string          `json:"ban" db:"ban" binding:"required"`
	CompanyName     string          `json:"company_name" db:"company_name" binding:"required"`
	LegalName       *string         `json:"legal_name,omitempty" db:"legal_name"`
	CustomerType    string          `json:"customer_type" db:"customer_type" binding:"required,oneof=PREPAID POSTPAID RESELLER"`
	Tier            string          `json:"tier" db:"tier" binding:"oneof=STANDARD PREMIUM ENTERPRISE"`
	Contact         json.RawMessage `json:"contact" db:"contact"`
	Address         json.RawMessage `json:"address" db:"address"`
	BillingCycle    string          `json:"billing_cycle" db:"billing_cycle"`
	PaymentTerms    int             `json:"payment_terms" db:"payment_terms"`
	Currency        string          `json:"currency" db:"currency"`
	Status          string          `json:"status" db:"status"`
	CreditLimit     *float64        `json:"credit_limit,omitempty" db:"credit_limit"`
	CurrentBalance  float64         `json:"current_balance" db:"current_balance"`
	PrepaidBalance  float64         `json:"prepaid_balance" db:"prepaid_balance"`
	CustomFields    json.RawMessage `json:"custom_fields,omitempty" db:"custom_fields"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`

	// Relationships (populated via joins)
	Trunks      []Trunk       `json:"trunks,omitempty" db:"-"`
	DIDs        []DID         `json:"dids,omitempty" db:"-"`
	UsageSummary *UsageSummary `json:"usage_summary,omitempty" db:"-"`
}

// CreateCustomerRequest for API
type CreateCustomerRequest struct {
	BAN           string          `json:"ban" binding:"required"`
	CompanyName   string          `json:"company_name" binding:"required"`
	LegalName     string          `json:"legal_name,omitempty"`
	CustomerType  string          `json:"customer_type" binding:"required,oneof=PREPAID POSTPAID RESELLER"`
	Tier          string          `json:"tier,omitempty"`
	Contact       json.RawMessage `json:"contact" binding:"required"`
	Address       json.RawMessage `json:"address" binding:"required"`
	BillingCycle  string          `json:"billing_cycle,omitempty"`
	PaymentTerms  int             `json:"payment_terms,omitempty"`
	Currency      string          `json:"currency,omitempty"`
	CreditLimit   *float64        `json:"credit_limit,omitempty"`
	CustomFields  json.RawMessage `json:"custom_fields,omitempty"`
}

// UpdateCustomerRequest for API
type UpdateCustomerRequest struct {
	CompanyName    *string          `json:"company_name,omitempty"`
	LegalName      *string          `json:"legal_name,omitempty"`
	Tier           *string          `json:"tier,omitempty"`
	Contact        json.RawMessage  `json:"contact,omitempty"`
	Address        json.RawMessage  `json:"address,omitempty"`
	BillingCycle   *string          `json:"billing_cycle,omitempty"`
	PaymentTerms   *int             `json:"payment_terms,omitempty"`
	Status         *string          `json:"status,omitempty"`
	CreditLimit    *float64         `json:"credit_limit,omitempty"`
	CustomFields   json.RawMessage  `json:"custom_fields,omitempty"`
}

// UsageSummary for customer usage display
type UsageSummary struct {
	CurrentMonth struct {
		VoiceMinutes  float64 `json:"voice_minutes"`
		SMSCount      int     `json:"sms_count"`
		TotalCharges  float64 `json:"total_charges"`
	} `json:"current_month"`
}

// Trunk represents a SIP trunk
type Trunk struct {
	ID                  uuid.UUID       `json:"id" db:"id"`
	CustomerID          uuid.UUID       `json:"customer_id" db:"customer_id"`
	TrunkName           string          `json:"trunk_name" db:"trunk_name"`
	TrunkCode           *string         `json:"trunk_code,omitempty" db:"trunk_code"`
	PartitionID         *uuid.UUID      `json:"partition_id,omitempty" db:"partition_id"`
	InboundConfig       json.RawMessage `json:"inbound_config" db:"inbound_config"`
	OutboundConfig      json.RawMessage `json:"outbound_config" db:"outbound_config"`
	Codecs              []string        `json:"codecs" db:"codecs"`
	MaxConcurrentCalls  int             `json:"max_concurrent_calls" db:"max_concurrent_calls"`
	CallsPerSecondLimit int             `json:"calls_per_second_limit" db:"calls_per_second_limit"`
	Status              string          `json:"status" db:"status"`
	CreatedAt           time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at" db:"updated_at"`

	// Relationships
	Partition *Partition `json:"partition,omitempty" db:"-"`
}

// CreateTrunkRequest for API
type CreateTrunkRequest struct {
	TrunkName           string          `json:"trunk_name" binding:"required"`
	TrunkCode           *string         `json:"trunk_code,omitempty"`
	PartitionID         *uuid.UUID      `json:"partition_id,omitempty"`
	InboundConfig       json.RawMessage `json:"inbound_config" binding:"required"`
	OutboundConfig      json.RawMessage `json:"outbound_config" binding:"required"`
	Codecs              []string        `json:"codecs"`
	MaxConcurrentCalls  int             `json:"max_concurrent_calls"`
	CallsPerSecondLimit int             `json:"calls_per_second_limit"`
}

// DID represents a phone number
type DID struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	Number       string     `json:"number" db:"number"`
	CustomerID   uuid.UUID  `json:"customer_id" db:"customer_id"`
	TrunkID      *uuid.UUID `json:"trunk_id,omitempty" db:"trunk_id"`
	NumberType   string     `json:"number_type" db:"number_type"`
	VoiceEnabled bool       `json:"voice_enabled" db:"voice_enabled"`
	SMSEnabled   bool       `json:"sms_enabled" db:"sms_enabled"`
	MMSEnabled   bool       `json:"mms_enabled" db:"mms_enabled"`
	Status       string     `json:"status" db:"status"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}

// Partition represents a routing partition
type Partition struct {
	ID            uuid.UUID `json:"id" db:"id"`
	PartitionCode string    `json:"partition_code" db:"partition_code"`
	PartitionName string    `json:"partition_name" db:"partition_name"`
	Description   *string   `json:"description,omitempty" db:"description"`
	Active        bool      `json:"active" db:"active"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// VoiceVendor represents an upstream voice vendor
type VoiceVendor struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	VendorCode      string          `json:"vendor_code" db:"vendor_code" binding:"required"`
	VendorName      string          `json:"vendor_name" db:"vendor_name" binding:"required"`
	VendorType      string          `json:"vendor_type" db:"vendor_type"`
	BillingModel    string          `json:"billing_model" db:"billing_model" binding:"required"`
	SIPEndpoints    json.RawMessage `json:"sip_endpoints" db:"sip_endpoints" binding:"required"`
	AuthType        *string         `json:"auth_type,omitempty" db:"auth_type"`
	SupportedCodecs []string        `json:"supported_codecs" db:"supported_codecs"`
	CapacityCPS     *int            `json:"capacity_cps,omitempty" db:"capacity_cps"`
	Active          bool            `json:"active" db:"active"`
	HealthStatus    *string         `json:"health_status,omitempty" db:"health_status"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

// CreateVoiceVendorRequest for API
type CreateVoiceVendorRequest struct {
	VendorCode      string          `json:"vendor_code" binding:"required"`
	VendorName      string          `json:"vendor_name" binding:"required"`
	VendorType      string          `json:"vendor_type" binding:"required"`
	BillingModel    string          `json:"billing_model" binding:"required,oneof=LRN OCN_LATA DNIS PREFIX"`
	SIPEndpoints    json.RawMessage `json:"sip_endpoints" binding:"required"`
	AuthType        *string         `json:"auth_type,omitempty"`
	SupportedCodecs []string        `json:"supported_codecs"`
	CapacityCPS     *int            `json:"capacity_cps,omitempty"`
}

// SMSVendor represents an SMS vendor (go-smpp)
type SMSVendor struct {
	ID               uuid.UUID       `json:"id" db:"id"`
	VendorName       string          `json:"vendor_name" db:"vendor_name"`
	VendorType       string          `json:"vendor_type" db:"vendor_type"`
	SMPPConfig       json.RawMessage `json:"smpp_config" db:"smpp_config"`
	SMSRate          float64         `json:"sms_rate" db:"sms_rate"`
	ThroughputLimit  int             `json:"throughput_limit" db:"throughput_limit"`
	Active           bool            `json:"active" db:"active"`
	HealthStatus     *string         `json:"health_status,omitempty" db:"health_status"`
	LastHealthCheck  *time.Time      `json:"last_health_check,omitempty" db:"last_health_check"`
	CreatedAt        time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at" db:"updated_at"`
}

// CreateSMSVendorRequest for API
type CreateSMSVendorRequest struct {
	VendorName      string          `json:"vendor_name" binding:"required"`
	VendorType      string          `json:"vendor_type" binding:"required"`
	SMPPConfig      json.RawMessage `json:"smpp_config" binding:"required"`
	SMSRate         float64         `json:"sms_rate" binding:"required"`
	ThroughputLimit int             `json:"throughput_limit"`
}
