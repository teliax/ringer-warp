package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TCRWebhookEventRepository handles database operations for TCR webhook events
type TCRWebhookEventRepository struct {
	db *pgxpool.Pool
}

// NewTCRWebhookEventRepository creates a new webhook event repository
func NewTCRWebhookEventRepository(db *pgxpool.Pool) *TCRWebhookEventRepository {
	return &TCRWebhookEventRepository{db: db}
}

// TCRWebhookEvent represents a webhook event stored in the database
type TCRWebhookEvent struct {
	ID              uuid.UUID              `db:"id"`
	EventType       string                 `db:"event_type"`
	EventCategory   string                 `db:"event_category"`
	TCRBrandID      *string                `db:"tcr_brand_id"`
	TCRCampaignID   *string                `db:"tcr_campaign_id"`
	Payload         map[string]interface{} `db:"payload"`
	Processed       bool                   `db:"processed"`
	ProcessedAt     *time.Time             `db:"processed_at"`
	ProcessingError *string                `db:"processing_error"`
	ReceivedAt      time.Time              `db:"received_at"`
}

// StoreWebhookEvent stores a webhook event in the database
// Returns error if event already exists (idempotency check)
func (r *TCRWebhookEventRepository) StoreWebhookEvent(ctx context.Context, event *TCRWebhookEvent) error {
	payloadJSON, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	query := `
		INSERT INTO messaging.tcr_webhook_events (
			event_type,
			event_category,
			tcr_brand_id,
			tcr_campaign_id,
			payload,
			processed
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, received_at
	`

	err = r.db.QueryRow(ctx, query,
		event.EventType,
		event.EventCategory,
		event.TCRBrandID,
		event.TCRCampaignID,
		payloadJSON,
		false, // not processed yet
	).Scan(&event.ID, &event.ReceivedAt)

	if err != nil {
		return fmt.Errorf("failed to store webhook event: %w", err)
	}

	return nil
}

// MarkWebhookProcessed marks a webhook event as processed
func (r *TCRWebhookEventRepository) MarkWebhookProcessed(ctx context.Context, eventID uuid.UUID, processingError string) error {
	var query string
	var args []interface{}

	if processingError == "" {
		query = `
			UPDATE messaging.tcr_webhook_events
			SET processed = true,
			    processed_at = NOW()
			WHERE id = $1
		`
		args = []interface{}{eventID}
	} else {
		query = `
			UPDATE messaging.tcr_webhook_events
			SET processed = true,
			    processed_at = NOW(),
			    processing_error = $2
			WHERE id = $1
		`
		args = []interface{}{eventID, processingError}
	}

	result, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to mark webhook processed: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("webhook event not found: %s", eventID)
	}

	return nil
}

