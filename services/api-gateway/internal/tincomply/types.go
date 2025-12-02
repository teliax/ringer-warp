package tincomply

import "time"

// EINLookupRequest represents a request to lookup company name by EIN
type EINLookupRequest struct {
	TIN string `json:"tin" binding:"required"`
}

// EINLookupResponse represents the response from EIN lookup
// Actual TinComply response structure
type EINLookupResponse struct {
	ID      string                        `json:"id"`
	Request TinComplyRequestInfo          `json:"request"`
	Result  CompanyNameLookupByEinResult `json:"companyNameLookupByEinResult"`
}

// TinComplyRequestInfo contains request metadata
type TinComplyRequestInfo struct {
	TIN               string   `json:"tin"` // Masked as XXXXX9949
	RequestDate       string   `json:"requestDate"`
	RequestedServices string   `json:"requestedServices"`
	EnabledServices   []string `json:"enabledServices"`
}

// CompanyNameLookupByEinResult contains the validated company information
type CompanyNameLookupByEinResult struct {
	Name      string `json:"name,omitempty"`      // Official registered company name
	Message   string `json:"message"`              // "EIN lookup match found" or "No match found"
	Found     bool   `json:"found"`                // true if match found
	Completed bool   `json:"completed"`            // true if lookup completed
}

// TINNameMatchRequest represents a request to verify TIN and name match
type TINNameMatchRequest struct {
	TIN         string `json:"tin" binding:"required"`
	CompanyName string `json:"company_name" binding:"required"`
}

// TINNameMatchResponse represents the response from TIN/name matching
type TINNameMatchResponse struct {
	RequestID      string                 `json:"request_id"`
	ServiceType    string                 `json:"service_type"`
	Status         string                 `json:"status"`
	CompletedAt    *time.Time             `json:"completed_at,omitempty"`
	Result         *TINNameMatchResult    `json:"result,omitempty"`
	Error          *string                `json:"error,omitempty"`
	OriginalParams map[string]interface{} `json:"original_params,omitempty"`
}

// TINNameMatchResult contains the validation result
type TINNameMatchResult struct {
	TIN          string  `json:"tin"`
	CompanyName  string  `json:"company_name"`
	Matched      bool    `json:"matched"`
	MatchScore   float64 `json:"match_score,omitempty"`
	IRSVerified  bool    `json:"irs_verified"`
	ExactMatch   bool    `json:"exact_match"`
	FuzzyMatch   bool    `json:"fuzzy_match"`
	Confidence   string  `json:"confidence"` // "high", "medium", "low"
	MatchDetails string  `json:"match_details,omitempty"`
}

// CompanyDetailsRequest represents a request to get company details by name and address
type CompanyDetailsRequest struct {
	CompanyName string `json:"company_name" binding:"required"`
	Street      string `json:"street,omitempty"`
	City        string `json:"city,omitempty"`
	State       string `json:"state,omitempty"`
	ZipCode     string `json:"zip_code,omitempty"`
}

// CompanyDetailsResponse represents the response from company details lookup
type CompanyDetailsResponse struct {
	RequestID      string                 `json:"request_id"`
	ServiceType    string                 `json:"service_type"`
	Status         string                 `json:"status"`
	CompletedAt    *time.Time             `json:"completed_at,omitempty"`
	Result         *CompanyDetails        `json:"result,omitempty"`
	Error          *string                `json:"error,omitempty"`
	OriginalParams map[string]interface{} `json:"original_params,omitempty"`
}

// CompanyDetails contains detailed company information
type CompanyDetails struct {
	CompanyName    string  `json:"company_name"`
	LegalName      string  `json:"legal_name,omitempty"`
	EIN            string  `json:"ein,omitempty"`
	EntityType     string  `json:"entity_type,omitempty"`
	IncorporatedAt string  `json:"incorporated_at,omitempty"`
	Status         string  `json:"status,omitempty"`
	Street         string  `json:"street,omitempty"`
	City           string  `json:"city,omitempty"`
	State          string  `json:"state,omitempty"`
	ZipCode        string  `json:"zip_code,omitempty"`
	Country        string  `json:"country,omitempty"`
	Phone          string  `json:"phone,omitempty"`
	Website        string  `json:"website,omitempty"`
	Industry       string  `json:"industry,omitempty"`
	NAICS          string  `json:"naics_code,omitempty"`
	SIC            string  `json:"sic_code,omitempty"`
	MatchScore     float64 `json:"match_score,omitempty"`
}
