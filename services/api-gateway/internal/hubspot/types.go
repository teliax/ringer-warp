package hubspot

import (
	"time"

	"github.com/google/uuid"
)

// SyncDirection defines the direction of data synchronization
type SyncDirection string

const (
	SyncDirectionWarpToHubSpot   SyncDirection = "WARP_TO_HUBSPOT"
	SyncDirectionHubSpotToWarp   SyncDirection = "HUBSPOT_TO_WARP"
	SyncDirectionBidirectional   SyncDirection = "BIDIRECTIONAL"
	SyncDirectionNone            SyncDirection = "NONE"
)

// ConflictResolution defines how to resolve conflicts
type ConflictResolution string

const (
	ConflictResolutionWarpWins    ConflictResolution = "WARP_WINS"
	ConflictResolutionHubSpotWins ConflictResolution = "HUBSPOT_WINS"
	ConflictResolutionLatestWins  ConflictResolution = "LATEST_WINS"
	ConflictResolutionManual      ConflictResolution = "MANUAL"
)

// SyncStatus represents the status of a sync operation
type SyncStatus string

const (
	SyncStatusPending    SyncStatus = "PENDING"
	SyncStatusInProgress SyncStatus = "IN_PROGRESS"
	SyncStatusSuccess    SyncStatus = "SUCCESS"
	SyncStatusFailed     SyncStatus = "FAILED"
	SyncStatusConflict   SyncStatus = "CONFLICT"
)

// FieldMapping defines how a field syncs between WARP and HubSpot
type FieldMapping struct {
	HubSpotProperty     string             `json:"hubspot_property"`
	WarpField           string             `json:"warp_field"`
	WarpFieldPath       string             `json:"warp_field_path,omitempty"` // For JSONB: "contact->>'email'"
	SyncDirection       SyncDirection      `json:"sync_direction"`
	ConflictResolution  ConflictResolution `json:"conflict_resolution"`
	Transform           string             `json:"transform,omitempty"` // Optional transformation function
	Description         string             `json:"description,omitempty"`
	IsComplex           bool               `json:"is_complex,omitempty"`
	SubMappings         map[string]string  `json:"sub_mappings,omitempty"` // For nested objects
	UpdateFrequency     string             `json:"update_frequency,omitempty"`
}

// SyncConfig represents the full configuration for syncing an entity type
type SyncConfig struct {
	ID                    uuid.UUID                `json:"id"`
	CustomerID            *uuid.UUID               `json:"customer_id,omitempty"`
	IsGlobal              bool                     `json:"is_global"`
	ConfigName            string                   `json:"config_name"`
	FieldMappings         map[string]FieldMapping  `json:"field_mappings"`
	AutoSyncEnabled       bool                     `json:"auto_sync_enabled"`
	SyncFrequencyMinutes  int                      `json:"sync_frequency_minutes"`
	BatchSize             int                      `json:"batch_size"`
	CreatedAt             time.Time                `json:"created_at"`
	UpdatedAt             time.Time                `json:"updated_at"`
	CreatedBy             string                   `json:"created_by,omitempty"`
}

// SyncRequest represents a request to sync an entity
type SyncRequest struct {
	EntityType     string        `json:"entity_type"`
	EntityID       uuid.UUID     `json:"entity_id"`
	HubSpotObjectID string       `json:"hubspot_object_id,omitempty"`
	Operation      string        `json:"operation"` // CREATE, UPDATE, DELETE
	Direction      SyncDirection `json:"direction"`
	ChangedFields  []string      `json:"changed_fields,omitempty"`
	TriggerSource  string        `json:"trigger_source"` // webhook, manual, reconciliation, api
	TriggerByUser  string        `json:"trigger_by_user,omitempty"`
	Priority       int           `json:"priority,omitempty"`
}

// SyncLog represents an audit entry for a sync operation
type SyncLog struct {
	ID              uuid.UUID              `json:"id"`
	EntityType      string                 `json:"entity_type"`
	EntityID        uuid.UUID              `json:"entity_id"`
	HubSpotObjectID string                 `json:"hubspot_object_id,omitempty"`
	Operation       string                 `json:"operation"`
	Direction       SyncDirection          `json:"direction"`
	FieldsSynced    []string               `json:"fields_synced"`
	FieldChanges    map[string]FieldChange `json:"field_changes"`
	Status          SyncStatus             `json:"status"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
	RetryCount      int                    `json:"retry_count"`
	StartedAt       time.Time              `json:"started_at"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	TriggeredBy     string                 `json:"triggered_by"`
	TriggeredByUser string                 `json:"triggered_by_user,omitempty"`
}

// FieldChange represents a change to a specific field
type FieldChange struct {
	OldValue interface{} `json:"old"`
	NewValue interface{} `json:"new"`
	Source   string      `json:"source"` // "warp" or "hubspot"
}

