package soa

import (
	"fmt"
	"net/http"
)

// APIError represents an error response from the SOA API
type APIError struct {
	StatusCode int                    `json:"-"`
	Error_     string                 `json:"error,omitempty"`
	Message    string                 `json:"message,omitempty"`
	Timestamp  string                 `json:"timestamp,omitempty"`
	Path       string                 `json:"path,omitempty"`

	// Query-specific error fields
	Query        string   `json:"query,omitempty"`
	Position     int      `json:"position,omitempty"`
	ValidOptions []string `json:"validOptions,omitempty"`
}

// Error implements the error interface
func (e *APIError) Error() string {
	msg := e.Message
	if msg == "" {
		msg = e.Error_
	}
	if msg == "" {
		msg = "unknown error"
	}
	return fmt.Sprintf("SOA API error (HTTP %d): %s", e.StatusCode, msg)
}

// IsNotFound returns true if the error is a 404 Not Found
func IsNotFound(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == http.StatusNotFound
	}
	return false
}

// IsConflict returns true if the error is a 409 Conflict
// This occurs when trying to reserve/assign a number that's not in a valid state
func IsConflict(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == http.StatusConflict
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

// IsUnauthorized returns true if the error is a 401 Unauthorized
func IsUnauthorized(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == http.StatusUnauthorized
	}
	return false
}

// IsForbidden returns true if the error is a 403 Forbidden
func IsForbidden(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == http.StatusForbidden
	}
	return false
}

// IsServerError returns true if the error is a 5xx server error
func IsServerError(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode >= 500
	}
	return false
}

// ErrNumberNotAvailable is returned when trying to reserve/assign a number that's not available
type ErrNumberNotAvailable struct {
	TelephoneNumber string
	CurrentStatus   NumberStatus
}

func (e *ErrNumberNotAvailable) Error() string {
	return fmt.Sprintf("number %s is not available (current status: %s)", e.TelephoneNumber, e.CurrentStatus)
}

// ErrNumberNotFound is returned when a number doesn't exist in SOA
type ErrNumberNotFound struct {
	TelephoneNumber string
}

func (e *ErrNumberNotFound) Error() string {
	return fmt.Sprintf("number %s not found in SOA inventory", e.TelephoneNumber)
}

// ErrSOAUnavailable is returned when SOA API is not reachable
type ErrSOAUnavailable struct {
	Err error
}

func (e *ErrSOAUnavailable) Error() string {
	return fmt.Sprintf("SOA API unavailable: %v", e.Err)
}

func (e *ErrSOAUnavailable) Unwrap() error {
	return e.Err
}
