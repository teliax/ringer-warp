// Package tcr - Webhook subscription and event types
package tcr

import (
	"context"
	"fmt"
	"net/http"
)

// =============================================================================
// WEBHOOK SUBSCRIPTION TYPES
// =============================================================================

// EventCategory represents TCR webhook event categories
type EventCategory string

const (
	EventCategoryBrand    EventCategory = "BRAND"
	EventCategoryCampaign EventCategory = "CAMPAIGN"
	EventCategoryVetting  EventCategory = "VETTING"
	EventCategoryCSP      EventCategory = "CSP"
	EventCategoryIncident EventCategory = "INCIDENCE"
)

// WebhookSubscription represents a webhook subscription request/response
type WebhookSubscription struct {
	EventCategory   EventCategory `json:"eventCategory"`
	WebhookEndpoint string        `json:"webhookEndpoint"`
}

// WebhookEventType represents an available event type
type WebhookEventType struct {
	EventType     string `json:"eventType"`
	Description   string `json:"description"`
	EventCategory string `json:"eventCategory"`
}

// WebhookTestResponse represents the response from testing a webhook
type WebhookTestResponse struct {
	Endpoint string `json:"endpoint"`
	Status   int    `json:"status"`
	Request  string `json:"request"`
	Response string `json:"response"`
}

// =============================================================================
// WEBHOOK EVENT PAYLOADS (Received from TCR)
// =============================================================================

// WebhookEvent represents a generic webhook event from TCR
type WebhookEvent struct {
	EventType       string                 `json:"eventType"`
	EventCategory   string                 `json:"eventCategory"`
	BrandID         string                 `json:"brandId,omitempty"`
	CampaignID      string                 `json:"campaignId,omitempty"`
	Timestamp       string                 `json:"timestamp,omitempty"`
	Status          string                 `json:"status,omitempty"`
	TrustScore      int                    `json:"trustScore,omitempty"`
	IdentityStatus  string                 `json:"brandIdentityStatus,omitempty"` // TCR sends brandIdentityStatus
	RejectionReason string                 `json:"rejectionReason,omitempty"`
	VettingID       string                 `json:"vettingId,omitempty"`   // Auth+ vetting ID
	MNOStatuses     map[string]string      `json:"mnoStatuses,omitempty"` // MNO ID -> Status
	RawPayload      map[string]interface{} `json:"-"`                     // Full payload for audit
}

// BrandWebhookEvent represents brand-specific webhook events
type BrandWebhookEvent struct {
	EventType      string `json:"eventType"` // E.g., BRAND_ADD, BRAND_UPDATE, BRAND_SCORE_UPDATE
	BrandID        string `json:"brandId"`
	Status         string `json:"status,omitempty"`              // SELF_DECLARED, VERIFIED, VETTED_VERIFIED
	IdentityStatus string `json:"brandIdentityStatus,omitempty"` // TCR sends brandIdentityStatus
	TrustScore     int    `json:"trustScore,omitempty"`
	Timestamp      string `json:"timestamp,omitempty"`
}

// CampaignWebhookEvent represents campaign-specific webhook events
type CampaignWebhookEvent struct {
	EventType       string            `json:"eventType"` // E.g., CAMPAIGN_SHARE_ADD, CAMPAIGN_SHARE_DELETE
	CampaignID      string            `json:"campaignId"`
	BrandID         string            `json:"brandId,omitempty"`
	Status          string            `json:"status,omitempty"` // ACTIVE, REVIEW, REJECTED, SUSPENDED
	MNOStatuses     map[string]string `json:"mnoStatuses,omitempty"`
	RejectionReason string            `json:"rejectionReason,omitempty"`
	Timestamp       string            `json:"timestamp,omitempty"`
}

// VettingWebhookEvent represents vetting completion events
type VettingWebhookEvent struct {
	EventType      string `json:"eventType"` // E.g., VETTING_COMPLETE
	BrandID        string `json:"brandId"`
	VettingStatus  string `json:"vettingStatus"`  // APPROVED, REJECTED
	VettingClass   string `json:"vettingClass"`   // STANDARD, POLITICAL
	TrustScore     int    `json:"trustScore,omitempty"`
	IdentityStatus string `json:"identityStatus,omitempty"`
	Timestamp      string `json:"timestamp,omitempty"`
}

// =============================================================================
// WEBHOOK CLIENT METHODS
// =============================================================================

// SubscribeWebhook subscribes to TCR webhooks for a specific event category
func (c *Client) SubscribeWebhook(ctx context.Context, category EventCategory, endpoint string) error {
	subscription := WebhookSubscription{
		EventCategory:   category,
		WebhookEndpoint: endpoint,
	}

	resp, err := c.doRequest(ctx, http.MethodPut, "/webhook/subscription", subscription)
	if err != nil {
		return fmt.Errorf("failed to subscribe to %s webhooks: %w", category, err)
	}

	return c.handleResponse(resp, nil)
}

// ListWebhookSubscriptions returns all active webhook subscriptions
func (c *Client) ListWebhookSubscriptions(ctx context.Context) ([]WebhookSubscription, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/webhook/subscription", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list webhook subscriptions: %w", err)
	}

	var subscriptions []WebhookSubscription
	if err := c.handleResponse(resp, &subscriptions); err != nil {
		return nil, err
	}

	return subscriptions, nil
}

// UnsubscribeWebhook removes webhook subscription for a specific category
func (c *Client) UnsubscribeWebhook(ctx context.Context, category EventCategory) error {
	path := fmt.Sprintf("/webhook/subscription/%s", category)
	resp, err := c.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return fmt.Errorf("failed to unsubscribe from %s webhooks: %w", category, err)
	}

	return c.handleResponse(resp, nil)
}

// ListEventTypes returns all available webhook event types
func (c *Client) ListEventTypes(ctx context.Context) ([]WebhookEventType, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/webhook/eventType", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list event types: %w", err)
	}

	var eventTypes []WebhookEventType
	if err := c.handleResponse(resp, &eventTypes); err != nil {
		return nil, err
	}

	return eventTypes, nil
}

// TestWebhook sends a mock webhook for testing
func (c *Client) TestWebhook(ctx context.Context, eventType string) (*WebhookTestResponse, error) {
	path := fmt.Sprintf("/webhook/subscription/eventType/%s/mock", eventType)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to test webhook for %s: %w", eventType, err)
	}

	var testResp WebhookTestResponse
	if err := c.handleResponse(resp, &testResp); err != nil {
		return nil, err
	}

	return &testResp, nil
}