// FieldState represents the current sync state of a field
type FieldState struct {
	ID                      uuid.UUID          `json:"id"`
	EntityType              string             `json:"entity_type"`
	EntityID                uuid.UUID          `json:"entity_id"`
	HubSpotObjectID         string             `json:"hubspot_object_id"`
	FieldName               string             `json:"field_name"`
	FieldPath               string             `json:"field_path,omitempty"`
	WarpValue               interface{}        `json:"warp_value"`
	HubSpotValue            interface{}        `json:"hubspot_value"`
	LastSyncedAt            *time.Time         `json:"last_synced_at"`
	LastSyncedDirection     SyncDirection      `json:"last_synced_direction,omitempty"`
	LastModifiedAtWarp      *time.Time         `json:"last_modified_at_warp"`
	LastModifiedAtHubSpot   *time.Time         `json:"last_modified_at_hubspot"`
	SyncDirection           SyncDirection      `json:"sync_direction"`
	ConflictResolution      ConflictResolution `json:"conflict_resolution"`
	IsInConflict            bool               `json:"is_in_conflict"`
	ConflictDetectedAt      *time.Time         `json:"conflict_detected_at"`
	ConflictResolvedAt      *time.Time         `json:"conflict_resolved_at"`
	CreatedAt               time.Time          `json:"created_at"`
	UpdatedAt               time.Time          `json:"updated_at"`
}

// SyncQueueItem represents an item in the sync queue
type SyncQueueItem struct {
	ID              uuid.UUID      `json:"id"`
	EntityType      string         `json:"entity_type"`
	EntityID        uuid.UUID      `json:"entity_id"`
	HubSpotObjectID string         `json:"hubspot_object_id,omitempty"`
	Operation       string         `json:"operation"`
	Direction       SyncDirection  `json:"direction"`
	Payload         map[string]interface{} `json:"payload"`
	Priority        int            `json:"priority"`
	ScheduledFor    time.Time      `json:"scheduled_for"`
	MaxRetries      int            `json:"max_retries"`
	RetryCount      int            `json:"retry_count"`
	Status          string         `json:"status"` // QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED
	LastError       string         `json:"last_error,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	ProcessedAt     *time.Time     `json:"processed_at"`
}

// WebhookEvent represents a raw webhook from HubSpot
type WebhookEvent struct {
	ID               uuid.UUID   `json:"id"`
	EventID          string      `json:"event_id"`
	EventType        string      `json:"event_type"`
	ObjectType       string      `json:"object_type"`
	ObjectID         string      `json:"object_id"`
	PropertyName     string      `json:"property_name,omitempty"`
	PropertyValue    interface{} `json:"property_value,omitempty"`
	PreviousValue    interface{} `json:"previous_value,omitempty"`
	RawPayload       map[string]interface{} `json:"raw_payload"`
	Processed        bool        `json:"processed"`
	ProcessedAt      *time.Time  `json:"processed_at"`
	ProcessingError  string      `json:"processing_error,omitempty"`
	OccurredAt       time.Time   `json:"occurred_at"`
	ReceivedAt       time.Time   `json:"received_at"`
	SignatureValid   bool        `json:"signature_valid"`
}

// ConflictInfo represents information about a detected conflict
type ConflictInfo struct {
	FieldName         string      `json:"field_name"`
	WarpValue         interface{} `json:"warp_value"`
	HubSpotValue      interface{} `json:"hubspot_value"`
	WarpModifiedAt    time.Time   `json:"warp_modified_at"`
	HubSpotModifiedAt time.Time   `json:"hubspot_modified_at"`
	ResolutionStrategy ConflictResolution `json:"resolution_strategy"`
	ResolvedValue     interface{} `json:"resolved_value,omitempty"`
	Winner            string      `json:"winner,omitempty"` // "warp", "hubspot", "manual"
}

// ReconciliationRun represents a reconciliation job execution
type ReconciliationRun struct {
	ID                  uuid.UUID  `json:"id"`
	RunType             string     `json:"run_type"` // FULL, INCREMENTAL, CUSTOMER_SPECIFIC
	EntityType          string     `json:"entity_type"`
	CustomerID          *uuid.UUID `json:"customer_id,omitempty"`
	TotalRecords        int        `json:"total_records"`
	RecordsInSync       int        `json:"records_in_sync"`
	RecordsUpdated      int        `json:"records_updated"`
	ConflictsDetected   int        `json:"conflicts_detected"`
	ErrorsEncountered   int        `json:"errors_encountered"`
	Status              string     `json:"status"` // RUNNING, COMPLETED, FAILED, CANCELLED
	StartedAt           time.Time  `json:"started_at"`
	CompletedAt         *time.Time `json:"completed_at"`
	DurationSeconds     int        `json:"duration_seconds,omitempty"`
	TriggeredBy         string     `json:"triggered_by"`
	Notes               string     `json:"notes,omitempty"`
}

// HubSpotCompany represents a company object from HubSpot API
type HubSpotCompany struct {
	ID         string                 `json:"id"`
	Properties map[string]interface{} `json:"properties"`
	CreatedAt  time.Time              `json:"createdAt"`
	UpdatedAt  time.Time              `json:"updatedAt"`
	Archived   bool                   `json:"archived"`
}

// HubSpotPropertyChange represents a property change event
type HubSpotPropertyChange struct {
	PropertyName  string      `json:"propertyName"`
	PropertyValue interface{} `json:"propertyValue"`
	PreviousValue interface{} `json:"previousValue,omitempty"`
	ChangeSource  string      `json:"changeSource"`
	SourceID      string      `json:"sourceId,omitempty"`
}

// HubSpotContact represents a contact from HubSpot
type HubSpotContact struct {
	ID         string                 `json:"id"`
	Properties map[string]interface{} `json:"properties"`
	CreatedAt  time.Time              `json:"createdAt"`
	UpdatedAt  time.Time              `json:"updatedAt"`
	Archived   bool                   `json:"archived"`
}
