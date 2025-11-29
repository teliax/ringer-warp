package tcr

import "time"

// =============================================================================
// BRAND TYPES
// =============================================================================

// Brand represents a registered brand in TCR
type Brand struct {
	BrandID              string    `json:"brandId,omitempty"`
	DisplayName          string    `json:"displayName"`
	CompanyName          string    `json:"companyName,omitempty"`
	EntityType           string    `json:"entityType"` // PRIVATE_PROFIT, PUBLIC_PROFIT, NON_PROFIT, GOVERNMENT, SOLE_PROPRIETOR
	Country              string    `json:"country"`
	Email                string    `json:"email"`
	Phone                string    `json:"phone"`
	BrandRelationship    string    `json:"brandRelationship"` // DIRECT_CUSTOMER, RESELLER
	EIN                  string    `json:"ein,omitempty"`
	EINIssuingCountry    string    `json:"einIssuingCountry,omitempty"`
	Website              string    `json:"website,omitempty"`
	Vertical             string    `json:"vertical,omitempty"`
	Street               string    `json:"street,omitempty"`
	City                 string    `json:"city,omitempty"`
	State                string    `json:"state,omitempty"`
	PostalCode           string    `json:"postalCode,omitempty"`
	StockExchange        string    `json:"stockExchange,omitempty"`
	StockSymbol          string    `json:"stockSymbol,omitempty"`
	AltBusinessID        string    `json:"altBusinessId,omitempty"`
	AltBusinessIDType    string    `json:"altBusinessIdType,omitempty"`
	ReferenceID          string    `json:"referenceId,omitempty"`
	IPAddress            string    `json:"ipAddress,omitempty"`
	FirstName            string    `json:"firstName,omitempty"`
	LastName             string    `json:"lastName,omitempty"`
	BusinessContactEmail string    `json:"businessContactEmail,omitempty"`
	MobilePhone          string    `json:"mobilePhone,omitempty"`
	IdentityStatus       string    `json:"identityStatus,omitempty"` // SELF_DECLARED, UNVERIFIED, VERIFIED, VETTED_VERIFIED
	TrustScore           int       `json:"trustScore,omitempty"`
	CreateDate           time.Time `json:"createDate,omitempty"`
	Mock                 bool      `json:"mock,omitempty"` // For sandbox testing
}

// BrandRequest represents a request to create or update a brand
type BrandRequest struct {
	BrandRelationship    string `json:"brandRelationship"`
	Country              string `json:"country"`
	DisplayName          string `json:"displayName"`
	Email                string `json:"email"`
	EntityType           string `json:"entityType"`
	Phone                string `json:"phone"`
	CompanyName          string `json:"companyName,omitempty"`
	EIN                  string `json:"ein,omitempty"`
	EINIssuingCountry    string `json:"einIssuingCountry,omitempty"`
	Website              string `json:"website,omitempty"`
	Vertical             string `json:"vertical,omitempty"`
	Street               string `json:"street,omitempty"`
	City                 string `json:"city,omitempty"`
	State                string `json:"state,omitempty"`
	PostalCode           string `json:"postalCode,omitempty"`
	StockExchange        string `json:"stockExchange,omitempty"`
	StockSymbol          string `json:"stockSymbol,omitempty"`
	AltBusinessID        string `json:"altBusinessId,omitempty"`
	AltBusinessIDType    string `json:"altBusinessIdType,omitempty"`
	ReferenceID          string `json:"referenceId,omitempty"`
	IPAddress            string `json:"ipAddress,omitempty"`
	FirstName            string `json:"firstName,omitempty"`
	LastName             string `json:"lastName,omitempty"`
	BusinessContactEmail string `json:"businessContactEmail,omitempty"`
	MobilePhone          string `json:"mobilePhone,omitempty"`
	Mock                 bool   `json:"mock,omitempty"`
}

// BrandFilters represents query parameters for listing brands
type BrandFilters struct {
	Page           int    `json:"page,omitempty"`
	RecordsPerPage int    `json:"recordsPerPage,omitempty"`
	ReferenceID    string `json:"referenceId,omitempty"`
	DisplayName    string `json:"displayName,omitempty"`
	Country        string `json:"country,omitempty"`
}

