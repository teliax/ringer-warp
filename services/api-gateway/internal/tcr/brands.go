package tcr

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// =============================================================================
// BRAND OPERATIONS
// =============================================================================

// ListBrands retrieves a list of registered brands
func (c *Client) ListBrands(ctx context.Context, filters BrandFilters) (*BrandListResponse, error) {
	path := "/brand"

	// Build query parameters
	params := url.Values{}
	if filters.Page > 0 {
		params.Add("page", fmt.Sprintf("%d", filters.Page))
	}
	if filters.RecordsPerPage > 0 {
		params.Add("recordsPerPage", fmt.Sprintf("%d", filters.RecordsPerPage))
	}
	if filters.ReferenceID != "" {
		params.Add("referenceId", filters.ReferenceID)
	}
	if filters.DisplayName != "" {
		params.Add("displayName", filters.DisplayName)
	}
	if filters.Country != "" {
		params.Add("country", filters.Country)
	}

	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var result BrandListResponse
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetBrand retrieves a single brand by ID
func (c *Client) GetBrand(ctx context.Context, brandID string) (*Brand, error) {
	path := fmt.Sprintf("/brand/%s", brandID)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var brand Brand
	if err := c.handleResponse(resp, &brand); err != nil {
		return nil, err
	}

	return &brand, nil
}

// CreateBrand registers a new brand with TCR
func (c *Client) CreateBrand(ctx context.Context, req BrandRequest) (*Brand, error) {
	// Set sandbox mode if needed
	if c.sandbox {
		req.Mock = true
	}

	// Use nonBlocking endpoint for async brand registration
	path := "/brand/nonBlocking"

	resp, err := c.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}

	var brand Brand
	if err := c.handleResponse(resp, &brand); err != nil {
		return nil, err
	}

	return &brand, nil
}

// UpdateBrand updates an existing brand
func (c *Client) UpdateBrand(ctx context.Context, brandID string, updates map[string]interface{}) (*Brand, error) {
	path := fmt.Sprintf("/brand/%s", brandID)

	resp, err := c.doRequest(ctx, http.MethodPut, path, updates)
	if err != nil {
		return nil, err
	}

	var brand Brand
	if err := c.handleResponse(resp, &brand); err != nil {
		return nil, err
	}

	return &brand, nil
}

// RequestExternalVetting submits a brand for third-party vetting
func (c *Client) RequestExternalVetting(ctx context.Context, brandID string, req VettingRequest) error {
	path := fmt.Sprintf("/brand/%s/externalVetting", brandID)

	resp, err := c.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return err
	}

	if err := c.handleResponse(resp, nil); err != nil {
		return err
	}

	return nil
}

// GetBrandFeedback retrieves feedback for a rejected brand
func (c *Client) GetBrandFeedback(ctx context.Context, brandID string) (map[string]interface{}, error) {
	path := fmt.Sprintf("/brand/feedback/%s", brandID)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var feedback map[string]interface{}
	if err := c.handleResponse(resp, &feedback); err != nil {
		return nil, err
	}

	return feedback, nil
}

// DeleteBrand removes a brand (if allowed by TCR)
func (c *Client) DeleteBrand(ctx context.Context, brandID string) error {
	path := fmt.Sprintf("/brand/%s", brandID)

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
// BRAND VETTING HELPERS
// =============================================================================

// VettingProviders returns the list of supported vetting providers
func (c *Client) VettingProviders(ctx context.Context) ([]string, error) {
	// This would call GET /enum/extVettingProvider
	// Hardcoded for now based on documentation
	return []string{"AEGIS", "WMC"}, nil
}

// EstimateVettingCost returns estimated cost for brand vetting
func EstimateVettingCost(vettingClass string) int {
	switch vettingClass {
	case "STANDARD":
		return 40 // $40 USD
	case "POLITICAL":
		return 500 // $500 USD
	default:
		return 40
	}
}

// =============================================================================
// BRAND VALIDATION HELPERS
// =============================================================================

// ValidateEntityType checks if entity type is valid
func ValidateEntityType(entityType string) bool {
	validTypes := []string{
		"PRIVATE_PROFIT",
		"PUBLIC_PROFIT",
		"NON_PROFIT",
		"GOVERNMENT",
		"SOLE_PROPRIETOR",
	}

	for _, valid := range validTypes {
		if entityType == valid {
			return true
		}
	}
	return false
}

// ValidateBrandRelationship checks if brand relationship is valid
func ValidateBrandRelationship(relationship string) bool {
	return relationship == "DIRECT_CUSTOMER" || relationship == "RESELLER"
}

// RequiresExternalVetting returns true if the entity type typically requires external vetting
func RequiresExternalVetting(entityType string) bool {
	return entityType == "PRIVATE_PROFIT" || entityType == "NON_PROFIT"
}

// GetExpectedTrustScore returns expected trust score range for entity type
func GetExpectedTrustScore(entityType string, hasStockSymbol bool, vetted bool) (min, max int) {
	if vetted {
		return 75, 100 // Vetted brands get highest scores
	}

	switch entityType {
	case "PUBLIC_PROFIT":
		if hasStockSymbol {
			return 75, 100 // Automatically verified
		}
		return 50, 75
	case "GOVERNMENT":
		return 75, 100 // Usually auto-verified
	case "PRIVATE_PROFIT", "NON_PROFIT":
		return 25, 50 // Self-declared, lower trust
	case "SOLE_PROPRIETOR":
		return 10, 25 // Lowest trust tier
	default:
		return 0, 0
	}
}
