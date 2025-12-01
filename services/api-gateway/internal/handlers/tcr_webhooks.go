package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/tcr"
	"go.uber.org/zap"
)

// TCRWebhookHandler handles incoming webhooks from The Campaign Registry
type TCRWebhookHandler struct {
	webhookRepo      *repository.TCRWebhookEventRepository
	webhookProcessor *tcr.WebhookProcessor
	logger           *zap.Logger
}

// NewTCRWebhookHandler creates a new TCR webhook handler
func NewTCRWebhookHandler(
	webhookRepo *repository.TCRWebhookEventRepository,
	webhookProcessor *tcr.WebhookProcessor,
	logger *zap.Logger,
) *TCRWebhookHandler {
	return &TCRWebhookHandler{
		webhookRepo:      webhookRepo,
		webhookProcessor: webhookProcessor,
		logger:           logger,
	}
}

// HandleBrandWebhook godoc
// @Summary Receive TCR brand webhooks
// @Description Process brand status change events from The Campaign Registry
// @Tags TCR Webhooks
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /webhooks/tcr/brands [post]
func (h *TCRWebhookHandler) HandleBrandWebhook(c *gin.Context) {
	// Read raw body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.logger.Error("Failed to read webhook body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Log raw webhook receipt
	h.logger.Info("Received TCR brand webhook",
		zap.String("content_type", c.ContentType()),
		zap.Int("body_size", len(bodyBytes)),
	)

	// Parse webhook payload
	var event tcr.WebhookEvent
	if err := json.Unmarshal(bodyBytes, &event); err != nil {
		h.logger.Error("Failed to parse webhook payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Set event category
	event.EventCategory = "BRAND"

	// Store raw payload for audit
	var rawPayload map[string]interface{}
	json.Unmarshal(bodyBytes, &rawPayload)
	event.RawPayload = rawPayload

	// Store webhook event in database (audit log)
	dbEvent := &repository.TCRWebhookEvent{
		EventType:     event.EventType,
		EventCategory: event.EventCategory,
		Payload:       rawPayload,
	}

	if event.BrandID != "" {
		dbEvent.TCRBrandID = &event.BrandID
	}

	if err := h.webhookRepo.StoreWebhookEvent(c.Request.Context(), dbEvent); err != nil {
		h.logger.Error("Failed to store webhook event",
			zap.String("event_type", event.EventType),
			zap.Error(err),
		)
		// Don't fail the webhook - TCR expects 200 OK
	}

	// Process event asynchronously
	go func() {
		if err := h.processWebhookEvent(dbEvent.ID, &event); err != nil {
			h.logger.Error("Failed to process webhook event",
				zap.String("event_id", dbEvent.ID.String()),
				zap.Error(err),
			)
			h.webhookRepo.MarkWebhookProcessed(c.Request.Context(), dbEvent.ID, err.Error())
		} else {
			h.webhookRepo.MarkWebhookProcessed(c.Request.Context(), dbEvent.ID, "")
		}
	}()

	// Return 200 OK immediately (TCR requirement)
	c.JSON(http.StatusOK, gin.H{
		"status":    "received",
		"event_id":  dbEvent.ID,
		"eventType": event.EventType,
	})
}

// HandleCampaignWebhook godoc
// @Summary Receive TCR campaign webhooks
// @Description Process campaign status change events from The Campaign Registry
// @Tags TCR Webhooks
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /webhooks/tcr/campaigns [post]
func (h *TCRWebhookHandler) HandleCampaignWebhook(c *gin.Context) {
	// Read raw body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.logger.Error("Failed to read webhook body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	h.logger.Info("Received TCR campaign webhook",
		zap.String("content_type", c.ContentType()),
		zap.Int("body_size", len(bodyBytes)),
	)

	// Parse webhook payload
	var event tcr.WebhookEvent
	if err := json.Unmarshal(bodyBytes, &event); err != nil {
		h.logger.Error("Failed to parse webhook payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Set event category
	event.EventCategory = "CAMPAIGN"

	// Store raw payload for audit
	var rawPayload map[string]interface{}
	json.Unmarshal(bodyBytes, &rawPayload)
	event.RawPayload = rawPayload

	// Store webhook event in database (audit log)
	dbEvent := &repository.TCRWebhookEvent{
		EventType:     event.EventType,
		EventCategory: event.EventCategory,
		Payload:       rawPayload,
	}

	if event.CampaignID != "" {
		dbEvent.TCRCampaignID = &event.CampaignID
	}
	if event.BrandID != "" {
		dbEvent.TCRBrandID = &event.BrandID
	}

	if err := h.webhookRepo.StoreWebhookEvent(c.Request.Context(), dbEvent); err != nil {
		h.logger.Error("Failed to store webhook event",
			zap.String("event_type", event.EventType),
			zap.Error(err),
		)
	}

	// Process event asynchronously
	go func() {
		if err := h.processWebhookEvent(dbEvent.ID, &event); err != nil {
			h.logger.Error("Failed to process webhook event",
				zap.String("event_id", dbEvent.ID.String()),
				zap.Error(err),
			)
			h.webhookRepo.MarkWebhookProcessed(c.Request.Context(), dbEvent.ID, err.Error())
		} else {
			h.webhookRepo.MarkWebhookProcessed(c.Request.Context(), dbEvent.ID, "")
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"status":    "received",
		"event_id":  dbEvent.ID,
		"eventType": event.EventType,
	})
}

// HandleVettingWebhook godoc
// @Summary Receive TCR vetting webhooks
// @Description Process vetting completion events from The Campaign Registry
// @Tags TCR Webhooks
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /webhooks/tcr/vetting [post]
func (h *TCRWebhookHandler) HandleVettingWebhook(c *gin.Context) {
	// Read raw body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.logger.Error("Failed to read webhook body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	h.logger.Info("Received TCR vetting webhook",
		zap.String("content_type", c.ContentType()),
		zap.Int("body_size", len(bodyBytes)),
	)

	// Parse webhook payload
	var event tcr.WebhookEvent
	if err := json.Unmarshal(bodyBytes, &event); err != nil {
		h.logger.Error("Failed to parse webhook payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Set event category
	event.EventCategory = "VETTING"

	// Store raw payload for audit
	var rawPayload map[string]interface{}
	json.Unmarshal(bodyBytes, &rawPayload)
	event.RawPayload = rawPayload

	// Store webhook event in database (audit log)
	dbEvent := &repository.TCRWebhookEvent{
		EventType:     event.EventType,
		EventCategory: event.EventCategory,
		Payload:       rawPayload,
	}

	if event.BrandID != "" {
		dbEvent.TCRBrandID = &event.BrandID
	}

	if err := h.webhookRepo.StoreWebhookEvent(c.Request.Context(), dbEvent); err != nil {
		h.logger.Error("Failed to store webhook event",
			zap.String("event_type", event.EventType),
			zap.Error(err),
		)
	}

	// Process event asynchronously
	go func() {
		if err := h.processWebhookEvent(dbEvent.ID, &event); err != nil {
			h.logger.Error("Failed to process webhook event",
				zap.String("event_id", dbEvent.ID.String()),
				zap.Error(err),
			)
			h.webhookRepo.MarkWebhookProcessed(c.Request.Context(), dbEvent.ID, err.Error())
		} else {
			h.webhookRepo.MarkWebhookProcessed(c.Request.Context(), dbEvent.ID, "")
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"status":    "received",
		"event_id":  dbEvent.ID,
		"eventType": event.EventType,
	})
}

// processWebhookEvent processes a webhook event based on its category
func (h *TCRWebhookHandler) processWebhookEvent(eventID uuid.UUID, event *tcr.WebhookEvent) error {
	ctx := context.Background() // Use background context for async processing

	switch event.EventCategory {
	case "BRAND":
		return h.webhookProcessor.ProcessBrandEvent(ctx, event)

	case "CAMPAIGN":
		return h.webhookProcessor.ProcessCampaignEvent(ctx, event)

	case "VETTING":
		return h.webhookProcessor.ProcessVettingEvent(ctx, event)

	default:
		h.logger.Warn("Unknown webhook event category",
			zap.String("event_id", eventID.String()),
			zap.String("category", event.EventCategory),
		)
		return nil
	}
}
