package models

import (
	"time"

	"github.com/google/uuid"
)

// AssignedNumber represents a customer-assigned telephone number
type AssignedNumber struct {
	ID         uuid.UUID `json:"id" db:"id"`
	CustomerID uuid.UUID `json:"customer_id" db:"customer_id"`
	Number     string    `json:"number" db:"number"` // E.164 format

	// SOA tracking
	SOANumberID   *string    `json:"soa_number_id,omitempty" db:"soa_number_id"`
	SOALastSynced *time.Time `json:"soa_last_synced,omitempty" db:"soa_last_synced"`
	SOASyncStatus string     `json:"soa_sync_status" db:"soa_sync_status"`

	// Number classification
	NumberType string  `json:"number_type" db:"number_type"` // DID, TOLL_FREE
	NPA        *string `json:"npa,omitempty" db:"npa"`       // Area code
	NXX        *string `json:"nxx,omitempty" db:"nxx"`       // Exchange
	RateCenter *string `json:"rate_center,omitempty" db:"rate_center"`
	State      *string `json:"state,omitempty" db:"state"`

	// Features
	VoiceEnabled bool `json:"voice_enabled" db:"voice_enabled"`
	SMSEnabled   bool `json:"sms_enabled" db:"sms_enabled"`
	MMSEnabled   bool `json:"mms_enabled" db:"mms_enabled"`
	FaxEnabled   bool `json:"fax_enabled" db:"fax_enabled"`

	// Voice routing
	TrunkID                  *uuid.UUID `json:"trunk_id,omitempty" db:"trunk_id"`
	VoiceDestination         *string    `json:"voice_destination,omitempty" db:"voice_destination"`
	VoiceFailoverDestination *string    `json:"voice_failover_destination,omitempty" db:"voice_failover_destination"`
	VoiceRoutingType         *string    `json:"voice_routing_type,omitempty" db:"voice_routing_type"`

	// Messaging/TCR
	CampaignID *uuid.UUID `json:"campaign_id,omitempty" db:"campaign_id"`
	BrandID    *uuid.UUID `json:"brand_id,omitempty" db:"brand_id"`
	TCRStatus  *string    `json:"tcr_status,omitempty" db:"tcr_status"`

	// E911
	E911Enabled   bool       `json:"e911_enabled" db:"e911_enabled"`
	E911AddressID *uuid.UUID `json:"e911_address_id,omitempty" db:"e911_address_id"`

	// CNAM
	CNAMEnabled     bool    `json:"cnam_enabled" db:"cnam_enabled"`
	CNAMDisplayName *string `json:"cnam_display_name,omitempty" db:"cnam_display_name"`

	// Display
	FriendlyName *string `json:"friendly_name,omitempty" db:"friendly_name"`
	Description  *string `json:"description,omitempty" db:"description"`

	// Status & Billing
	Active           bool       `json:"active" db:"active"`
	MonthlyCharge    *float64   `json:"monthly_charge,omitempty" db:"monthly_charge"`
	BillingStartDate *time.Time `json:"billing_start_date,omitempty" db:"billing_start_date"`
	ActivatedAt      time.Time  `json:"activated_at" db:"activated_at"`
	ReleasedAt       *time.Time `json:"released_at,omitempty" db:"released_at"`
	ReleaseReason    *string    `json:"release_reason,omitempty" db:"release_reason"`

	// Audit
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy *uuid.UUID `json:"updated_by,omitempty" db:"updated_by"`
}

// AssignNumberRequest represents a request to assign a new number to a customer
type AssignNumberRequest struct {
	Number       string `json:"number" binding:"required"` // E.164 format
	FriendlyName string `json:"friendly_name"`
	Description  string `json:"description"`

	// Features to enable
	VoiceEnabled bool `json:"voice_enabled"`
	SMSEnabled   bool `json:"sms_enabled"`
	MMSEnabled   bool `json:"mms_enabled"`

	// Optional initial configuration
	TrunkID          *uuid.UUID `json:"trunk_id"`
	VoiceDestination string     `json:"voice_destination"`
	CampaignID       *uuid.UUID `json:"campaign_id"`
}

// UpdateNumberRequest represents a request to update a number's configuration
type UpdateNumberRequest struct {
	// Voice configuration
	VoiceEnabled             *bool      `json:"voice_enabled"`
	VoiceDestination         *string    `json:"voice_destination"`
	VoiceFailoverDestination *string    `json:"voice_failover_destination"`
	VoiceRoutingType         *string    `json:"voice_routing_type"`
	TrunkID                  *uuid.UUID `json:"trunk_id"`

	// Messaging configuration
	SMSEnabled *bool      `json:"sms_enabled"`
	MMSEnabled *bool      `json:"mms_enabled"`
	CampaignID *uuid.UUID `json:"campaign_id"`

	// E911 configuration
	E911Enabled   *bool      `json:"e911_enabled"`
	E911AddressID *uuid.UUID `json:"e911_address_id"`

	// CNAM configuration
	CNAMEnabled     *bool   `json:"cnam_enabled"`
	CNAMDisplayName *string `json:"cnam_display_name"`

	// Display
	FriendlyName *string `json:"friendly_name"`
	Description  *string `json:"description"`
}

