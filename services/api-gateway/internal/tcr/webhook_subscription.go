package tcr

import (
	"context"
	"fmt"

	"go.uber.org/zap"
)

// WebhookSubscriptionManager manages TCR webhook subscriptions
type WebhookSubscriptionManager struct {
	client *Client
	logger *zap.Logger
}

// NewWebhookSubscriptionManager creates a new webhook subscription manager
func NewWebhookSubscriptionManager(client *Client, logger *zap.Logger) *WebhookSubscriptionManager {
	return &WebhookSubscriptionManager{
		client: client,
		logger: logger,
	}
}

// SubscribeAllEvents subscribes to all TCR events we care about
func (m *WebhookSubscriptionManager) SubscribeAllEvents(ctx context.Context, baseURL string) error {
	// Subscribe to BRAND events
	if err := m.subscribeCategory(ctx, EventCategoryBrand, baseURL+"/webhooks/tcr/brands"); err != nil {
		return fmt.Errorf("failed to subscribe to BRAND events: %w", err)
	}

	// Subscribe to CAMPAIGN events
	if err := m.subscribeCategory(ctx, EventCategoryCampaign, baseURL+"/webhooks/tcr/campaigns"); err != nil {
		return fmt.Errorf("failed to subscribe to CAMPAIGN events: %w", err)
	}

	// Subscribe to VETTING events
	if err := m.subscribeCategory(ctx, EventCategoryVetting, baseURL+"/webhooks/tcr/vetting"); err != nil {
		return fmt.Errorf("failed to subscribe to VETTING events: %w", err)
	}

	m.logger.Info("Successfully subscribed to all TCR webhooks",
		zap.String("base_url", baseURL),
	)

	return nil
}

// subscribeCategory subscribes to a specific event category
func (m *WebhookSubscriptionManager) subscribeCategory(ctx context.Context, category EventCategory, endpoint string) error {
	// Check if already subscribed
	subscriptions, err := m.client.ListWebhookSubscriptions(ctx)
	if err != nil {
		m.logger.Warn("Failed to list existing subscriptions, continuing anyway",
			zap.Error(err),
		)
	} else {
		// Check if already subscribed to this category
		for _, sub := range subscriptions {
			if sub.EventCategory == category {
				if sub.WebhookEndpoint == endpoint {
					m.logger.Info("Already subscribed to category",
						zap.String("category", string(category)),
						zap.String("endpoint", endpoint),
					)
					return nil // Already subscribed with correct endpoint
				} else {
					m.logger.Info("Subscription exists with different endpoint, updating",
						zap.String("category", string(category)),
						zap.String("old_endpoint", sub.WebhookEndpoint),
						zap.String("new_endpoint", endpoint),
					)
					// Unsubscribe first, then resubscribe with new endpoint
					if err := m.client.UnsubscribeWebhook(ctx, category); err != nil {
						m.logger.Warn("Failed to unsubscribe from old endpoint",
							zap.Error(err),
						)
					}
				}
			}
		}
	}

	// Subscribe to new endpoint
	if err := m.client.SubscribeWebhook(ctx, category, endpoint); err != nil {
		return fmt.Errorf("failed to subscribe: %w", err)
	}

	m.logger.Info("Subscribed to TCR webhooks",
		zap.String("category", string(category)),
		zap.String("endpoint", endpoint),
	)

	return nil
}

// ListSubscriptions returns all active webhook subscriptions
func (m *WebhookSubscriptionManager) ListSubscriptions(ctx context.Context) ([]WebhookSubscription, error) {
	subs, err := m.client.ListWebhookSubscriptions(ctx)
	if err != nil {
		return nil, err
	}

	m.logger.Info("Retrieved webhook subscriptions",
		zap.Int("count", len(subs)),
	)

	for _, sub := range subs {
		m.logger.Info("Active subscription",
			zap.String("category", string(sub.EventCategory)),
			zap.String("endpoint", sub.WebhookEndpoint),
		)
	}

	return subs, nil
}

// UnsubscribeAllEvents unsubscribes from all webhook events
func (m *WebhookSubscriptionManager) UnsubscribeAllEvents(ctx context.Context) error {
	categories := []EventCategory{
		EventCategoryBrand,
		EventCategoryCampaign,
		EventCategoryVetting,
	}

	for _, category := range categories {
		if err := m.client.UnsubscribeWebhook(ctx, category); err != nil {
			m.logger.Warn("Failed to unsubscribe from category",
				zap.String("category", string(category)),
				zap.Error(err),
			)
			// Continue with other categories even if one fails
		} else {
			m.logger.Info("Unsubscribed from category",
				zap.String("category", string(category)),
			)
		}
	}

	return nil
}

// TestWebhookDelivery tests webhook delivery for a specific event type
func (m *WebhookSubscriptionManager) TestWebhookDelivery(ctx context.Context, eventType string) (*WebhookTestResponse, error) {
	testResp, err := m.client.TestWebhook(ctx, eventType)
	if err != nil {
		return nil, fmt.Errorf("failed to test webhook: %w", err)
	}

	m.logger.Info("Webhook test completed",
		zap.String("event_type", eventType),
		zap.String("endpoint", testResp.Endpoint),
		zap.Int("status", testResp.Status),
	)

	return testResp, nil
}
