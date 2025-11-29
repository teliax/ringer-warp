package hubspot

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"time"
)

// SignatureValidator validates HubSpot webhook signatures
type SignatureValidator struct {
	webhookSecret string
}

// NewSignatureValidator creates a new signature validator
func NewSignatureValidator(webhookSecret string) *SignatureValidator {
	return &SignatureValidator{
		webhookSecret: webhookSecret,
	}
}

// ValidateSignature validates the HubSpot webhook signature
// HubSpot uses HMAC-SHA256 with the webhook secret
func (sv *SignatureValidator) ValidateSignature(signature string, body []byte, timestamp string) (bool, error) {
	// Verify timestamp is recent (within 5 minutes to prevent replay attacks)
	if timestamp != "" {
		webhookTime, err := time.Parse(time.RFC3339, timestamp)
		if err == nil {
			age := time.Since(webhookTime)
			if age > 5*time.Minute || age < -1*time.Minute {
				return false, fmt.Errorf("webhook timestamp too old or in future: %v", age)
			}
		}
	}

	// Calculate expected signature
	// HubSpot signature format: sha256=<hex-encoded-hmac>
	expectedSignature := sv.calculateSignature(body)

	// Compare signatures (constant-time comparison)
	return hmac.Equal([]byte(signature), []byte(expectedSignature)), nil
}

// ValidateSignatureV2 validates using HubSpot's v2 signature method
// v2 format: method + uri + body
func (sv *SignatureValidator) ValidateSignatureV2(signature string, method, uri string, body []byte, timestamp string) (bool, error) {
	// Verify timestamp
	if timestamp != "" {
		webhookTime, err := time.Parse(time.RFC3339, timestamp)
		if err == nil {
			age := time.Since(webhookTime)
			if age > 5*time.Minute || age < -1*time.Minute {
				return false, fmt.Errorf("webhook timestamp too old or in future: %v", age)
			}
		}
	}

	// HubSpot v2 signature: HMAC-SHA256(method + uri + body)
	data := method + uri + string(body)
	expectedSignature := sv.calculateSignatureRaw([]byte(data))

	return hmac.Equal([]byte(signature), []byte(expectedSignature)), nil
}

// calculateSignature computes HMAC-SHA256 signature
func (sv *SignatureValidator) calculateSignature(body []byte) string {
	mac := hmac.New(sha256.New, []byte(sv.webhookSecret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// calculateSignatureRaw computes raw HMAC-SHA256 without prefix
func (sv *SignatureValidator) calculateSignatureRaw(data []byte) string {
	mac := hmac.New(sha256.New, []byte(sv.webhookSecret))
	mac.Write(data)
	return hex.EncodeToString(mac.Sum(nil))
}

// ReadAndValidate reads request body and validates signature
func (sv *SignatureValidator) ReadAndValidate(body io.Reader, signature, timestamp string) ([]byte, bool, error) {
	bodyBytes, err := io.ReadAll(body)
	if err != nil {
		return nil, false, fmt.Errorf("failed to read body: %w", err)
	}

	valid, err := sv.ValidateSignature(signature, bodyBytes, timestamp)
	if err != nil {
		return bodyBytes, false, err
	}

	return bodyBytes, valid, nil
}