// ReleaseNumberRequest represents a request to release a number
type ReleaseNumberRequest struct {
	Reason string `json:"reason"`
}

// SearchNumbersRequest represents a search request for available numbers
type SearchNumbersRequest struct {
	NPA        string `json:"npa" form:"npa"`               // Area code
	NXX        string `json:"nxx" form:"nxx"`               // Exchange
	State      string `json:"state" form:"state"`           // State code
	LATA       string `json:"lata" form:"lata"`             // LATA number
	RateCenter string `json:"rate_center" form:"rate_center"` // Rate center
	Page       int    `json:"page" form:"page"`
	Size       int    `json:"size" form:"size"`
}

// ReserveNumberRequest represents a request to reserve a number
type ReserveNumberRequest struct {
	Numbers []string `json:"numbers" binding:"required,min=1,max=100"` // E.164 format
}

// PurchaseNumberRequest represents a request to purchase reserved numbers
type PurchaseNumberRequest struct {
	Numbers []string `json:"numbers" binding:"required,min=1,max=100"` // E.164 format

	// Optional initial configuration for all numbers
	VoiceEnabled bool       `json:"voice_enabled"`
	SMSEnabled   bool       `json:"sms_enabled"`
	TrunkID      *uuid.UUID `json:"trunk_id"`
	CampaignID   *uuid.UUID `json:"campaign_id"`
}

// NumberInventorySummary represents aggregate statistics for a customer's numbers
type NumberInventorySummary struct {
	CustomerID         uuid.UUID `json:"customer_id"`
	ActiveCount        int64     `json:"active_count"`
	ReleasedCount      int64     `json:"released_count"`
	VoiceEnabledCount  int64     `json:"voice_enabled_count"`
	SMSEnabledCount    int64     `json:"sms_enabled_count"`
	CampaignLinkedCount int64    `json:"campaign_linked_count"`
	TrunkLinkedCount   int64     `json:"trunk_linked_count"`
	TotalMonthlyCharge float64   `json:"total_monthly_charge"`
}

// NumberSearchResult represents a single result from SOA search
type NumberSearchResult struct {
	TelephoneNumber string  `json:"telephone_number"`
	NPA             string  `json:"npa"`
	NXX             string  `json:"nxx"`
	State           string  `json:"state"`
	LATA            int     `json:"lata,omitempty"`
	RateCenter      string  `json:"rate_center,omitempty"`
	MonthlyRate     float64 `json:"monthly_rate,omitempty"`
}

// NumberSearchResponse represents a paginated search response
type NumberSearchResponse struct {
	Numbers       []NumberSearchResult `json:"numbers"`
	TotalElements int64                `json:"total_elements"`
	TotalPages    int                  `json:"total_pages"`
	Page          int                  `json:"page"`
	Size          int                  `json:"size"`
}

// NumberListResponse represents a paginated list of assigned numbers
type NumberListResponse struct {
	Numbers       []AssignedNumber `json:"numbers"`
	TotalElements int64            `json:"total_elements"`
	TotalPages    int              `json:"total_pages"`
	Page          int              `json:"page"`
	Size          int              `json:"size"`
}

// NumberAuditLog represents an audit log entry for number operations
type NumberAuditLog struct {
	ID                uuid.UUID              `json:"id" db:"id"`
	Action            string                 `json:"action" db:"action"`
	Numbers           []string               `json:"numbers" db:"numbers"`
	UserID            uuid.UUID              `json:"user_id" db:"user_id"`
	UserEmail         string                 `json:"user_email" db:"user_email"`
	CustomerID        *uuid.UUID             `json:"customer_id,omitempty" db:"customer_id"`
	ActingOnBehalfOf  *uuid.UUID             `json:"acting_on_behalf_of,omitempty" db:"acting_on_behalf_of"`
	RequestPath       string                 `json:"request_path,omitempty" db:"request_path"`
	RequestBody       map[string]interface{} `json:"request_body,omitempty" db:"request_body"`
	Success           bool                   `json:"success" db:"success"`
	ErrorMessage      *string                `json:"error_message,omitempty" db:"error_message"`
	IPAddress         *string                `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent         *string                `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt         time.Time              `json:"created_at" db:"created_at"`
}
