package tcr

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// =============================================================================
// CAMPAIGN OPERATIONS
// =============================================================================

// ListCampaigns retrieves a list of registered campaigns
func (c *Client) ListCampaigns(ctx context.Context, filters CampaignFilters) (*CampaignListResponse, error) {
	path := "/campaign"

	// Build query parameters
	params := url.Values{}
	if filters.Page > 0 {
		params.Add("page", fmt.Sprintf("%d", filters.Page))
	}
	if filters.RecordsPerPage > 0 {
		params.Add("recordsPerPage", fmt.Sprintf("%d", filters.RecordsPerPage))
	}
	if filters.BrandID != "" {
		params.Add("brandId", filters.BrandID)
	}
	if filters.ReferenceID != "" {
		params.Add("referenceId", filters.ReferenceID)
	}
	if filters.Status != "" {
		params.Add("status", filters.Status)
	}

	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var result CampaignListResponse
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetCampaign retrieves a single campaign by ID
func (c *Client) GetCampaign(ctx context.Context, campaignID string) (*Campaign, error) {
	path := fmt.Sprintf("/campaign/%s", campaignID)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var campaign Campaign
	if err := c.handleResponse(resp, &campaign); err != nil {
		return nil, err
	}

	return &campaign, nil
}

// CreateCampaign registers a new campaign with TCR
func (c *Client) CreateCampaign(ctx context.Context, req CampaignRequest) (*Campaign, error) {
	// Set sandbox mode if needed
	if c.sandbox {
		req.Mock = true
	}

	// Validate minimum requirements
	if err := validateCampaignRequest(req); err != nil {
		return nil, fmt.Errorf("invalid campaign request: %w", err)
	}

	path := "/campaign"

	resp, err := c.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}

	var campaign Campaign
	if err := c.handleResponse(resp, &campaign); err != nil {
		return nil, err
	}

	return &campaign, nil
}

// UpdateCampaign updates an existing campaign
func (c *Client) UpdateCampaign(ctx context.Context, campaignID string, updates map[string]interface{}) (*Campaign, error) {
	path := fmt.Sprintf("/campaign/%s", campaignID)

	resp, err := c.doRequest(ctx, http.MethodPatch, path, updates)
	if err != nil {
		return nil, err
	}

	var campaign Campaign
	if err := c.handleResponse(resp, &campaign); err != nil {
		return nil, err
	}

	return &campaign, nil
}

// GetCampaignOperationStatus retrieves per-MNO status for a campaign
func (c *Client) GetCampaignOperationStatus(ctx context.Context, campaignID string) (CampaignOperationStatus, error) {
	path := fmt.Sprintf("/campaign/%s/operationStatus", campaignID)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var status CampaignOperationStatus
	if err := c.handleResponse(resp, &status); err != nil {
		return nil, err
	}

	return status, nil
}

// ResubmitCampaign resubmits a rejected campaign
func (c *Client) ResubmitCampaign(ctx context.Context, campaignID string) error {
	path := fmt.Sprintf("/campaign/%s/resubmit", campaignID)

	resp, err := c.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return err
	}

	if err := c.handleResponse(resp, nil); err != nil {
		return err
	}

	return nil
}

// DeleteCampaign removes a campaign (if allowed by TCR)
func (c *Client) DeleteCampaign(ctx context.Context, campaignID string) error {
	path := fmt.Sprintf("/campaign/%s", campaignID)

	resp, err := c.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}

	if err := c.handleResponse(resp, nil); err != nil {
		return err
	}

	return nil
}

// =============================================================================
// CAMPAIGN BUILDER (Simplified Flow)
// =============================================================================

// GetCampaignBuilderBrandInfo retrieves brand info for campaign creation
func (c *Client) GetCampaignBuilderBrandInfo(ctx context.Context, brandID string) (*CampaignBuilderBrandInfo, error) {
	path := fmt.Sprintf("/campaignBuilder/brand/%s", brandID)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var info CampaignBuilderBrandInfo
	if err := c.handleResponse(resp, &info); err != nil {
		return nil, err
	}

	return &info, nil
}

// GetCampaignBuilderUseCaseInfo retrieves use case requirements
func (c *Client) GetCampaignBuilderUseCaseInfo(ctx context.Context, brandID, useCase string) (*CampaignBuilderUseCaseInfo, error) {
	path := fmt.Sprintf("/campaignBuilder/brand/%s/usecase/%s", brandID, useCase)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var info CampaignBuilderUseCaseInfo
	if err := c.handleResponse(resp, &info); err != nil {
		return nil, err
	}

	return &info, nil
}

// GetTermsAndConditions retrieves T&Cs for campaign submission
func (c *Client) GetTermsAndConditions(ctx context.Context) (*TermsAndConditions, error) {
	path := "/campaignBuilder/termsAndConditions"

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var terms TermsAndConditions
	if err := c.handleResponse(resp, &terms); err != nil {
		return nil, err
	}

	return &terms, nil
}

// =============================================================================
// CAMPAIGN VALIDATION HELPERS
// =============================================================================

