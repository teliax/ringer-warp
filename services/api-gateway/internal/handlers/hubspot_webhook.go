package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/hubspot"
	"go.uber.org/zap"
)

type HubSpotWebhookHandler struct {
	signatureValidator *hubspot.SignatureValidator
	webhookProcessor   *hubspot.WebhookProcessor
	syncRepo           hubspot.SyncRepository
	logger             *zap.Logger
}

func NewHubSpotWebhookHandler(
	webhookSecret string,
	webhookProcessor *hubspot.WebhookProcessor,
	syncRepo hubspot.SyncRepository,
	logger *zap.Logger,
) *HubSpotWebhookHandler {
	return &HubSpotWebhookHandler{
		signatureValidator: hubspot.NewSignatureValidator(webhookSecret),
		webhookProcessor:   webhookProcessor,
		syncRepo:           syncRepo,
		logger:             logger,
	}
}

// HandleCompanyWebhook godoc
// @Summary Receive HubSpot company webhooks
// @Description Process company property change events from HubSpot
// @Tags HubSpot Webhooks
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /webhooks/hubspot/company [post]
func (h *HubSpotWebhookHandler) HandleCompanyWebhook(c *gin.Context) {
	// Get signature from header
	signature := c.GetHeader("X-HubSpot-Signature")
	timestamp := c.GetHeader("X-HubSpot-Request-Timestamp")

	// Read body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.logger.Error("Failed to read webhook body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate signature
	valid, err := h.signatureValidator.ValidateSignature(signature, bodyBytes, timestamp)
	if err != nil {
		h.logger.Warn("Webhook signature validation error", zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	if !valid {
		h.logger.Warn("Invalid webhook signature",
			zap.String("signature", signature),
		)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// Parse webhook payload
	var payload []map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		h.logger.Error("Failed to parse webhook payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	h.logger.Info("Received HubSpot webhook",
		zap.Int("events", len(payload)),
		zap.Bool("signature_valid", valid),
	)

	// Process each event
	for _, eventData := range payload {
		if err := h.processEvent(c.Request.Context(), eventData); err != nil {
			h.logger.Error("Failed to process webhook event",
				zap.Any("event", eventData),
				zap.Error(err),
			)
			// Continue processing other events even if one fails
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "received",
		"events_processed": len(payload),
	})
}

// processEvent processes a single webhook event
func (h *HubSpotWebhookHandler) processEvent(ctx context.Context, eventData map[string]interface{}) error {
	// Extract event details
	eventID, _ := eventData["eventId"].(string)
	eventType, _ := eventData["subscriptionType"].(string)
	objectID, _ := eventData["objectId"].(string)
	propertyName, _ := eventData["propertyName"].(string)
	propertyValue := eventData["propertyValue"]
	previousValue := eventData["propertyValue"]

	// Parse timestamp
	var occurredAt time.Time
	if ts, ok := eventData["occurredAt"].(float64); ok {
		occurredAt = time.UnixMilli(int64(ts))
	} else {
		occurredAt = time.Now()
	}

	// Create webhook event record
	webhookEvent := &hubspot.WebhookEvent{
		EventID:        eventID,
		EventType:      eventType,
		ObjectType:     "company",
		ObjectID:       objectID,
		PropertyName:   propertyName,
		PropertyValue:  propertyValue,
		PreviousValue:  previousValue,
		RawPayload:     eventData,
		OccurredAt:     occurredAt,
		SignatureValid: true,
	}

	// Store webhook (idempotency check)
	if err := h.syncRepo.StoreWebhookEvent(ctx, webhookEvent); err != nil {
		// Duplicate event ID - already processed
		h.logger.Debug("Webhook event already processed",
			zap.String("event_id", eventID),
		)
		return nil
	}

	// Process based on event type
	switch eventType {
	case "company.propertyChange":
		err := h.webhookProcessor.ProcessCompanyPropertyChange(ctx, webhookEvent)
		if err != nil {
			h.syncRepo.MarkWebhookProcessed(ctx, eventID, err.Error())
			return err
		}
		h.syncRepo.MarkWebhookProcessed(ctx, eventID, "")
		return nil

	case "company.creation":
		h.logger.Info("Company creation event - skipping (WARP creates companies)",
			zap.String("object_id", objectID),
		)
		h.syncRepo.MarkWebhookProcessed(ctx, eventID, "skipped_creation")
		return nil

	case "company.deletion":
		h.logger.Warn("Company deletion event - manual review required",
			zap.String("object_id", objectID),
		)
		h.syncRepo.MarkWebhookProcessed(ctx, eventID, "manual_review_required")
		return nil

	default:
		h.logger.Warn("Unknown webhook event type",
			zap.String("event_type", eventType),
		)
		h.syncRepo.MarkWebhookProcessed(ctx, eventID, "unknown_event_type")
		return nil
	}
}
