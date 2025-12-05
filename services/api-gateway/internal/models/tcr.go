package models

import (
	"time"

	"github.com/google/uuid"
)

// =============================================================================
// TCR BRAND MODELS
// =============================================================================

// Brand10DLC represents a registered TCR brand
type Brand10DLC struct {
	ID                       uuid.UUID  `json:"id" db:"id"`
	CustomerID               uuid.UUID  `json:"customer_id" db:"customer_id"`
	TCRBrandID               *string    `json:"tcr_brand_id,omitempty" db:"tcr_brand_id"`
	DisplayName              string     `json:"display_name" db:"display_name"`
	LegalName                string     `json:"legal_name" db:"legal_name"`
	CompanyName              *string    `json:"company_name,omitempty" db:"company_name"`
	TaxID                    *string    `json:"tax_id,omitempty" db:"tax_id"`
	EntityType               string     `json:"entity_type" db:"entity_type"`
	IdentityStatus           *string    `json:"identity_status,omitempty" db:"identity_status"`
	Vertical                 *string    `json:"vertical,omitempty" db:"vertical"`
	Website                  *string    `json:"website,omitempty" db:"website"`
	Country                  string     `json:"country" db:"country"`
	State                    *string    `json:"state,omitempty" db:"state"`
	City                     *string    `json:"city,omitempty" db:"city"`
	Street                   *string    `json:"street,omitempty" db:"street"`
	PostalCode               *string    `json:"postal_code,omitempty" db:"postal_code"`
	StockExchange            *string    `json:"stock_exchange,omitempty" db:"stock_exchange"`
	StockSymbol              *string    `json:"stock_symbol,omitempty" db:"stock_symbol"`
	AltBusinessID            *string    `json:"alt_business_id,omitempty" db:"alt_business_id"`
	AltBusinessIDType        *string    `json:"alt_business_id_type,omitempty" db:"alt_business_id_type"`
	PrimaryContactName       *string    `json:"primary_contact_name,omitempty" db:"primary_contact_name"`
	PrimaryContactEmail      *string    `json:"primary_contact_email,omitempty" db:"primary_contact_email"`
	PrimaryContactPhone      *string    `json:"primary_contact_phone,omitempty" db:"primary_contact_phone"`
	BusinessContactFirstName *string    `json:"business_contact_first_name,omitempty" db:"business_contact_first_name"`
	BusinessContactLastName  *string    `json:"business_contact_last_name,omitempty" db:"business_contact_last_name"`
	BusinessContactEmail     *string    `json:"business_contact_email,omitempty" db:"business_contact_email"`
	BusinessContactPhone     *string    `json:"business_contact_phone,omitempty" db:"business_contact_phone"`
	Status                   *string    `json:"status,omitempty" db:"status"`
	TrustScore               *int       `json:"trust_score,omitempty" db:"trust_score"`
	VettingStatus            *string    `json:"vetting_status,omitempty" db:"vetting_status"`
	VettingProvider          *string    `json:"vetting_provider,omitempty" db:"vetting_provider"`
	VettingClass             *string    `json:"vetting_class,omitempty" db:"vetting_class"`
	VettingDate              *time.Time `json:"vetting_date,omitempty" db:"vetting_date"`
	BrandRelationship        string     `json:"brand_relationship" db:"brand_relationship"`
	ReferenceID              *string    `json:"reference_id,omitempty" db:"reference_id"`
	TCRCreatedAt             *time.Time `json:"tcr_created_at,omitempty" db:"tcr_created_at"`
	TCRUpdatedAt             *time.Time `json:"tcr_updated_at,omitempty" db:"tcr_updated_at"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy                *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy                *uuid.UUID `json:"updated_by,omitempty" db:"updated_by"`
}

// CreateBrandRequest represents a request to create a brand
type CreateBrandRequest struct {
	DisplayName              string  `json:"display_name" binding:"required"`
	LegalName                string  `json:"legal_name" binding:"required"`
	EntityType               string  `json:"entity_type" binding:"required"`
	Email                    string  `json:"email" binding:"required,email"`
	Phone                    string  `json:"phone" binding:"required"`
	CompanyName              *string `json:"company_name,omitempty"`
	TaxID                    *string `json:"tax_id,omitempty"`
	Website                  *string `json:"website,omitempty"`
	Vertical                 *string `json:"vertical,omitempty"`
	Street                   *string `json:"street,omitempty"`
	City                     *string `json:"city,omitempty"`
	State                    *string `json:"state,omitempty"`
	PostalCode               *string `json:"postal_code,omitempty"`
	Country                  string  `json:"country"`
	StockExchange            *string `json:"stock_exchange,omitempty"`
	StockSymbol              *string `json:"stock_symbol,omitempty"`
	AltBusinessID            *string `json:"alt_business_id,omitempty"`
	AltBusinessIDType        *string `json:"alt_business_id_type,omitempty"`
	ContactFirstName         *string `json:"contact_first_name,omitempty"`
	ContactLastName          *string `json:"contact_last_name,omitempty"`
	ContactEmail             *string `json:"contact_email,omitempty"`
	ContactPhone             *string `json:"contact_phone,omitempty"`
	ReferenceID              *string `json:"reference_id,omitempty"`
}

// UpdateBrandRequest represents a request to update a brand
type UpdateBrandRequest struct {
	// Business Information
	DisplayName  *string `json:"display_name,omitempty"`
	CompanyName  *string `json:"company_name,omitempty"` // Legal name - requires resubmission
	Website      *string `json:"website,omitempty"`
	Vertical     *string `json:"vertical,omitempty"`
	EntityType   *string `json:"entity_type,omitempty"` // Requires resubmission
	TaxID        *string `json:"tax_id,omitempty"`      // EIN - requires resubmission

	// Address
	Street     *string `json:"street,omitempty"`
	City       *string `json:"city,omitempty"`
	State      *string `json:"state,omitempty"`
	PostalCode *string `json:"postal_code,omitempty"`

	// Contact Information
	Email *string `json:"email,omitempty"` // Primary support email
	Phone *string `json:"phone,omitempty"` // Primary support phone
	PrimaryContactName  *string `json:"primary_contact_name,omitempty"`
	PrimaryContactEmail *string `json:"primary_contact_email,omitempty"`
	PrimaryContactPhone *string `json:"primary_contact_phone,omitempty"`

	// Business Contact (separate from primary contact)
	BusinessContactFirstName *string `json:"business_contact_first_name,omitempty"`
	BusinessContactLastName  *string `json:"business_contact_last_name,omitempty"`
	BusinessContactEmail     *string `json:"business_contact_email,omitempty"`
	BusinessContactPhone     *string `json:"business_contact_phone,omitempty"`

	// Stock Information (for public companies)
	StockSymbol   *string `json:"stock_symbol,omitempty"`
	StockExchange *string `json:"stock_exchange,omitempty"`

	// Alternative Business IDs
	AltBusinessID     *string `json:"alt_business_id,omitempty"`
	AltBusinessIDType *string `json:"alt_business_id_type,omitempty"`

	// Reference/Tracking
	ReferenceID *string `json:"reference_id,omitempty"`
}

// RequestVettingRequest represents a request for external brand vetting
type RequestVettingRequest struct {
	Provider     string `json:"provider" binding:"required"` // AEGIS, WMC
	VettingClass string `json:"vetting_class" binding:"required"` // STANDARD, POLITICAL
}

// =============================================================================
// TCR CAMPAIGN MODELS
// =============================================================================

// Campaign10DLC represents a registered TCR campaign
type Campaign10DLC struct {
	ID                   uuid.UUID  `json:"id" db:"id"`
	CustomerID           uuid.UUID  `json:"customer_id" db:"customer_id"`
	BrandID              uuid.UUID  `json:"brand_id" db:"brand_id"`
	TCRCampaignID        *string    `json:"tcr_campaign_id,omitempty" db:"tcr_campaign_id"`
	ResellerID           *string    `json:"reseller_id,omitempty" db:"reseller_id"`
	UseCase              string     `json:"use_case" db:"use_case"`
	SubUseCases          []string   `json:"sub_use_cases,omitempty" db:"sub_use_cases"`
	Description          string     `json:"description" db:"description"`
	MessageFlow          string     `json:"message_flow" db:"message_flow"`
	SampleMessages       []string   `json:"sample_messages" db:"sample_messages"`
	SubscriberOptin      bool       `json:"subscriber_optin" db:"subscriber_optin"`
	SubscriberOptout     bool       `json:"subscriber_optout" db:"subscriber_optout"`
	SubscriberHelp       bool       `json:"subscriber_help" db:"subscriber_help"`
	OptinKeywords        *string    `json:"optin_keywords,omitempty" db:"optin_keywords"`
	OptinMessage         *string    `json:"optin_message,omitempty" db:"optin_message"`
	OptoutKeywords       string     `json:"optout_keywords" db:"optout_keywords"`
	OptoutMessage        *string    `json:"optout_message,omitempty" db:"optout_message"`
	HelpKeywords         string     `json:"help_keywords" db:"help_keywords"`
	HelpMessage          *string    `json:"help_message,omitempty" db:"help_message"`
	EmbeddedLink         bool       `json:"embedded_link" db:"embedded_link"`
	EmbeddedPhone        bool       `json:"embedded_phone" db:"embedded_phone"`
	NumberPool           bool       `json:"number_pool" db:"number_pool"`
	AgeGated             bool       `json:"age_gated" db:"age_gated"`
	DirectLending        bool       `json:"direct_lending" db:"direct_lending"`
	PrivacyPolicyURL     *string    `json:"privacy_policy_url,omitempty" db:"privacy_policy_url"`
	TermsURL             *string    `json:"terms_url,omitempty" db:"terms_url"`
	AutoRenewal          bool       `json:"auto_renewal" db:"auto_renewal"`
	ExpirationDate       *time.Time `json:"expiration_date,omitempty" db:"expiration_date"`
	ThroughputLimit      *int       `json:"throughput_limit,omitempty" db:"throughput_limit"`
	DailyCap             *int       `json:"daily_cap,omitempty" db:"daily_cap"`
	Status               string     `json:"status" db:"status"`
	TCRSubmissionDate    *time.Time `json:"tcr_submission_date,omitempty" db:"tcr_submission_date"`
	TCRApprovalDate      *time.Time `json:"tcr_approval_date,omitempty" db:"tcr_approval_date"`
	TrustScore           *int       `json:"trust_score,omitempty" db:"trust_score"`
	ReferenceID          *string    `json:"reference_id,omitempty" db:"reference_id"`
	TCRCreatedAt         *time.Time `json:"tcr_created_at,omitempty" db:"tcr_created_at"`
	TCRUpdatedAt         *time.Time `json:"tcr_updated_at,omitempty" db:"tcr_updated_at"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy            *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy            *uuid.UUID `json:"updated_by,omitempty" db:"updated_by"`
}

