package hubspot

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"go.uber.org/zap"
)

// SyncRepository interface for database operations
type SyncRepository interface {
	CreateSyncLog(ctx context.Context, log *SyncLog) error
	UpdateSyncLogStatus(ctx context.Context, logID uuid.UUID, status SyncStatus, errorMsg string) error
	UpsertFieldState(ctx context.Context, state *FieldState) error
	GetFieldState(ctx context.Context, entityType string, entityID uuid.UUID, fieldName string) (*FieldState, error)
	QueueSync(ctx context.Context, item *SyncQueueItem) error
	GetPendingSyncItems(ctx context.Context, limit int) ([]*SyncQueueItem, error)
	UpdateQueueItemStatus(ctx context.Context, itemID uuid.UUID, status string, errorMsg string) error
	IncrementQueueItemRetry(ctx context.Context, itemID uuid.UUID, retryDelay time.Duration) error
	GetSyncConfig(ctx context.Context) (*SyncConfig, error)
	StoreWebhookEvent(ctx context.Context, event *WebhookEvent) error
	MarkWebhookProcessed(ctx context.Context, eventID string, errorMsg string) error
}

// CustomerRepository interface
type CustomerRepository interface {
	GetByID(ctx context.Context, customerID uuid.UUID) (*models.Customer, error)
	Update(ctx context.Context, customerID uuid.UUID, req *models.UpdateCustomerRequest, updatedBy string) (*models.Customer, error)
}

// SyncService orchestrates bidirectional sync between WARP and HubSpot
type SyncService struct {
	hubspotClient  *Client
	syncRepo       SyncRepository
	customerRepo   CustomerRepository
	fieldMapper    *FieldMapper
	logger         *zap.Logger
}

// NewSyncService creates a new sync service
func NewSyncService(
	hubspotClient *Client,
	syncRepo SyncRepository,
	customerRepo CustomerRepository,
	logger *zap.Logger,
) (*SyncService, error) {
	// Load sync configuration from database
	config, err := syncRepo.GetSyncConfig(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to load sync config: %w", err)
	}

	fieldMapper := NewFieldMapper(config)

	return &SyncService{
		hubspotClient: hubspotClient,
		syncRepo:      syncRepo,
		customerRepo:  customerRepo,
		fieldMapper:   fieldMapper,
		logger:        logger,
	}, nil
}

// SyncCustomerToHubSpot syncs a WARP customer to HubSpot
// Returns detailed error with field information if sync fails
func (s *SyncService) SyncCustomerToHubSpot(ctx context.Context, customer *models.Customer) (*SyncResult, error) {
	s.logger.Info("Syncing customer to HubSpot",
		zap.String("customer_id", customer.ID.String()),
		zap.String("ban", customer.BAN),
	)

	// Create sync log
	syncLog := &SyncLog{
		EntityType:      "customer",
		EntityID:        customer.ID,
		Operation:       "UPDATE",
		Direction:       SyncDirectionWarpToHubSpot,
		Status:          SyncStatusInProgress,
		TriggeredBy:     "manual",
		FieldChanges:    make(map[string]FieldChange),
	}

	if err := s.syncRepo.CreateSyncLog(ctx, syncLog); err != nil {
		return nil, fmt.Errorf("failed to create sync log: %w", err)
	}

	// Map WARP fields to HubSpot properties
	hubspotProps, syncedFields := s.fieldMapper.MapWARPToHubSpot(customer)
	syncLog.FieldsSynced = syncedFields

	// Get or create HubSpot company
	hubspotCompanyID := ""
	if customer.ExternalIDs != nil {
		if id, ok := customer.ExternalIDs["hubspot_company_id"].(string); ok {
			hubspotCompanyID = id
		}
	}

	var hubspotCompany *HubSpotCompany
	var err error

	if hubspotCompanyID != "" {
		// Update existing company
		hubspotCompany, err = s.hubspotClient.UpdateCompany(ctx, hubspotCompanyID, hubspotProps)
		if err != nil {
			s.syncRepo.UpdateSyncLogStatus(ctx, syncLog.ID, SyncStatusFailed, err.Error())
			return nil, &SyncError{
				Message: "Failed to update HubSpot company",
				FailedFields: []FieldError{{
					FieldName:    "hubspot_api",
					ErrorMessage: err.Error(),
				}},
			}
		}
	} else {
		// Create new company
		hubspotCompany, err = s.hubspotClient.CreateCompany(ctx, hubspotProps)
		if err != nil {
			s.syncRepo.UpdateSyncLogStatus(ctx, syncLog.ID, SyncStatusFailed, err.Error())
			return nil, &SyncError{
				Message: "Failed to create HubSpot company",
				FailedFields: []FieldError{{
					FieldName:    "hubspot_api",
					ErrorMessage: err.Error(),
				}},
			}
		}

		// Store HubSpot company ID back in WARP
		hubspotCompanyID = hubspotCompany.ID
	}

	syncLog.HubSpotObjectID = hubspotCompanyID

	// Update field states
	now := time.Now()
	for _, fieldName := range syncedFields {
		mapping, exists := s.fieldMapper.GetMappingForField(fieldName)
		if !exists {
			continue
		}

		value := s.fieldMapper.extractWARPValue(customer, mapping)

		fieldState := &FieldState{
			EntityType:            "customer",
			EntityID:              customer.ID,
			HubSpotObjectID:       hubspotCompanyID,
			FieldName:             fieldName,
			FieldPath:             mapping.WarpFieldPath,
			WarpValue:             value,
			HubSpotValue:          value,
			LastSyncedAt:          &now,
			LastSyncedDirection:   SyncDirectionWarpToHubSpot,
			LastModifiedAtWarp:    &now,
			LastModifiedAtHubSpot: &now,
			SyncDirection:         mapping.SyncDirection,
			ConflictResolution:    mapping.ConflictResolution,
			IsInConflict:          false,
		}

		if err := s.syncRepo.UpsertFieldState(ctx, fieldState); err != nil {
			s.logger.Warn("Failed to update field state",
				zap.String("field", fieldName),
				zap.Error(err),
			)
		}
	}

	// Mark sync as successful
	if err := s.syncRepo.UpdateSyncLogStatus(ctx, syncLog.ID, SyncStatusSuccess, ""); err != nil {
		return nil, fmt.Errorf("failed to update sync log: %w", err)
	}

	s.logger.Info("Customer synced to HubSpot successfully",
		zap.String("customer_id", customer.ID.String()),
		zap.String("hubspot_company_id", hubspotCompanyID),
		zap.Int("fields_synced", len(syncedFields)),
	)

	return &SyncResult{
		Success:          true,
		HubSpotCompanyID: hubspotCompanyID,
		FieldsSynced:     syncedFields,
		SyncLogID:        syncLog.ID.String(),
		Message:          "Customer synced successfully",
	}, nil
}