// BrandListResponse represents the response from listing brands
type BrandListResponse struct {
	Brands []Brand `json:"brands"`
	Total  int     `json:"totalRecords"`
}

// VettingRequest represents a request for external brand vetting
type VettingRequest struct {
	EVPID        string `json:"evpId"` // Vetting provider ID (AEGIS, WMC, etc.)
	VettingClass string `json:"vettingClass"`
	VettingToken string `json:"vettingToken"`
}

// =============================================================================
// CAMPAIGN TYPES
// =============================================================================

// Campaign represents a registered campaign in TCR
type Campaign struct {
	CampaignID           string    `json:"campaignId,omitempty"`
	BrandID              string    `json:"brandId"`
	UseCase              string    `json:"usecase"`
	ResellerID           string    `json:"resellerId,omitempty"`
	Description          string    `json:"description"`
	MessageFlow          string    `json:"messageFlow"`
	Sample1              string    `json:"sample1"`
	Sample2              string    `json:"sample2,omitempty"`
	Sample3              string    `json:"sample3,omitempty"`
	Sample4              string    `json:"sample4,omitempty"`
	Sample5              string    `json:"sample5,omitempty"`
	SubscriberOptin      bool      `json:"subscriberOptin"`
	SubscriberOptout     bool      `json:"subscriberOptout"`
	SubscriberHelp       bool      `json:"subscriberHelp"`
	OptinKeywords        string    `json:"optinKeywords,omitempty"`
	OptinMessage         string    `json:"optinMessage,omitempty"`
	OptoutKeywords       string    `json:"optoutKeywords,omitempty"`
	OptoutMessage        string    `json:"optoutMessage,omitempty"`
	HelpKeywords         string    `json:"helpKeywords,omitempty"`
	HelpMessage          string    `json:"helpMessage,omitempty"`
	EmbeddedLink         bool      `json:"embeddedLink"`
	EmbeddedPhone        bool      `json:"embeddedPhone"`
	NumberPool           bool      `json:"numberPool"`
	AgeGated             bool      `json:"ageGated"`
	DirectLending        bool      `json:"directLending"`
	PrivacyPolicyLink    string    `json:"privacyPolicyLink,omitempty"`
	TermsAndConditions   string    `json:"termsAndConditions,omitempty"`
	AutoRenewal          bool      `json:"autoRenewal"`
	ReferenceID          string    `json:"referenceId,omitempty"`
	MNOIDs               []int     `json:"mnoIds,omitempty"` // Specific carriers (default: all)
	Status               string    `json:"status,omitempty"`
	CreateDate           time.Time `json:"createDate,omitempty"`
	ThroughputLimit      int       `json:"tpm,omitempty"`      // Throughput per minute
	DailyLimit           int       `json:"dailyLimit,omitempty"` // Daily message cap
	Mock                 bool      `json:"mock,omitempty"`
}

