package tcr

import (
	"context"
	"net/http"
)

// =============================================================================
// ENUMERATION OPERATIONS - Get Valid Values
// =============================================================================

// GetUseCases retrieves all available campaign use cases
func (c *Client) GetUseCases(ctx context.Context) ([]UseCase, error) {
	path := "/enum/usecase"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var useCases []UseCase
	if err := c.handleResponse(resp, &useCases); err != nil {
		return nil, err
	}

	return useCases, nil
}

// GetEntityTypes retrieves all valid entity types for brands
func (c *Client) GetEntityTypes(ctx context.Context) ([]EntityType, error) {
	path := "/enum/entityType"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var entityTypes []EntityType
	if err := c.handleResponse(resp, &entityTypes); err != nil {
		return nil, err
	}

	return entityTypes, nil
}

// GetVerticals retrieves all industry verticals
func (c *Client) GetVerticals(ctx context.Context) ([]Vertical, error) {
	path := "/enum/vertical"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	// TCR returns verticals as an object: {"TECHNOLOGY": {...}, "COMMUNICATION": {...}}
	var verticalsMap map[string]struct {
		IndustryID  string `json:"industryId"`
		DisplayName string `json:"displayName"`
		Description string `json:"description"`
	}

	if err := c.handleResponse(resp, &verticalsMap); err != nil {
		return nil, err
	}

	// Convert map to array
	verticals := make([]Vertical, 0, len(verticalsMap))
	for code, details := range verticalsMap {
		verticals = append(verticals, Vertical{
			Code:        code,
			DisplayName: details.DisplayName,
			Description: details.Description,
		})
	}

	return verticals, nil
}

// GetMNOs retrieves all participating Mobile Network Operators
func (c *Client) GetMNOs(ctx context.Context) ([]MNO, error) {
	path := "/enum/mno"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var mnos []MNO
	if err := c.handleResponse(resp, &mnos); err != nil {
		return nil, err
	}

	return mnos, nil
}

// GetCampaignStatuses retrieves all campaign status values
func (c *Client) GetCampaignStatuses(ctx context.Context) ([]CampaignStatus, error) {
	path := "/enum/campaignStatus"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var statuses []CampaignStatus
	if err := c.handleResponse(resp, &statuses); err != nil {
		return nil, err
	}

	return statuses, nil
}

// GetBrandIdentityStatuses retrieves all brand verification statuses
func (c *Client) GetBrandIdentityStatuses(ctx context.Context) ([]BrandIdentityStatus, error) {
	path := "/enum/brandIdentityStatus"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var statuses []BrandIdentityStatus
	if err := c.handleResponse(resp, &statuses); err != nil {
		return nil, err
	}

	return statuses, nil
}

// GetExtVettingProviders retrieves list of external vetting providers
func (c *Client) GetExtVettingProviders(ctx context.Context) ([]string, error) {
	path := "/enum/extVettingProvider"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var providers []string
	if err := c.handleResponse(resp, &providers); err != nil {
		return nil, err
	}

	return providers, nil
}

// =============================================================================
// STATIC ENUMERATION DATA (Fallback)
// =============================================================================

// GetStaticUseCases returns static list of common use cases (fallback)
func GetStaticUseCases() []UseCase {
	return []UseCase{
		{Code: "2FA", DisplayName: "Two-Factor Authentication", Description: "OTP codes and 2FA messages"},
		{Code: "ACCOUNT_NOTIFICATION", DisplayName: "Account Notifications", Description: "Account alerts and updates"},
		{Code: "CUSTOMER_CARE", DisplayName: "Customer Care", Description: "Support and service messages"},
		{Code: "DELIVERY_NOTIFICATION", DisplayName: "Delivery Notifications", Description: "Shipping and delivery updates"},
		{Code: "FRAUD_ALERT", DisplayName: "Fraud Alerts", Description: "Fraud and security alerts"},
		{Code: "MARKETING", DisplayName: "Marketing", Description: "Promotional messages"},
		{Code: "POLLING_VOTING", DisplayName: "Polling and Voting", Description: "Surveys and polls"},
		{Code: "PUBLIC_SERVICE_ANNOUNCEMENT", DisplayName: "Public Service Announcements", Description: "Emergency and PSA messages"},
		{Code: "SECURITY_ALERT", DisplayName: "Security Alerts", Description: "Security notifications"},
		{Code: "CHARITY", DisplayName: "Charity", Description: "Non-profit fundraising"},
		{Code: "POLITICAL", DisplayName: "Political", Description: "Political campaigns"},
		{Code: "SWEEPSTAKE", DisplayName: "Sweepstakes", Description: "Contests and giveaways"},
	}
}