// CreateCampaignRequest represents a request to create a campaign
type CreateCampaignRequest struct {
	BrandID              uuid.UUID `json:"brand_id" binding:"required"`
	UseCase              string    `json:"use_case" binding:"required"`
	Description          string    `json:"description" binding:"required,min=40"`
	MessageFlow          string    `json:"message_flow" binding:"required,min=40"`
	SampleMessages       []string  `json:"sample_messages" binding:"required,min=1,max=5"`
	SubUseCases          []string  `json:"sub_use_cases,omitempty"`
	SubscriberOptin      bool      `json:"subscriber_optin"`
	SubscriberOptout     bool      `json:"subscriber_optout"`
	SubscriberHelp       bool      `json:"subscriber_help"`
	OptinKeywords        *string   `json:"optin_keywords,omitempty"`
	OptinMessage         *string   `json:"optin_message,omitempty"`
	OptoutKeywords       string    `json:"optout_keywords"`
	OptoutMessage        *string   `json:"optout_message,omitempty"`
	HelpKeywords         string    `json:"help_keywords"`
	HelpMessage          *string   `json:"help_message,omitempty"`
	EmbeddedLink         bool      `json:"embedded_link"`
	EmbeddedPhone        bool      `json:"embedded_phone"`
	NumberPool           bool      `json:"number_pool"`
	AgeGated             bool      `json:"age_gated"`
	DirectLending        bool      `json:"direct_lending"`
	PrivacyPolicyURL     *string   `json:"privacy_policy_url,omitempty" binding:"omitempty,url"`
	TermsURL             *string   `json:"terms_url,omitempty" binding:"omitempty,url"`
	AutoRenewal          bool      `json:"auto_renewal"`
	ReferenceID          *string   `json:"reference_id,omitempty"`
}

