package tincomply

import (
	"context"
	"fmt"
	"net/http"
)

// LookupCompanyByEIN retrieves company information by EIN
func (c *Client) LookupCompanyByEIN(ctx context.Context, ein string) (*EINLookupResponse, error) {
	if ein == "" {
		return nil, fmt.Errorf("EIN cannot be empty")
	}

	// Prepare request payload
	payload := map[string]interface{}{
		"ein": ein,
	}

	// Make API request
	resp, err := c.doRequest(ctx, http.MethodPost, "/validate/company-name-lookup-by-ein", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup company by EIN: %w", err)
	}

	// Parse response
	var result EINLookupResponse
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// VerifyTINAndName verifies that a TIN matches a company name
func (c *Client) VerifyTINAndName(ctx context.Context, tin, companyName string) (*TINNameMatchResponse, error) {
	if tin == "" {
		return nil, fmt.Errorf("TIN cannot be empty")
	}
	if companyName == "" {
		return nil, fmt.Errorf("company name cannot be empty")
	}

	// Prepare request payload
	payload := map[string]interface{}{
		"tin":          tin,
		"company_name": companyName,
	}

	// Make API request
	resp, err := c.doRequest(ctx, http.MethodPost, "/validate/irs-tin-name-matching", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to verify TIN and name: %w", err)
	}

	// Parse response
	var result TINNameMatchResponse
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// LookupCompanyDetails retrieves detailed company information by name and address
func (c *Client) LookupCompanyDetails(ctx context.Context, req *CompanyDetailsRequest) (*CompanyDetailsResponse, error) {
	if req == nil || req.CompanyName == "" {
		return nil, fmt.Errorf("company name cannot be empty")
	}

	// Prepare request payload
	payload := map[string]interface{}{
		"company_name": req.CompanyName,
	}

	if req.Street != "" {
		payload["street"] = req.Street
	}
	if req.City != "" {
		payload["city"] = req.City
	}
	if req.State != "" {
		payload["state"] = req.State
	}
	if req.ZipCode != "" {
		payload["zip_code"] = req.ZipCode
	}

	// Make API request
	resp, err := c.doRequest(ctx, http.MethodPost, "/validate/company-details-lookup-by-name-address", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup company details: %w", err)
	}

	// Parse response
	var result CompanyDetailsResponse
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// FormatEIN formats an EIN string to standard format (XX-XXXXXXX)
func FormatEIN(ein string) string {
	// Remove any non-digit characters
	digits := ""
	for _, c := range ein {
		if c >= '0' && c <= '9' {
			digits += string(c)
		}
	}

	// Validate length
	if len(digits) != 9 {
		return ein // Return original if invalid
	}

	// Format as XX-XXXXXXX
	return fmt.Sprintf("%s-%s", digits[0:2], digits[2:9])
}

// ValidateEIN checks if an EIN is in valid format
func ValidateEIN(ein string) bool {
	// Remove any non-digit characters
	digits := ""
	for _, c := range ein {
		if c >= '0' && c <= '9' {
			digits += string(c)
		}
	}

	// Must be exactly 9 digits
	return len(digits) == 9
}
