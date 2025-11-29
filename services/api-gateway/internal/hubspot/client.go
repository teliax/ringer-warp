package hubspot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"go.uber.org/zap"
)

const (
	HubSpotAPIBaseURL = "https://api.hubapi.com"
	RateLimitPerWindow = 100
	RateLimitWindow    = 10 * time.Second
)

// Client wraps the HubSpot CRM API v3
type Client struct {
	apiKey      string
	httpClient  *http.Client
	rateLimiter *RateLimiter
	logger      *zap.Logger
}

// RateLimiter implements token bucket algorithm for HubSpot's 100 req/10s limit
type RateLimiter struct {
	tokens    int
	maxTokens int
	mu        sync.Mutex
	ticker    *time.Ticker
}

// NewClient creates a new HubSpot API client
func NewClient(apiKey string, logger *zap.Logger) *Client {
	rateLimiter := &RateLimiter{
		tokens:    RateLimitPerWindow,
		maxTokens: RateLimitPerWindow,
	}

	// Refill tokens every second (10 tokens/second = 100 tokens/10 seconds)
	rateLimiter.ticker = time.NewTicker(time.Second)
	go func() {
		for range rateLimiter.ticker.C {
			rateLimiter.mu.Lock()
			if rateLimiter.tokens < rateLimiter.maxTokens {
				rateLimiter.tokens += 10 // Refill 10 tokens per second
				if rateLimiter.tokens > rateLimiter.maxTokens {
					rateLimiter.tokens = rateLimiter.maxTokens
				}
			}
			rateLimiter.mu.Unlock()
		}
	}()

	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		rateLimiter: rateLimiter,
		logger:      logger,
	}
}

// AllowRequest checks if a request is allowed based on rate limits
func (rl *RateLimiter) AllowRequest() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if rl.tokens > 0 {
		rl.tokens--
		return true
	}
	return false
}

// WaitForToken waits until a token is available
func (rl *RateLimiter) WaitForToken(ctx context.Context) error {
	for {
		if rl.AllowRequest() {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(100 * time.Millisecond):
			// Continue waiting
		}
	}
}

// doRequest performs an HTTP request with rate limiting
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
	// Wait for rate limit token
	if err := c.rateLimiter.WaitForToken(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait cancelled: %w", err)
	}

	url := HubSpotAPIBaseURL + path

	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HubSpot API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// GetCompany retrieves a company by ID
func (c *Client) GetCompany(ctx context.Context, companyID string) (*HubSpotCompany, error) {
	path := fmt.Sprintf("/crm/v3/objects/companies/%s", companyID)

	respData, err := c.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, err
	}

	var company HubSpotCompany
	if err := json.Unmarshal(respData, &company); err != nil {
		return nil, fmt.Errorf("failed to unmarshal company: %w", err)
	}

	return &company, nil
}

// CreateCompany creates a new company in HubSpot
func (c *Client) CreateCompany(ctx context.Context, properties map[string]interface{}) (*HubSpotCompany, error) {
	path := "/crm/v3/objects/companies"

	payload := map[string]interface{}{
		"properties": properties,
	}

	respData, err := c.doRequest(ctx, "POST", path, payload)
	if err != nil {
		return nil, err
	}

	var company HubSpotCompany
	if err := json.Unmarshal(respData, &company); err != nil {
		return nil, fmt.Errorf("failed to unmarshal company: %w", err)
	}

	c.logger.Info("Created company in HubSpot",
		zap.String("company_id", company.ID),
		zap.Any("properties", properties),
	)

	return &company, nil
}

// UpdateCompany updates company properties
func (c *Client) UpdateCompany(ctx context.Context, companyID string, properties map[string]interface{}) (*HubSpotCompany, error) {
	path := fmt.Sprintf("/crm/v3/objects/companies/%s", companyID)

	payload := map[string]interface{}{
		"properties": properties,
	}

	respData, err := c.doRequest(ctx, "PATCH", path, payload)
	if err != nil {
		return nil, err
	}

	var company HubSpotCompany
	if err := json.Unmarshal(respData, &company); err != nil {
		return nil, fmt.Errorf("failed to unmarshal company: %w", err)
	}

	c.logger.Info("Updated company in HubSpot",
		zap.String("company_id", companyID),
		zap.Int("properties_updated", len(properties)),
	)

	return &company, nil
}

// SearchCompaniesByDomain searches for companies by domain
func (c *Client) SearchCompaniesByDomain(ctx context.Context, domain string) ([]HubSpotCompany, error) {
	path := "/crm/v3/objects/companies/search"

	payload := map[string]interface{}{
		"filterGroups": []map[string]interface{}{
			{
				"filters": []map[string]interface{}{
					{
						"propertyName": "domain",
						"operator":     "EQ",
						"value":        domain,
					},
				},
			},
		},
	}

	respData, err := c.doRequest(ctx, "POST", path, payload)
	if err != nil {
		return nil, err
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

// BatchUpdateProperties updates multiple properties at once (more efficient)
func (c *Client) BatchUpdateProperties(ctx context.Context, companyID string, properties map[string]interface{}) error {
	_, err := c.UpdateCompany(ctx, companyID, properties)
	return err
	// Note: Could be optimized with HubSpot's batch API if needed
}

// GetCompanyContacts retrieves all contacts associated with a company
func (c *Client) GetCompanyContacts(ctx context.Context, companyID string) ([]HubSpotContact, error) {
	path := fmt.Sprintf("/crm/v3/objects/companies/%s/associations/contacts", companyID)

	respData, err := c.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, err
	}

	var associationResult struct {
		Results []struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		} `json:"results"`
	}

	if err := json.Unmarshal(respData, &associationResult); err != nil {
		return nil, fmt.Errorf("failed to unmarshal associations: %w", err)
	}

	// Fetch contact details for each association
	if len(associationResult.Results) == 0 {
		return []HubSpotContact{}, nil
	}

	// Build batch read request for contacts
	contactIDs := make([]string, len(associationResult.Results))
	for i, result := range associationResult.Results {
		contactIDs[i] = result.ID
	}

	// Get contacts in batch
	contactsPath := "/crm/v3/objects/contacts/batch/read"
	batchPayload := map[string]interface{}{
		"inputs": contactIDs,
		"properties": []string{
			"firstname",
			"lastname",
			"email",
			"phone",
			"jobtitle",
		},
	}

	contactsResp, err := c.doRequest(ctx, "POST", contactsPath, batchPayload)
	if err != nil {
		return nil, err
	}

	var contactsResult struct {
		Results []HubSpotContact `json:"results"`
	}

	if err := json.Unmarshal(contactsResp, &contactsResult); err != nil {
		return nil, fmt.Errorf("failed to unmarshal contacts: %w", err)
	}

	return contactsResult.Results, nil
}

// Close stops the rate limiter ticker
func (c *Client) Close() {
	if c.rateLimiter.ticker != nil {
		c.rateLimiter.ticker.Stop()
	}
}
