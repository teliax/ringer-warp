// Package tincomply provides a client for TinComply API (EIN/Tax ID verification)
// See: https://www.tincomply.com/help-center/api
package tincomply

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
	// DefaultBaseURL is the production TinComply API base URL
	DefaultBaseURL = "https://www.tincomply.com/api"

	// DefaultTimeout is the HTTP client timeout
	DefaultTimeout = 30 * time.Second

	// DefaultRetries is the number of retry attempts for failed requests
	DefaultRetries = 3
)

// Client represents a TinComply API client
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// Config holds the TinComply client configuration
type Config struct {
	APIKey  string
	BaseURL string        // Optional: override default
	Timeout time.Duration // Optional: override default
}

// NewClient creates a new TinComply API client
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
		baseURL: baseURL,
		apiKey:  cfg.APIKey,
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
	req.Header.Set("X-API-Key", c.apiKey)
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
			return fmt.Errorf("API error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
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

// APIError represents a TinComply API error response
type APIError struct {
	StatusCode int                    `json:"-"`
	Code       string                 `json:"code,omitempty"`
	Message    string                 `json:"message,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("TinComply API error (HTTP %d): %s - %s", e.StatusCode, e.Code, e.Message)
	}
	return fmt.Sprintf("TinComply API error (HTTP %d): %s", e.StatusCode, e.Message)
}

// IsNotFound returns true if the error is a 404 Not Found
func IsNotFound(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == http.StatusNotFound
	}
	return false
}

// IsBadRequest returns true if the error is a 400 Bad Request
func IsBadRequest(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == http.StatusBadRequest
	}
	return false
}