// validateCampaignRequest validates campaign request before submission
func validateCampaignRequest(req CampaignRequest) error {
	if req.BrandID == "" {
		return fmt.Errorf("brandId is required")
	}

	if req.UseCase == "" {
		return fmt.Errorf("usecase is required")
	}

	if len(req.Description) < 40 {
		return fmt.Errorf("description must be at least 40 characters")
	}

	if len(req.MessageFlow) < 40 {
		return fmt.Errorf("messageFlow must be at least 40 characters")
	}

	if req.Sample1 == "" {
		return fmt.Errorf("at least one sample message is required")
	}

	if len(req.Sample1) < 20 || len(req.Sample1) > 1024 {
		return fmt.Errorf("sample messages must be 20-1024 characters")
	}

	return nil
}

// ValidateUseCase checks if use case is valid
func ValidateUseCase(useCase string) bool {
	validUseCases := []string{
		"2FA",
		"ACCOUNT_NOTIFICATION",
		"CUSTOMER_CARE",
		"DELIVERY_NOTIFICATION",
		"FRAUD_ALERT",
		"MARKETING",
		"POLLING_VOTING",
		"PUBLIC_SERVICE_ANNOUNCEMENT",
		"SECURITY_ALERT",
		"CHARITY",
		"POLITICAL",
		"SWEEPSTAKE",
		"EMERGENCY",
		"LOW_VOLUME",
		"HIGHER_EDUCATION",
		"K12_EDUCATION",
	}

	for _, valid := range validUseCases {
		if useCase == valid {
			return true
		}
	}
	return false
}

// GetUseCaseRequirements returns requirements for a specific use case
func GetUseCaseRequirements(useCase string) map[string]interface{} {
	requirements := map[string]interface{}{
		"description":     "Minimum 40 characters explaining campaign purpose",
		"messageFlow":     "Minimum 40 characters explaining user journey",
		"minimumSamples":  1,
		"maximumSamples":  5,
		"approvalRating":  "Easy",
		"optinRequired":   false,
		"optoutRequired":  true,
		"helpRequired":    true,
	}

	switch useCase {
	case "MARKETING":
		requirements["minimumSamples"] = 5
		requirements["approvalRating"] = "Medium"
		requirements["optinRequired"] = true
		requirements["notes"] = "Requires prior express written consent"

	case "POLITICAL":
		requirements["minimumSamples"] = 5
		requirements["approvalRating"] = "Hard"
		requirements["vettingRequired"] = true
		requirements["notes"] = "Requires POLITICAL vetting class"

	case "SWEEPSTAKE":
		requirements["minimumSamples"] = 5
		requirements["approvalRating"] = "Hard"
		requirements["notes"] = "Heavy compliance requirements"

	case "2FA":
		requirements["minimumSamples"] = 2
		requirements["approvalRating"] = "Easy"
		requirements["optinRequired"] = false
		requirements["notes"] = "Easiest to approve"

	case "ACCOUNT_NOTIFICATION":
		requirements["minimumSamples"] = 3
		requirements["approvalRating"] = "Easy"
		requirements["notes"] = "Transactional notifications"

	case "CUSTOMER_CARE":
		requirements["minimumSamples"] = 3
		requirements["approvalRating"] = "Easy"

	case "DELIVERY_NOTIFICATION":
		requirements["minimumSamples"] = 2
		requirements["approvalRating"] = "Easy"

	case "FRAUD_ALERT", "SECURITY_ALERT":
		requirements["minimumSamples"] = 2
		requirements["approvalRating"] = "Easy"
		requirements["notes"] = "Security-related messages"
	}

	return requirements
}

// GetThroughputLimits returns expected throughput based on brand trust score
func GetThroughputLimits(trustScore int, vetted bool) map[string]int {
	if vetted {
		return map[string]int{
			"messagesPerSecond": 75,
			"dailyCap":          200000,
		}
	}

	if trustScore >= 75 {
		// Verified brands
		return map[string]int{
			"messagesPerSecond": 15,
			"dailyCap":          40000,
		}
	} else if trustScore >= 50 {
		// Self-declared brands
		return map[string]int{
			"messagesPerSecond": 2,
			"dailyCap":          6000,
		}
	} else {
		// Unverified brands
		return map[string]int{
			"messagesPerSecond": 1, // ~0.75
			"dailyCap":          2000,
		}
	}
}

// ParseMNOStatus converts TCR MNO ID to name
func ParseMNOStatus(mnoID string) string {
	mnoNames := map[string]string{
		"10017": "T-Mobile",
		"10035": "AT&T",
		"10036": "Verizon",
	}

	if name, ok := mnoNames[mnoID]; ok {
		return name
	}
	return "Unknown MNO (" + mnoID + ")"
}

// IsApprovedByAllCarriers checks if campaign is registered with all major MNOs
func IsApprovedByAllCarriers(status CampaignOperationStatus) bool {
	majorMNOs := []string{"10017", "10035", "10036"} // T-Mobile, AT&T, Verizon

	for _, mnoID := range majorMNOs {
		if s, ok := status[mnoID]; !ok || s != "REGISTERED" {
			return false
		}
	}

	return true
}

// GetRejectedCarriers returns list of carriers that rejected the campaign
func GetRejectedCarriers(status CampaignOperationStatus) []string {
	var rejected []string

	for mnoID, s := range status {
		if s == "REJECTED" {
			rejected = append(rejected, ParseMNOStatus(mnoID))
		}
	}

	return rejected
}
