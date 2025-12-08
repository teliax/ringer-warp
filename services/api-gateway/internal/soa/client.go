// Package soa provides a client for the Ringer SOA Number Inventory API
// This implements JIT (Just-In-Time) provisioning - numbers are searched, reserved,
// and assigned in real-time from the upstream SOA provider.
//
// See: ringer-soa/docs/api-specs/openapi/inventory-api.yaml
package soa

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	// DefaultBaseURL is the production SOA API base URL
	DefaultBaseURL = "https://soa-api.ringer.tel/api/v1"

	// DefaultTimeout is the HTTP client timeout
	DefaultTimeout = 30 * time.Second

	// DefaultRetries is the number of retry attempts for failed requests
	DefaultRetries = 3
)

// Client represents a SOA API client for number inventory operations
type Client struct {
	baseURL    string
	apiToken   string
	httpClient *http.Client
}

// Config holds the SOA client configuration
type Config struct {
	APIToken string        // Bearer token (rng_xxx format)
	BaseURL  string        // Optional: override default
	Timeout  time.Duration // Optional: override default
}

// NewClient creates a new SOA API client
func NewClient(cfg Config) *Client {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}

	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = DefaultTimeout
	}

	return &Client{
		baseURL:  baseURL,
		apiToken: cfg.APIToken,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// doRequest executes an HTTP request with authentication and error handling
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	url := c.baseURL + path

	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Execute request with retries
	var resp *http.Response
	var lastErr error

	for attempt := 0; attempt <= DefaultRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		resp, lastErr = c.httpClient.Do(req)
		if lastErr != nil {
			continue // Network error, retry
		}

		// Success or non-retriable error
		if resp.StatusCode < 500 {
			break // Don't retry client errors or success
		}

		// Server error, retry
		resp.Body.Close()
	}

	if lastErr != nil {
		return nil, fmt.Errorf("request failed after %d attempts: %w", DefaultRetries+1, lastErr)
	}

	return resp, nil
}

// handleResponse processes the HTTP response and unmarshals JSON
func (c *Client) handleResponse(resp *http.Response, result interface{}) error {
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for HTTP errors
	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.Unmarshal(bodyBytes, &apiErr); err != nil {
			// Response is not JSON, return generic error
			return &APIError{
				StatusCode: resp.StatusCode,
				Message:    string(bodyBytes),
			}
		}
		apiErr.StatusCode = resp.StatusCode
		return &apiErr
	}

	// Success - unmarshal into result
	if result != nil && len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w (body: %s)", err, string(bodyBytes))
		}
	}

	return nil
}

// QueryInventory searches for available numbers using the SOA query language
// Example queries:
//   - "status=available" - Find all available numbers
//   - "status=available and npa=303" - Available numbers in area code 303
//   - "status=available and lata=656" - Available numbers in LATA 656
func (c *Client) QueryInventory(ctx context.Context, req *QueryRequest) (*QueryResponse, error) {
	resp, err := c.doRequest(ctx, http.MethodPost, "/inventory/query", req)
	if err != nil {
		return nil, err
	}

	var result QueryResponse
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetInventorySummary retrieves aggregate statistics for a SPID's inventory
func (c *Client) GetInventorySummary(ctx context.Context, spid string) (*InventorySummary, error) {
	path := fmt.Sprintf("/inventory/summary?spid=%s", spid)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var result InventorySummary
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetNumberDetails retrieves complete details for a specific telephone number
// Note: Use QueryInventory with tn filter for numbers that may have been ported
func (c *Client) GetNumberDetails(ctx context.Context, telephoneNumber string) (*NumberInventory, error) {
	path := fmt.Sprintf("/inventory/numbers/%s", telephoneNumber)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var result NumberInventory
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ReserveNumber temporarily reserves a number for an application
// Status transition: AVAILABLE → RESERVED
func (c *Client) ReserveNumber(ctx context.Context, telephoneNumber string, reservedBy string) (*NumberInventory, error) {
	path := fmt.Sprintf("/inventory/numbers/%s/reserve", telephoneNumber)
	body := map[string]string{"reservedBy": reservedBy}

	resp, err := c.doRequest(ctx, http.MethodPost, path, body)
	if err != nil {
		return nil, err
	}

	var result NumberInventory
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// AssignNumber assigns a number to an application with custom metadata
// Status transition: AVAILABLE or RESERVED → IN_USE
func (c *Client) AssignNumber(ctx context.Context, telephoneNumber string, req *AssignRequest) (*NumberInventory, error) {
	path := fmt.Sprintf("/inventory/numbers/%s/assign", telephoneNumber)

	resp, err := c.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}

	var result NumberInventory
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// UpdateMetadata updates custom metadata for an assigned number
// Number must be in IN_USE status
func (c *Client) UpdateMetadata(ctx context.Context, telephoneNumber string, metadata map[string]interface{}) (*NumberInventory, error) {
	path := fmt.Sprintf("/inventory/numbers/%s/metadata", telephoneNumber)
	body := map[string]interface{}{"metadata": metadata}

	resp, err := c.doRequest(ctx, http.MethodPut, path, body)
	if err != nil {
		return nil, err
	}

	var result NumberInventory
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ReleaseNumber releases a number back to the pool
// Status transition: RESERVED or IN_USE → RESERVED (per plan - not AVAILABLE)
// Note: We set to RESERVED for grooming/audit purposes, not AVAILABLE
func (c *Client) ReleaseNumber(ctx context.Context, telephoneNumber string) (*NumberInventory, error) {
	path := fmt.Sprintf("/inventory/numbers/%s/release", telephoneNumber)

	resp, err := c.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}

	var result NumberInventory
	if err := c.handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// SearchAvailableNumbers is a convenience method for searching available numbers
// by area code (NPA) or state
func (c *Client) SearchAvailableNumbers(ctx context.Context, opts SearchOptions) (*QueryResponse, error) {
	query := "status=available"

	if opts.NPA != "" {
		query += fmt.Sprintf(" and npa=%s", opts.NPA)
	}
	if opts.NXX != "" {
		query += fmt.Sprintf(" and nxx=%s", opts.NXX)
	}
	if opts.State != "" {
		query += fmt.Sprintf(" and state=%s", opts.State)
	}
	if opts.LATA != "" {
		query += fmt.Sprintf(" and lata=%s", opts.LATA)
	}
	if opts.RateCenter != "" {
		query += fmt.Sprintf(" and locality contains \"%s\"", opts.RateCenter)
	}

	req := &QueryRequest{
		Query:         query,
		Page:          opts.Page,
		Size:          opts.Size,
		SortBy:        "telephoneNumber",
		SortDirection: "ASC",
	}

	if req.Size == 0 {
		req.Size = 50 // Default page size
	}

	return c.QueryInventory(ctx, req)
}

// SearchOptions provides search filters for SearchAvailableNumbers
type SearchOptions struct {
	NPA        string // Area code (e.g., "303")
	NXX        string // Exchange (e.g., "555")
	State      string // State code (e.g., "CO")
	LATA       string // LATA number (e.g., "656")
	RateCenter string // Rate center name (partial match)
	Page       int    // Page number (0-indexed)
	Size       int    // Page size (default 50)
}