// UpdateCampaignRequest represents a request to update a campaign
type UpdateCampaignRequest struct {
	Description      *string  `json:"description,omitempty" binding:"omitempty,min=40"`
	MessageFlow      *string  `json:"message_flow,omitempty" binding:"omitempty,min=40"`
	SampleMessages   []string `json:"sample_messages,omitempty" binding:"omitempty,min=1,max=5"`
	OptinMessage     *string  `json:"optin_message,omitempty"`
	OptoutMessage    *string  `json:"optout_message,omitempty"`
	HelpMessage      *string  `json:"help_message,omitempty"`
	PrivacyPolicyURL *string  `json:"privacy_policy_url,omitempty" binding:"omitempty,url"`
	TermsURL         *string  `json:"terms_url,omitempty" binding:"omitempty,url"`
	AutoRenewal      *bool    `json:"auto_renewal,omitempty"`
}

// CampaignWithBrand represents a campaign joined with brand info
type CampaignWithBrand struct {
	Campaign10DLC
	BrandName       string  `json:"brand_name" db:"brand_name"`
	BrandStatus     *string `json:"brand_status" db:"brand_status"`
	BrandTrustScore *int    `json:"brand_trust_score" db:"brand_trust_score"`
	PhoneCount      int     `json:"phone_count" db:"phone_count"`
}