// CampaignRequest represents a request to create or update a campaign
type CampaignRequest struct {
	BrandID              string   `json:"brandId"`
	UseCase              string   `json:"usecase"`
	ResellerID           string   `json:"resellerId,omitempty"`
	Description          string   `json:"description"`
	MessageFlow          string   `json:"messageFlow"`
	Sample1              string   `json:"sample1"`
	Sample2              string   `json:"sample2,omitempty"`
	Sample3              string   `json:"sample3,omitempty"`
	Sample4              string   `json:"sample4,omitempty"`
	Sample5              string   `json:"sample5,omitempty"`
	SubscriberOptin      bool     `json:"subscriberOptin"`
	SubscriberOptout     bool     `json:"subscriberOptout"`
	SubscriberHelp       bool     `json:"subscriberHelp"`
	OptinKeywords        string   `json:"optinKeywords,omitempty"`
	OptinMessage         string   `json:"optinMessage,omitempty"`
	OptoutKeywords       string   `json:"optoutKeywords,omitempty"`
	OptoutMessage        string   `json:"optoutMessage,omitempty"`
	HelpKeywords         string   `json:"helpKeywords,omitempty"`
	HelpMessage          string   `json:"helpMessage,omitempty"`
	EmbeddedLink         bool     `json:"embeddedLink"`
	EmbeddedPhone        bool     `json:"embeddedPhone"`
	NumberPool           bool     `json:"numberPool"`
	AgeGated             bool     `json:"ageGated"`
	DirectLending        bool     `json:"directLending"`
	PrivacyPolicyLink    string   `json:"privacyPolicyLink,omitempty"`
	TermsAndConditions   string   `json:"termsAndConditions,omitempty"`
	AutoRenewal          bool     `json:"autoRenewal"`
	ReferenceID          string   `json:"referenceId,omitempty"`
	MNOIDs               []int    `json:"mnoIds,omitempty"`
	SubUseCases          []string `json:"subUsecases,omitempty"`
	AffiliateMarketing   bool     `json:"affiliateMarketing,omitempty"`
	Mock                 bool     `json:"mock,omitempty"`
}

// CampaignFilters represents query parameters for listing campaigns
type CampaignFilters struct {
	Page           int    `json:"page,omitempty"`
	RecordsPerPage int    `json:"recordsPerPage,omitempty"`
	BrandID        string `json:"brandId,omitempty"`
	ReferenceID    string `json:"referenceId,omitempty"`
	Status         string `json:"status,omitempty"`
}

// CampaignListResponse represents the response from listing campaigns
type CampaignListResponse struct {
	Campaigns []Campaign `json:"campaigns"`
	Total     int        `json:"totalRecords"`
}

// CampaignOperationStatus represents per-MNO status for a campaign
type CampaignOperationStatus map[string]string // MNO ID -> Status (REGISTERED, REVIEW, REJECTED, SUSPENDED)

// =============================================================================
// ENUMERATION TYPES
// =============================================================================

// UseCase represents a campaign use case
type UseCase struct {
	Code        string `json:"code"`
	DisplayName string `json:"name"`
	Description string `json:"description,omitempty"`
}

// EntityType represents a brand entity type
type EntityType struct {
	Code        string `json:"code"`
	DisplayName string `json:"name"`
	Description string `json:"description,omitempty"`
}

// Vertical represents an industry vertical
type Vertical struct {
	Code        string `json:"code"`
	DisplayName string `json:"name"`
	Description string `json:"description,omitempty"`
}

// MNO represents a Mobile Network Operator
type MNO struct {
	MNOID string `json:"mnoId"`
	Name  string `json:"name"`
}

// CampaignStatus represents a campaign status value
type CampaignStatus struct {
	Code        string `json:"code"`
	DisplayName string `json:"name"`
}

// BrandIdentityStatus represents a brand verification status
type BrandIdentityStatus struct {
	Code        string `json:"code"`
	DisplayName string `json:"name"`
}

// =============================================================================
// CAMPAIGN BUILDER TYPES (Simplified Flow)
// =============================================================================

// CampaignBuilderBrandInfo represents brand info for campaign creation
type CampaignBuilderBrandInfo struct {
	BrandID        string `json:"brandId"`
	DisplayName    string `json:"displayName"`
	EntityType     string `json:"entityType"`
	IdentityStatus string `json:"identityStatus"`
	TrustScore     int    `json:"trustScore"`
}

// CampaignBuilderUseCaseInfo represents use case requirements
type CampaignBuilderUseCaseInfo struct {
	UseCase             string   `json:"usecase"`
	DisplayName         string   `json:"name"`
	Description         string   `json:"description"`
	RequiredSamples     int      `json:"requiredSamples"`
	OptionalFields      []string `json:"optionalFields"`
	RecommendedSettings map[string]interface{} `json:"recommendedSettings"`
}

// TermsAndConditions represents T&Cs that user must accept
type TermsAndConditions struct {
	Version string `json:"version"`
	Text    string `json:"text"`
	URL     string `json:"url"`
}
