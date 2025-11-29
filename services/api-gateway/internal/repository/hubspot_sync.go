package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/hubspot"
)

type HubSpotSyncRepository struct {
	db *pgxpool.Pool
}

func NewHubSpotSyncRepository(db *pgxpool.Pool) *HubSpotSyncRepository {
	return &HubSpotSyncRepository{db: db}
}

// CreateSyncLog creates a new sync log entry
func (r *HubSpotSyncRepository) CreateSyncLog(ctx context.Context, log *hubspot.SyncLog) error {
	query := `
		INSERT INTO accounts.hubspot_sync_log (
			entity_type, entity_id, hubspot_object_id, operation, direction,
			fields_synced, field_changes, status, triggered_by, triggered_by_user
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, started_at
	`

	err := r.db.QueryRow(ctx, query,
		log.EntityType, log.EntityID, log.HubSpotObjectID, log.Operation, log.Direction,
		log.FieldsSynced, log.FieldChanges, log.Status, log.TriggeredBy, log.TriggeredByUser,
	).Scan(&log.ID, &log.StartedAt)

	return err
}

// UpdateSyncLogStatus updates the status and completion time of a sync log
func (r *HubSpotSyncRepository) UpdateSyncLogStatus(ctx context.Context, logID uuid.UUID, status hubspot.SyncStatus, errorMsg string) error {
	query := `
		UPDATE accounts.hubspot_sync_log
		SET status = $1, error_message = $2, completed_at = NOW()
		WHERE id = $3
	`

	_, err := r.db.Exec(ctx, query, status, errorMsg, logID)
	return err
}

// UpsertFieldState creates or updates field state
func (r *HubSpotSyncRepository) UpsertFieldState(ctx context.Context, state *hubspot.FieldState) error {
	query := `
		INSERT INTO accounts.hubspot_field_state (
			entity_type, entity_id, hubspot_object_id, field_name, field_path,
			warp_value, hubspot_value, last_synced_at, last_synced_direction,
			last_modified_at_warp, last_modified_at_hubspot,
			sync_direction, conflict_resolution, is_in_conflict
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (entity_type, entity_id, field_name)
		DO UPDATE SET
			warp_value = EXCLUDED.warp_value,
			hubspot_value = EXCLUDED.hubspot_value,
			last_synced_at = EXCLUDED.last_synced_at,
			last_synced_direction = EXCLUDED.last_synced_direction,
			last_modified_at_warp = EXCLUDED.last_modified_at_warp,
			last_modified_at_hubspot = EXCLUDED.last_modified_at_hubspot,
			is_in_conflict = EXCLUDED.is_in_conflict,
			updated_at = NOW()
		RETURNING id
	`

	return r.db.QueryRow(ctx, query,
		state.EntityType, state.EntityID, state.HubSpotObjectID, state.FieldName, state.FieldPath,
		state.WarpValue, state.HubSpotValue, state.LastSyncedAt, state.LastSyncedDirection,
		state.LastModifiedAtWarp, state.LastModifiedAtHubSpot,
		state.SyncDirection, state.ConflictResolution, state.IsInConflict,
	).Scan(&state.ID)
}

// GetFieldState retrieves field state for an entity
func (r *HubSpotSyncRepository) GetFieldState(ctx context.Context, entityType string, entityID uuid.UUID, fieldName string) (*hubspot.FieldState, error) {
	query := `
		SELECT id, entity_type, entity_id, hubspot_object_id, field_name, field_path,
		       warp_value, hubspot_value, last_synced_at, last_synced_direction,
		       last_modified_at_warp, last_modified_at_hubspot,
		       sync_direction, conflict_resolution, is_in_conflict,
		       conflict_detected_at, conflict_resolved_at, created_at, updated_at
		FROM accounts.hubspot_field_state
		WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3
	`

	state := &hubspot.FieldState{}
	err := r.db.QueryRow(ctx, query, entityType, entityID, fieldName).Scan(
		&state.ID, &state.EntityType, &state.EntityID, &state.HubSpotObjectID,
		&state.FieldName, &state.FieldPath, &state.WarpValue, &state.HubSpotValue,
		&state.LastSyncedAt, &state.LastSyncedDirection,
		&state.LastModifiedAtWarp, &state.LastModifiedAtHubSpot,
		&state.SyncDirection, &state.ConflictResolution, &state.IsInConflict,
		&state.ConflictDetectedAt, &state.ConflictResolvedAt, &state.CreatedAt, &state.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return state, nil
}

// QueueSync adds a sync request to the queue
func (r *HubSpotSyncRepository) QueueSync(ctx context.Context, item *hubspot.SyncQueueItem) error {
	query := `
		INSERT INTO accounts.hubspot_sync_queue (
			entity_type, entity_id, hubspot_object_id, operation, direction,
			payload, priority, scheduled_for, max_retries
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`

	return r.db.QueryRow(ctx, query,
		item.EntityType, item.EntityID, item.HubSpotObjectID, item.Operation, item.Direction,
		item.Payload, item.Priority, item.ScheduledFor, item.MaxRetries,
	).Scan(&item.ID, &item.CreatedAt)
}

// GetPendingSyncItems retrieves queued items ready for processing
func (r *HubSpotSyncRepository) GetPendingSyncItems(ctx context.Context, limit int) ([]*hubspot.SyncQueueItem, error) {
	query := `
		SELECT id, entity_type, entity_id, hubspot_object_id, operation, direction,
		       payload, priority, scheduled_for, max_retries, retry_count,
		       status, last_error, created_at, processed_at
		FROM accounts.hubspot_sync_queue
		WHERE status = 'QUEUED' AND scheduled_for <= NOW()
		ORDER BY priority ASC, scheduled_for ASC
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*hubspot.SyncQueueItem
	for rows.Next() {
		item := &hubspot.SyncQueueItem{}
		err := rows.Scan(
			&item.ID, &item.EntityType, &item.EntityID, &item.HubSpotObjectID,
			&item.Operation, &item.Direction, &item.Payload, &item.Priority,
			&item.ScheduledFor, &item.MaxRetries, &item.RetryCount,
			&item.Status, &item.LastError, &item.CreatedAt, &item.ProcessedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}

// UpdateQueueItemStatus updates the status of a queue item
func (r *HubSpotSyncRepository) UpdateQueueItemStatus(ctx context.Context, itemID uuid.UUID, status string, errorMsg string) error {
	query := `
		UPDATE accounts.hubspot_sync_queue
		SET status = $1, last_error = $2, processed_at = NOW()
		WHERE id = $3
	`

	_, err := r.db.Exec(ctx, query, status, errorMsg, itemID)
	return err
}

// IncrementQueueItemRetry increments retry count and reschedules
func (r *HubSpotSyncRepository) IncrementQueueItemRetry(ctx context.Context, itemID uuid.UUID, retryDelay time.Duration) error {
	query := `
		UPDATE accounts.hubspot_sync_queue
		SET retry_count = retry_count + 1,
		    status = 'QUEUED',
		    scheduled_for = NOW() + $1::interval,
		    last_error = NULL
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, retryDelay.String(), itemID)
	return err
}