// GetStaticEntityTypes returns static list of entity types (fallback)
func GetStaticEntityTypes() []EntityType {
	return []EntityType{
		{Code: "PRIVATE_PROFIT", DisplayName: "Private Company", Description: "Privately held for-profit company"},
		{Code: "PUBLIC_PROFIT", DisplayName: "Public Company", Description: "Publicly traded company"},
		{Code: "NON_PROFIT", DisplayName: "Non-Profit", Description: "501(c)(3) organization"},
		{Code: "GOVERNMENT", DisplayName: "Government", Description: "Government entity"},
		{Code: "SOLE_PROPRIETOR", DisplayName: "Sole Proprietor", Description: "Individual/small business"},
	}
}

// GetStaticVerticals returns static list of industry verticals (fallback)
// Based on TCR's official /enum/vertical response
func GetStaticVerticals() []Vertical {
	return []Vertical{
		{Code: "PROFESSIONAL", DisplayName: "Professional Services"},
		{Code: "TECHNOLOGY", DisplayName: "Information Technology Services"},
		{Code: "COMMUNICATION", DisplayName: "Media and Communication"},
		{Code: "RETAIL", DisplayName: "Retail and Consumer Products"},
		{Code: "HEALTHCARE", DisplayName: "Healthcare and Life Sciences"},
		{Code: "FINANCIAL", DisplayName: "Financial Services"},
		{Code: "REAL_ESTATE", DisplayName: "Real Estate"},
		{Code: "HOSPITALITY", DisplayName: "Hospitality and Travel"},
		{Code: "TRANSPORTATION", DisplayName: "Transportation or Logistics"},
		{Code: "EDUCATION", DisplayName: "Education"},
		{Code: "ENTERTAINMENT", DisplayName: "Entertainment"},
		{Code: "INSURANCE", DisplayName: "Insurance"},
		{Code: "LEGAL", DisplayName: "Legal"},
		{Code: "CONSTRUCTION", DisplayName: "Construction, Materials, and Trade Services"},
		{Code: "MANUFACTURING", DisplayName: "Manufacturing"},
		{Code: "AGRICULTURE", DisplayName: "Agriculture"},
		{Code: "ENERGY", DisplayName: "Energy and Utilities"},
		{Code: "POSTAL", DisplayName: "Postal and Delivery"},
		{Code: "POLITICAL", DisplayName: "Political"},
		{Code: "GAMBLING", DisplayName: "Gambling and Lottery"},
		{Code: "NGO", DisplayName: "Non-profit Organization"},
		{Code: "GOVERNMENT", DisplayName: "Government Services and Agencies"},
		{Code: "HUMAN_RESOURCES", DisplayName: "HR, Staffing or Recruitment"},
	}
}

// GetStaticMNOs returns static list of major MNOs (fallback)
func GetStaticMNOs() []MNO {
	return []MNO{
		{MNOID: "10017", Name: "T-Mobile USA"},
		{MNOID: "10035", Name: "AT&T Mobility"},
		{MNOID: "10036", Name: "Verizon Wireless"},
		{MNOID: "10037", Name: "US Cellular"},
		{MNOID: "10038", Name: "Cricket Wireless"},
	}
}

// GetStaticCampaignStatuses returns static list of campaign statuses (fallback)
func GetStaticCampaignStatuses() []CampaignStatus {
	return []CampaignStatus{
		{Code: "ACTIVE", DisplayName: "Active"},
		{Code: "REVIEW", DisplayName: "Under Review"},
		{Code: "REJECTED", DisplayName: "Rejected"},
		{Code: "SUSPENDED", DisplayName: "Suspended"},
		{Code: "EXPIRED", DisplayName: "Expired"},
	}
}

// GetStaticBrandIdentityStatuses returns static list of brand statuses (fallback)
func GetStaticBrandIdentityStatuses() []BrandIdentityStatus {
	return []BrandIdentityStatus{
		{Code: "SELF_DECLARED", DisplayName: "Self Declared"},
		{Code: "UNVERIFIED", DisplayName: "Unverified"},
		{Code: "VERIFIED", DisplayName: "Verified"},
		{Code: "VETTED_VERIFIED", DisplayName: "Vetted and Verified"},
	}
}