// CampaignMNOStatus represents per-carrier approval status
type CampaignMNOStatus struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	CampaignID       uuid.UUID  `json:"campaign_id" db:"campaign_id"`
	MNOID            string     `json:"mno_id" db:"mno_id"`
	MNOName          string     `json:"mno_name" db:"mno_name"`
	Status           string     `json:"status" db:"status"`
	StatusUpdatedAt  time.Time  `json:"status_updated_at" db:"status_updated_at"`
	RejectionReason  *string    `json:"rejection_reason,omitempty" db:"rejection_reason"`
	RejectionCode    *string    `json:"rejection_code,omitempty" db:"rejection_code"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// CampaignPhoneNumber represents a phone number assignment
type CampaignPhoneNumber struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	CampaignID  uuid.UUID  `json:"campaign_id" db:"campaign_id"`
	PhoneNumber string     `json:"phone_number" db:"phone_number"`
	AssignedAt  time.Time  `json:"assigned_at" db:"assigned_at"`
	AssignedBy  *uuid.UUID `json:"assigned_by,omitempty" db:"assigned_by"`
	RemovedAt   *time.Time `json:"removed_at,omitempty" db:"removed_at"`
	RemovedBy   *uuid.UUID `json:"removed_by,omitempty" db:"removed_by"`
	IsActive    bool       `json:"is_active" db:"is_active"`
}

// AssignNumbersRequest represents a request to assign phone numbers to campaign
type AssignNumbersRequest struct {
	PhoneNumbers []string `json:"phone_numbers" binding:"required,min=1"`
}

// =============================================================================
// ENUMERATION MODELS
// =============================================================================

// UseCaseInfo represents a campaign use case
type UseCaseInfo struct {
	Code        string `json:"code"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Difficulty  string `json:"difficulty"` // EASY, MEDIUM, HARD
	MinSamples  int    `json:"min_samples"`
}

// EntityTypeInfo represents a brand entity type
type EntityTypeInfo struct {
	Code        string `json:"code"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
}

// VerticalInfo represents an industry vertical
type VerticalInfo struct {
	Code        string `json:"code"`
	DisplayName string `json:"display_name"`
}

// MNOInfo represents a Mobile Network Operator
type MNOInfo struct {
	MNOID string `json:"mno_id"`
	Name  string `json:"name"`
}

// DCAInfo represents a Direct Connect Aggregator (DCA/CNP)
type DCAInfo struct {
	DCAID       string `json:"dca_id"`
	DisplayName string `json:"display_name"`
}
