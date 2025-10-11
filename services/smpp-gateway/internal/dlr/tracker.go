package dlr

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/ringer-warp/smpp-gateway/internal/models"
	log "github.com/sirupsen/logrus"
)

const (
	// Redis key prefixes
	DLRKeyPrefix     = "dlr:msg:"
	DLRDefaultTTL    = 7 * 24 * time.Hour // 7 days
	MessageKeyPrefix = "msg:"
)

// Tracker manages delivery receipt tracking in Redis
type Tracker struct {
	redis *redis.Client
}

// NewTracker creates a new DLR tracker
func NewTracker(redisClient *redis.Client) *Tracker {
	return &Tracker{
		redis: redisClient,
	}
}

// StoreMessage stores message metadata for DLR correlation
func (t *Tracker) StoreMessage(ctx context.Context, msg *models.Message) error {
	key := MessageKeyPrefix + msg.ID

	// Serialize message to JSON
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Store in Redis with TTL
	if err := t.redis.Set(ctx, key, data, DLRDefaultTTL).Err(); err != nil {
		return fmt.Errorf("failed to store message in Redis: %w", err)
	}

	log.WithFields(log.Fields{
		"msg_id":      msg.ID,
		"vendor_id":   msg.VendorID,
		"customer_id": msg.CustomerID,
	}).Debug("Message stored for DLR tracking")

	return nil
}

// HandleDLR processes a delivery receipt from vendor
func (t *Tracker) HandleDLR(ctx context.Context, dlr *models.DeliveryReceipt) error {
	logger := log.WithFields(log.Fields{
		"msg_id":       dlr.MessageID,
		"vendor_msg_id": dlr.VendorMsgID,
		"status":       dlr.Status,
	})

	// Get original message from Redis
	key := MessageKeyPrefix + dlr.MessageID
	data, err := t.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		logger.Warn("Message not found for DLR (may have expired)")
		return nil // Not an error - message may have expired
	} else if err != nil {
		return fmt.Errorf("failed to get message from Redis: %w", err)
	}

	// Unmarshal message
	var msg models.Message
	if err := json.Unmarshal([]byte(data), &msg); err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	// Update message with DLR info
	now := time.Now()
	msg.DLRStatus = dlr.Status
	msg.Status = mapDLRStatusToMessageStatus(dlr.Status)
	msg.DeliveredAt = &now

	if dlr.ErrorCode != "" && dlr.ErrorCode != "000" {
		msg.FailureReason = fmt.Sprintf("Vendor error: %s", dlr.ErrorCode)
	}

	// Update message in Redis
	updatedData, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal updated message: %w", err)
	}

	if err := t.redis.Set(ctx, key, updatedData, DLRDefaultTTL).Err(); err != nil {
		return fmt.Errorf("failed to update message in Redis: %w", err)
	}

	// Also store DLR separately for quick lookup
	dlrKey := DLRKeyPrefix + dlr.MessageID
	dlrData, _ := json.Marshal(dlr)
	if err := t.redis.Set(ctx, dlrKey, dlrData, DLRDefaultTTL).Err(); err != nil {
		logger.WithError(err).Error("Failed to store DLR")
	}

	logger.WithField("final_status", msg.Status).Info("DLR processed and message updated")

	// TODO: Push DLR to RabbitMQ for async processing (BigQuery, customer notification)

	return nil
}

// GetMessageStatus retrieves current status of a message
func (t *Tracker) GetMessageStatus(ctx context.Context, messageID string) (*models.Message, error) {
	key := MessageKeyPrefix + messageID

	data, err := t.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("message not found: %s", messageID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	var msg models.Message
	if err := json.Unmarshal([]byte(data), &msg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal message: %w", err)
	}

	return &msg, nil
}

// GetDLR retrieves the DLR for a message
func (t *Tracker) GetDLR(ctx context.Context, messageID string) (*models.DeliveryReceipt, error) {
	key := DLRKeyPrefix + messageID

	data, err := t.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("DLR not found: %s", messageID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to get DLR: %w", err)
	}

	var dlr models.DeliveryReceipt
	if err := json.Unmarshal([]byte(data), &dlr); err != nil {
		return nil, fmt.Errorf("failed to unmarshal DLR: %w", err)
	}

	return &dlr, nil
}

// mapDLRStatusToMessageStatus converts SMPP DLR status to internal message status
func mapDLRStatusToMessageStatus(dlrStatus string) string {
	switch dlrStatus {
	case "DELIVRD":
		return "delivered"
	case "EXPIRED":
		return "expired"
	case "DELETED":
		return "deleted"
	case "UNDELIV":
		return "failed"
	case "ACCEPTD":
		return "accepted"
	case "UNKNOWN":
		return "unknown"
	case "REJECTD":
		return "rejected"
	default:
		return "pending"
	}
}

// CleanupExpired removes expired message records (optional maintenance task)
func (t *Tracker) CleanupExpired(ctx context.Context) error {
	// Redis TTL handles expiration automatically
	// This method is here for future manual cleanup if needed
	log.Debug("Redis TTL handles automatic cleanup - no action needed")
	return nil
}