// GetUnprocessedEvents returns webhook events that haven't been processed yet
func (r *TCRWebhookEventRepository) GetUnprocessedEvents(ctx context.Context, limit int) ([]TCRWebhookEvent, error) {
	query := `
		SELECT
			id,
			event_type,
			event_category,
			tcr_brand_id,
			tcr_campaign_id,
			payload,
			processed,
			processed_at,
			processing_error,
			received_at
		FROM messaging.tcr_webhook_events
		WHERE processed = false
		ORDER BY received_at ASC
		LIMIT $1
	`

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query unprocessed events: %w", err)
	}
	defer rows.Close()

	var events []TCRWebhookEvent
	for rows.Next() {
		var event TCRWebhookEvent
		var payloadJSON []byte

		err := rows.Scan(
			&event.ID,
			&event.EventType,
			&event.EventCategory,
			&event.TCRBrandID,
			&event.TCRCampaignID,
			&payloadJSON,
			&event.Processed,
			&event.ProcessedAt,
			&event.ProcessingError,
			&event.ReceivedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan webhook event: %w", err)
		}

		// Unmarshal payload JSON
		if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
			return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// GetEventsByBrand returns all webhook events for a specific brand
func (r *TCRWebhookEventRepository) GetEventsByBrand(ctx context.Context, tcrBrandID string, limit int) ([]TCRWebhookEvent, error) {
	query := `
		SELECT
			id,
			event_type,
			event_category,
			tcr_brand_id,
			tcr_campaign_id,
			payload,
			processed,
			processed_at,
			processing_error,
			received_at
		FROM messaging.tcr_webhook_events
		WHERE tcr_brand_id = $1
		ORDER BY received_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(ctx, query, tcrBrandID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query brand events: %w", err)
	}
	defer rows.Close()

	var events []TCRWebhookEvent
	for rows.Next() {
		var event TCRWebhookEvent
		var payloadJSON []byte

		err := rows.Scan(
			&event.ID,
			&event.EventType,
			&event.EventCategory,
			&event.TCRBrandID,
			&event.TCRCampaignID,
			&payloadJSON,
			&event.Processed,
			&event.ProcessedAt,
			&event.ProcessingError,
			&event.ReceivedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan webhook event: %w", err)
		}

		// Unmarshal payload JSON
		if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
			return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// GetEventsByCampaign returns all webhook events for a specific campaign
func (r *TCRWebhookEventRepository) GetEventsByCampaign(ctx context.Context, tcrCampaignID string, limit int) ([]TCRWebhookEvent, error) {
	query := `
		SELECT
			id,
			event_type,
			event_category,
			tcr_brand_id,
			tcr_campaign_id,
			payload,
			processed,
			processed_at,
			processing_error,
			received_at
		FROM messaging.tcr_webhook_events
		WHERE tcr_campaign_id = $1
		ORDER BY received_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(ctx, query, tcrCampaignID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query campaign events: %w", err)
	}
	defer rows.Close()

	var events []TCRWebhookEvent
	for rows.Next() {
		var event TCRWebhookEvent
		var payloadJSON []byte

		err := rows.Scan(
			&event.ID,
			&event.EventType,
			&event.EventCategory,
			&event.TCRBrandID,
			&event.TCRCampaignID,
			&payloadJSON,
			&event.Processed,
			&event.ProcessedAt,
			&event.ProcessingError,
			&event.ReceivedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan webhook event: %w", err)
		}

		// Unmarshal payload JSON
		if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
			return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// GetUserEmailByBrandID returns the email of the user who created the brand
func (r *TCRWebhookEventRepository) GetUserEmailByBrandID(ctx context.Context, tcrBrandID string) (string, uuid.UUID, error) {
	query := `
		SELECT u.email, u.id, u.display_name
		FROM messaging.brands_10dlc b
		JOIN auth.users u ON b.created_by = u.id
		WHERE b.tcr_brand_id = $1
	`

	var email, displayName string
	var userID uuid.UUID
	err := r.db.QueryRow(ctx, query, tcrBrandID).Scan(&email, &userID, &displayName)
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("failed to get user email for brand %s: %w", tcrBrandID, err)
	}

	return email, userID, nil
}

// GetUserEmailByCampaignID returns the email of the user who created the campaign
func (r *TCRWebhookEventRepository) GetUserEmailByCampaignID(ctx context.Context, tcrCampaignID string) (string, uuid.UUID, error) {
	query := `
		SELECT u.email, u.id, u.display_name
		FROM messaging.campaigns_10dlc c
		JOIN auth.users u ON c.created_by = u.id
		WHERE c.tcr_campaign_id = $1
	`

	var email, displayName string
	var userID uuid.UUID
	err := r.db.QueryRow(ctx, query, tcrCampaignID).Scan(&email, &userID, &displayName)
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("failed to get user email for campaign %s: %w", tcrCampaignID, err)
	}

	return email, userID, nil
}

// GetBrandDetailsByTCRID returns brand details for email notifications
func (r *TCRWebhookEventRepository) GetBrandDetailsByTCRID(ctx context.Context, tcrBrandID string) (*BrandDetails, error) {
	query := `
		SELECT
			b.id,
			b.display_name,
			b.tcr_brand_id,
			b.status,
			b.identity_status,
			b.trust_score,
			b.vetting_status,
			b.updated_at,
			u.email,
			u.display_name as user_name
		FROM messaging.brands_10dlc b
		JOIN auth.users u ON b.created_by = u.id
		WHERE b.tcr_brand_id = $1
	`

	var details BrandDetails
	err := r.db.QueryRow(ctx, query, tcrBrandID).Scan(
		&details.ID,
		&details.DisplayName,
		&details.TCRBrandID,
		&details.Status,
		&details.IdentityStatus,
		&details.TrustScore,
		&details.VettingStatus,
		&details.UpdatedAt,
		&details.UserEmail,
		&details.UserName,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get brand details: %w", err)
	}

	return &details, nil
}

// GetCampaignDetailsByTCRID returns campaign details for email notifications
func (r *TCRWebhookEventRepository) GetCampaignDetailsByTCRID(ctx context.Context, tcrCampaignID string) (*CampaignDetails, error) {
	query := `
		SELECT
			c.id,
			c.tcr_campaign_id,
			c.description,
			c.use_case,
			c.status,
			c.updated_at,
			b.display_name as brand_name,
			u.email,
			u.display_name as user_name
		FROM messaging.campaigns_10dlc c
		JOIN messaging.brands_10dlc b ON c.brand_id = b.id
		JOIN auth.users u ON c.created_by = u.id
		WHERE c.tcr_campaign_id = $1
	`

	var details CampaignDetails
	err := r.db.QueryRow(ctx, query, tcrCampaignID).Scan(
		&details.ID,
		&details.TCRCampaignID,
		&details.Description,
		&details.UseCase,
		&details.Status,
		&details.UpdatedAt,
		&details.BrandName,
		&details.UserEmail,
		&details.UserName,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get campaign details: %w", err)
	}

	return &details, nil
}

// GetUserEmailAndBrandName gets user email and brand name for notifications
func (r *TCRWebhookEventRepository) GetUserEmailAndBrandName(ctx context.Context, tcrBrandID string) (string, string, error) {
	query := `
		SELECT u.email, b.display_name
		FROM messaging.brands_10dlc b
		JOIN auth.users u ON b.created_by = u.id
		WHERE b.tcr_brand_id = $1
	`

	var email, brandName string
	err := r.db.QueryRow(ctx, query, tcrBrandID).Scan(&email, &brandName)
	if err != nil {
		return "", "", fmt.Errorf("failed to get user email and brand name: %w", err)
	}

	return email, brandName, nil
}

// BrandDetails holds brand information for email notifications
type BrandDetails struct {
	ID             uuid.UUID
	DisplayName    string
	TCRBrandID     string
	Status         *string
	IdentityStatus *string
	TrustScore     *int
	VettingStatus  *string
	UpdatedAt      string
	UserEmail      string
	UserName       string
}

// CampaignDetails holds campaign information for email notifications
type CampaignDetails struct {
	ID            uuid.UUID
	TCRCampaignID string
	Description   string
	UseCase       string
	Status        string
	UpdatedAt     string
	BrandName     string
	UserEmail     string
	UserName      string
}