// QueueCustomerSync queues a customer for async sync
func (s *SyncService) QueueCustomerSync(ctx context.Context, customerID uuid.UUID, direction SyncDirection, priority int) error {
	item := &SyncQueueItem{
		EntityType:   "customer",
		EntityID:     customerID,
		Operation:    "UPDATE",
		Direction:    direction,
		Payload:      make(map[string]interface{}),
		Priority:     priority,
		ScheduledFor: time.Now(),
		MaxRetries:   3,
		Status:       "QUEUED",
	}

	return s.syncRepo.QueueSync(ctx, item)
}

// ProcessSyncQueue processes pending sync queue items
func (s *SyncService) ProcessSyncQueue(ctx context.Context, batchSize int) error {
	items, err := s.syncRepo.GetPendingSyncItems(ctx, batchSize)
	if err != nil {
		return fmt.Errorf("failed to get pending items: %w", err)
	}

	s.logger.Info("Processing sync queue",
		zap.Int("items", len(items)),
	)

	for _, item := range items {
		if err := s.processSyncItem(ctx, item); err != nil {
			s.logger.Error("Failed to process sync item",
				zap.String("item_id", item.ID.String()),
				zap.Error(err),
			)

			// Retry with exponential backoff
			if item.RetryCount < item.MaxRetries {
				retryDelay := time.Duration(1<<item.RetryCount) * time.Second
				s.syncRepo.IncrementQueueItemRetry(ctx, item.ID, retryDelay)
			} else {
				// Max retries exceeded
				s.syncRepo.UpdateQueueItemStatus(ctx, item.ID, "FAILED", err.Error())
			}
		} else {
			s.syncRepo.UpdateQueueItemStatus(ctx, item.ID, "COMPLETED", "")
		}
	}

	return nil
}

// processSyncItem processes a single sync queue item
func (s *SyncService) processSyncItem(ctx context.Context, item *SyncQueueItem) error {
	switch item.EntityType {
	case "customer":
		customer, err := s.customerRepo.GetByID(ctx, item.EntityID)
		if err != nil {
			return fmt.Errorf("failed to get customer: %w", err)
		}
		if customer == nil {
			return fmt.Errorf("customer not found")
		}

		if item.Direction == SyncDirectionWarpToHubSpot {
			_, err := s.SyncCustomerToHubSpot(ctx, customer)
			return err
		}

		// TODO: Implement SyncCustomerFromHubSpot
		return fmt.Errorf("sync direction not implemented: %s", item.Direction)

	default:
		return fmt.Errorf("unsupported entity type: %s", item.EntityType)
	}
}
