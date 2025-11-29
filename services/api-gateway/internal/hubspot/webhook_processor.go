package hubspot

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"go.uber.org/zap"
)

// WebhookProcessor handles processing of HubSpot webhook events
type WebhookProcessor struct {
	syncService  *SyncService
	syncRepo     SyncRepository
	customerRepo CustomerRepository
	fieldMapper  *FieldMapper
	logger       *zap.Logger
}

// NewWebhookProcessor creates a new webhook processor
func NewWebhookProcessor(
	syncService *SyncService,
	syncRepo SyncRepository,
	customerRepo CustomerRepository,
	fieldMapper *FieldMapper,
	logger *zap.Logger,
) *WebhookProcessor {
	return &WebhookProcessor{
		syncService:  syncService,
		syncRepo:     syncRepo,
		customerRepo: customerRepo,
		fieldMapper:  fieldMapper,
		logger:       logger,
	}
}

// ProcessCompanyPropertyChange processes a company.propertyChange event
func (wp *WebhookProcessor) ProcessCompanyPropertyChange(ctx context.Context, event *WebhookEvent) error {
	wp.logger.Info("Processing company property change",
		zap.String("event_id", event.EventID),
		zap.String("object_id", event.ObjectID),
		zap.String("property_name", event.PropertyName),
	)

	// Find WARP customer by HubSpot company ID
	customer, err := wp.findCustomerByHubSpotID(ctx, event.ObjectID)
	if err != nil {
		return fmt.Errorf("failed to find customer: %w", err)
	}
	if customer == nil {
		wp.logger.Warn("No WARP customer found for HubSpot company",
			zap.String("hubspot_company_id", event.ObjectID),
		)
		return nil // Not an error - this HubSpot company might not be synced yet
	}

	// Get field mapping for this HubSpot property
	mapping, fieldName, exists := wp.fieldMapper.GetMappingForHubSpotProperty(event.PropertyName)
	if !exists {
		wp.logger.Debug("Property not mapped, ignoring",
			zap.String("property_name", event.PropertyName),
		)
		return nil
	}

	// Check if this field should sync FROM HubSpot
	if !wp.fieldMapper.ShouldSyncFromHubSpot(fieldName) {
		wp.logger.Debug("Field sync direction does not allow HubSpot → WARP",
			zap.String("field_name", fieldName),
			zap.String("direction", string(mapping.SyncDirection)),
		)
		return nil
	}

	// Check for conflict (was WARP also modified recently?)
	conflict, err := wp.detectConflict(ctx, customer.ID, fieldName, event.OccurredAt)
	if err != nil {
		return fmt.Errorf("failed to detect conflict: %w", err)
	}

	if conflict != nil {
		wp.logger.Warn("Conflict detected",
			zap.String("field_name", fieldName),
			zap.String("resolution", string(mapping.ConflictResolution)),
		)

		// Apply conflict resolution
		shouldUpdate := wp.resolveConflict(mapping.ConflictResolution, conflict)
		if !shouldUpdate {
			wp.logger.Info("Conflict resolution: WARP value wins, skipping update",
				zap.String("field_name", fieldName),
			)
			return nil
		}
	}

	// Update WARP customer with HubSpot value
	updateReq, _ := wp.fieldMapper.MapHubSpotToWARP(map[string]interface{}{
		event.PropertyName: event.PropertyValue,
	})

	updatedCustomer, err := wp.customerRepo.Update(ctx, customer.ID, updateReq, "hubspot_webhook")
	if err != nil {
		return fmt.Errorf("failed to update customer: %w", err)
	}

	wp.logger.Info("Customer updated from HubSpot webhook",
		zap.String("customer_id", customer.ID.String()),
		zap.String("field_name", fieldName),
		zap.String("property_name", event.PropertyName),
		zap.Any("new_value", event.PropertyValue),
	)

	// Update field state
	now := time.Now()
	fieldState := &FieldState{
		EntityType:            "customer",
		EntityID:              customer.ID,
		HubSpotObjectID:       event.ObjectID,
		FieldName:             fieldName,
		HubSpotValue:          event.PropertyValue,
		WarpValue:             event.PropertyValue,
		LastSyncedAt:          &now,
		LastSyncedDirection:   SyncDirectionHubSpotToWarp,
		LastModifiedAtHubSpot: &event.OccurredAt,
		LastModifiedAtWarp:    &updatedCustomer.UpdatedAt,
		SyncDirection:         mapping.SyncDirection,
		ConflictResolution:    mapping.ConflictResolution,
		IsInConflict:          false,
	}

	wp.syncRepo.UpsertFieldState(ctx, fieldState)

	return nil
}

// findCustomerByHubSpotID finds a WARP customer by HubSpot company ID
func (wp *WebhookProcessor) findCustomerByHubSpotID(ctx context.Context, hubspotCompanyID string) (*models.Customer, error) {
	// CustomerRepository needs GetByHubSpotID method
	// For now, cast to concrete type to access the method
	if concreteRepo, ok := wp.customerRepo.(interface {
		GetByHubSpotID(ctx context.Context, hubspotCompanyID string) (*models.Customer, error)
	}); ok {
		return concreteRepo.GetByHubSpotID(ctx, hubspotCompanyID)
	}
	return nil, fmt.Errorf("GetByHubSpotID not available on repository")
}

// detectConflict checks if both WARP and HubSpot modified the field since last sync
func (wp *WebhookProcessor) detectConflict(ctx context.Context, customerID uuid.UUID, fieldName string, hubspotModifiedAt time.Time) (*ConflictInfo, error) {
	// Get field state
	fieldState, err := wp.syncRepo.GetFieldState(ctx, "customer", customerID, fieldName)
	if err != nil {
		// No previous state - no conflict
		return nil, nil
	}

	// Check if WARP was modified since last sync
	if fieldState.LastSyncedAt != nil && fieldState.LastModifiedAtWarp != nil {
		warpModifiedAfterSync := fieldState.LastModifiedAtWarp.After(*fieldState.LastSyncedAt)
		hubspotModifiedAfterSync := hubspotModifiedAt.After(*fieldState.LastSyncedAt)

		if warpModifiedAfterSync && hubspotModifiedAfterSync {
			// Both modified since last sync - conflict!
			return &ConflictInfo{
				FieldName:         fieldName,
				WarpValue:         fieldState.WarpValue,
				HubSpotValue:      fieldState.HubSpotValue,
				WarpModifiedAt:    *fieldState.LastModifiedAtWarp,
				HubSpotModifiedAt: hubspotModifiedAt,
			}, nil
		}
	}

	return nil, nil
}

// resolveConflict applies conflict resolution strategy
func (wp *WebhookProcessor) resolveConflict(resolution ConflictResolution, conflict *ConflictInfo) bool {
	switch resolution {
	case ConflictResolutionHubSpotWins:
		return true // Use HubSpot value
	case ConflictResolutionWarpWins:
		return false // Keep WARP value
	case ConflictResolutionLatestWins:
		// Compare timestamps
		return conflict.HubSpotModifiedAt.After(conflict.WarpModifiedAt)
	case ConflictResolutionManual:
		// Flag for manual review - for now, don't update
		wp.logger.Warn("Manual conflict resolution required",
			zap.String("field_name", conflict.FieldName),
		)
		return false
	default:
		return false
	}
}