// StoreWebhookEvent stores a raw webhook event
func (r *HubSpotSyncRepository) StoreWebhookEvent(ctx context.Context, event *hubspot.WebhookEvent) error {
	query := `
		INSERT INTO accounts.hubspot_webhook_events (
			event_id, event_type, object_type, object_id,
			property_name, property_value, previous_value,
			raw_payload, occurred_at, signature_valid
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (event_id) DO NOTHING
		RETURNING id, received_at
	`

	return r.db.QueryRow(ctx, query,
		event.EventID, event.EventType, event.ObjectType, event.ObjectID,
		event.PropertyName, event.PropertyValue, event.PreviousValue,
		event.RawPayload, event.OccurredAt, event.SignatureValid,
	).Scan(&event.ID, &event.ReceivedAt)
}

// MarkWebhookProcessed marks a webhook as processed
func (r *HubSpotSyncRepository) MarkWebhookProcessed(ctx context.Context, eventID string, errorMsg string) error {
	query := `
		UPDATE accounts.hubspot_webhook_events
		SET processed = TRUE, processed_at = NOW(), processing_error = $1
		WHERE event_id = $2
	`

	_, err := r.db.Exec(ctx, query, errorMsg, eventID)
	return err
}

// GetSyncConfig retrieves the global sync configuration
func (r *HubSpotSyncRepository) GetSyncConfig(ctx context.Context) (*hubspot.SyncConfig, error) {
	query := `
		SELECT id, config_name, field_mappings, auto_sync_enabled,
		       sync_frequency_minutes, batch_size, created_at, updated_at
		FROM accounts.hubspot_sync_config
		WHERE is_global = TRUE
		LIMIT 1
	`

	config := &hubspot.SyncConfig{IsGlobal: true}
	err := r.db.QueryRow(ctx, query).Scan(
		&config.ID, &config.ConfigName, &config.FieldMappings,
		&config.AutoSyncEnabled, &config.SyncFrequencyMinutes, &config.BatchSize,
		&config.CreatedAt, &config.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get sync config: %w", err)
	}

	return config, nil
}

// CreateReconciliationRun creates a new reconciliation run record
func (r *HubSpotSyncRepository) CreateReconciliationRun(ctx context.Context, run *hubspot.ReconciliationRun) error {
	query := `
		INSERT INTO accounts.hubspot_reconciliation_runs (
			run_type, entity_type, customer_id, triggered_by
		) VALUES ($1, $2, $3, $4)
		RETURNING id, started_at
	`

	return r.db.QueryRow(ctx, query,
		run.RunType, run.EntityType, run.CustomerID, run.TriggeredBy,
	).Scan(&run.ID, &run.StartedAt)
}

// UpdateReconciliationRun updates reconciliation run statistics
func (r *HubSpotSyncRepository) UpdateReconciliationRun(ctx context.Context, run *hubspot.ReconciliationRun) error {
	query := `
		UPDATE accounts.hubspot_reconciliation_runs
		SET total_records = $1, records_in_sync = $2, records_updated = $3,
		    conflicts_detected = $4, errors_encountered = $5,
		    status = $6, completed_at = $7, duration_seconds = $8, notes = $9
		WHERE id = $10
	`

	_, err := r.db.Exec(ctx, query,
		run.TotalRecords, run.RecordsInSync, run.RecordsUpdated,
		run.ConflictsDetected, run.ErrorsEncountered,
		run.Status, run.CompletedAt, run.DurationSeconds, run.Notes, run.ID,
	)

	return err
}
