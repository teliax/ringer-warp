package hubspot

import (
	"context"
	"encoding/json"
	"fmt"
)

// SearchCompanies searches for companies by name
func (c *Client) SearchCompanies(ctx context.Context, searchTerm string, limit int) ([]HubSpotCompany, error) {
	path := "/crm/v3/objects/companies/search"

	if limit <= 0 || limit > 100 {
		limit = 10
	}

	payload := map[string]interface{}{
		"filterGroups": []map[string]interface{}{
			{
				"filters": []map[string]interface{}{
					{
						"propertyName": "name",
						"operator":     "CONTAINS_TOKEN",
						"value":        searchTerm,
					},
				},
			},
		},
		"limit": limit,
		"properties": []string{
			"name",
			"domain",
			"phone",
			"city",
			"state",
			"zip",
			"country",
			"warp_ban",
			"warp_status",
			"warp_credit_limit",
			"warp_customer_type",
		},
	}

	respData, err := c.doRequest(ctx, "POST", path, payload)
	if err != nil {
		return nil, fmt.Errorf("failed to search companies: %w", err)
	}

	var searchResult struct {
		Results []HubSpotCompany `json:"results"`
		Total   int              `json:"total"`
	}

	if err := json.Unmarshal(respData, &searchResult); err != nil {
		return nil, fmt.Errorf("failed to unmarshal search results: %w", err)
	}

	return searchResult.Results, nil
}

// HubSpotCompanySearchResult represents a simplified search result for UI
type HubSpotCompanySearchResult struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Domain     string                 `json:"domain,omitempty"`
	Phone      string                 `json:"phone,omitempty"`
	City       string                 `json:"city,omitempty"`
	State      string                 `json:"state,omitempty"`
	Properties map[string]interface{} `json:"properties"`
}

// SearchCompaniesForAutocomplete returns simplified results for autocomplete
func (c *Client) SearchCompaniesForAutocomplete(ctx context.Context, searchTerm string) ([]HubSpotCompanySearchResult, error) {
	companies, err := c.SearchCompanies(ctx, searchTerm, 10)
	if err != nil {
		return nil, err
	}

	results := make([]HubSpotCompanySearchResult, len(companies))
	for i, company := range companies {
		results[i] = HubSpotCompanySearchResult{
			ID:         company.ID,
			Name:       getString(company.Properties, "name"),
			Domain:     getString(company.Properties, "domain"),
			Phone:      getString(company.Properties, "phone"),
			City:       getString(company.Properties, "city"),
			State:      getString(company.Properties, "state"),
			Properties: company.Properties,
		}
	}

	return results, nil
}

// getString safely extracts a string value from properties map
func getString(props map[string]interface{}, key string) string {
	if val, ok := props[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}
