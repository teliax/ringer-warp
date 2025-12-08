// Package services provides business logic services for the API Gateway
// Date: 2025-12-08
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/soa"
	"go.uber.org/zap"
)

// ErrAccessDenied indicates the user doesn't have access to the resource
var ErrAccessDenied = errors.New("access denied")

// ErrNumberNotFound indicates the number was not found
var ErrNumberNotFound = errors.New("number not found")

// NumberService handles number inventory operations with JIT provisioning
// All searches pass through to SOA in real-time - RNS does not maintain
// a local pool of unassigned numbers.
type NumberService struct {
	repo      *repository.NumberRepository
	soaClient *soa.Client
	logger    *zap.Logger
}

// NewNumberService creates a new NumberService instance
func NewNumberService(
	repo *repository.NumberRepository,
	soaClient *soa.Client,
	logger *zap.Logger,
) *NumberService {
	return &NumberService{
		repo:      repo,
		soaClient: soaClient,
		logger:    logger,
	}
}

// SearchAvailableNumbers searches SOA for available numbers in real-time (JIT)
// This is a pass-through to SOA - no local caching
func (s *NumberService) SearchAvailableNumbers(ctx context.Context, req *models.SearchNumbersRequest) (*models.NumberSearchResponse, error) {
	// Build SOA search options
	opts := soa.SearchOptions{
		NPA:        req.NPA,
		NXX:        req.NXX,
		State:      req.State,
		LATA:       req.LATA,
		RateCenter: req.RateCenter,
		Page:       req.Page,
		Size:       req.Size,
	}

	// Default page size
	if opts.Size == 0 {
		opts.Size = 50
	}

	s.logger.Debug("Searching SOA for available numbers",
		zap.String("npa", opts.NPA),
		zap.String("state", opts.State),
		zap.Int("page", opts.Page),
		zap.Int("size", opts.Size),
	)

	// Query SOA API
	soaResp, err := s.soaClient.SearchAvailableNumbers(ctx, opts)
	if err != nil {
		s.logger.Error("SOA search failed", zap.Error(err))
		return nil, fmt.Errorf("failed to search available numbers: %w", err)
	}

	// Convert SOA response to our model
	results := make([]models.NumberSearchResult, 0, len(soaResp.Content))
	for _, n := range soaResp.Content {
		results = append(results, models.NumberSearchResult{
			TelephoneNumber: n.TelephoneNumber,
			NPA:             n.NPA,
			NXX:             n.NXX,
			State:           n.State,
			LATA:            n.LATA,
			RateCenter:      n.Locality,
			MonthlyRate:     0, // TODO: Get pricing from billing service
		})
	}

	// Calculate pagination
	totalPages := 1
	if opts.Size > 0 && soaResp.TotalElements > 0 {
		totalPages = int((soaResp.TotalElements + int64(opts.Size) - 1) / int64(opts.Size))
	}

	return &models.NumberSearchResponse{
		Numbers:       results,
		TotalElements: soaResp.TotalElements,
		TotalPages:    totalPages,
		Page:          opts.Page,
		Size:          opts.Size,
	}, nil
}

// ReserveNumbers temporarily reserves numbers in SOA
// Status transition: AVAILABLE → RESERVED
func (s *NumberService) ReserveNumbers(ctx context.Context, numbers []string, reservedBy string) ([]soa.NumberInventory, []error) {
	reserved := make([]soa.NumberInventory, 0, len(numbers))
	errs := make([]error, 0)

	for _, tn := range numbers {
		result, err := s.soaClient.ReserveNumber(ctx, tn, reservedBy)
		if err != nil {
			s.logger.Warn("Failed to reserve number",
				zap.String("number", tn),
				zap.Error(err),
			)
			errs = append(errs, fmt.Errorf("%s: %w", tn, err))
			continue
		}
		reserved = append(reserved, *result)
	}

	return reserved, errs
}

// PurchaseNumbers purchases reserved numbers and assigns them to a customer
// This is the main JIT provisioning operation:
// 1. Assign numbers in SOA (RESERVED → IN_USE)
// 2. Store in local database with customer link
func (s *NumberService) PurchaseNumbers(
	ctx context.Context,
	req *models.PurchaseNumberRequest,
	customerID uuid.UUID,
	createdBy uuid.UUID,
) ([]models.AssignedNumber, []error) {
	purchased := make([]models.AssignedNumber, 0, len(req.Numbers))
	errs := make([]error, 0)

	for _, tn := range req.Numbers {
		// Step 1: Assign in SOA
		soaReq := &soa.AssignRequest{
			ApplicationID: customerID.String(),
			Metadata: map[string]interface{}{
				"customer_id": customerID.String(),
				"created_by":  createdBy.String(),
				"source":      "ringer-warp",
			},
		}

		soaNumber, err := s.soaClient.AssignNumber(ctx, tn, soaReq)
		if err != nil {
			s.logger.Error("Failed to assign number in SOA",
				zap.String("number", tn),
				zap.Error(err),
			)
			errs = append(errs, fmt.Errorf("%s: %w", tn, err))
			continue
		}

		// Step 2: Create local record
		localNumber := &models.AssignedNumber{
			CustomerID:    customerID,
			Number:        soaNumber.TelephoneNumber,
			SOANumberID:   &soaNumber.ID,
			SOASyncStatus: "SYNCED",
			NumberType:    "DID", // Default, could be determined from TN format
			NPA:           strPtr(soaNumber.NPA),
			NXX:           strPtr(soaNumber.NXX),
			RateCenter:    strPtr(soaNumber.Locality),
			State:         strPtr(soaNumber.State),
			VoiceEnabled:  req.VoiceEnabled,
			SMSEnabled:    req.SMSEnabled,
			TrunkID:       req.TrunkID,
			CampaignID:    req.CampaignID,
			Active:        true,
			ActivatedAt:   time.Now(),
			CreatedBy:     &createdBy,
			UpdatedBy:     &createdBy,
		}

		// Check if toll-free
		if isTollFree(tn) {
			localNumber.NumberType = "TOLL_FREE"
		}

		created, err := s.repo.Create(ctx, localNumber)
		if err != nil {
			s.logger.Error("Failed to create local number record",
				zap.String("number", tn),
				zap.Error(err),
			)
			// Number is assigned in SOA but failed locally - mark for reconciliation
			errs = append(errs, fmt.Errorf("%s: local save failed: %w", tn, err))
			continue
		}

		s.logger.Info("Number purchased and assigned",
			zap.String("number", tn),
			zap.String("customer_id", customerID.String()),
			zap.String("local_id", created.ID.String()),
		)

		purchased = append(purchased, *created)
	}

	return purchased, errs
}

// GetNumber retrieves a specific number from local database
// customerFilter is used for multi-tenant access control
func (s *NumberService) GetNumber(ctx context.Context, numberID uuid.UUID, customerFilter []uuid.UUID) (*models.AssignedNumber, error) {
	number, err := s.repo.GetByID(ctx, numberID)
	if err != nil {
		return nil, err
	}
	if number == nil {
		return nil, ErrNumberNotFound
	}

	// Check customer access (nil filter = superadmin access to all)
	if !s.hasCustomerAccess(number.CustomerID, customerFilter) {
		return nil, ErrAccessDenied
	}

	return number, nil
}

// GetNumberByTN retrieves a number by telephone number
func (s *NumberService) GetNumberByTN(ctx context.Context, tn string, customerFilter []uuid.UUID) (*models.AssignedNumber, error) {
	number, err := s.repo.GetByNumber(ctx, tn)
	if err != nil {
		return nil, err
	}
	if number == nil {
		return nil, ErrNumberNotFound
	}

	// Check customer access
	if !s.hasCustomerAccess(number.CustomerID, customerFilter) {
		return nil, ErrAccessDenied
	}

	return number, nil
}

// ListNumbers retrieves all numbers for accessible customers
func (s *NumberService) ListNumbers(
	ctx context.Context,
	customerFilter []uuid.UUID,
	page, perPage int,
	activeOnly bool,
) (*models.NumberListResponse, error) {
	// For now, require at least one customer in the filter
	// SuperAdmin should pass a specific customer ID
	if len(customerFilter) == 0 {
		return &models.NumberListResponse{
			Numbers:       []models.AssignedNumber{},
			TotalElements: 0,
			TotalPages:    0,
			Page:          page,
			Size:          perPage,
		}, nil
	}

	// Use first customer for now (TODO: support multi-customer queries)
	customerID := customerFilter[0]

	opts := repository.ListNumberOptions{
		Page:            page,
		PerPage:         perPage,
		IncludeReleased: !activeOnly,
	}

	numbers, total, err := s.repo.ListByCustomer(ctx, customerID, opts)
	if err != nil {
		return nil, err
	}

	totalPages := 1
	if perPage > 0 && total > 0 {
		totalPages = int((total + int64(perPage) - 1) / int64(perPage))
	}

	return &models.NumberListResponse{
		Numbers:       numbers,
		TotalElements: total,
		TotalPages:    totalPages,
		Page:          page,
		Size:          perPage,
	}, nil
}

// UpdateNumber updates a number's configuration
func (s *NumberService) UpdateNumber(
	ctx context.Context,
	numberID uuid.UUID,
	req *models.UpdateNumberRequest,
	customerFilter []uuid.UUID,
	updatedBy uuid.UUID,
) (*models.AssignedNumber, error) {
	// Verify access
	number, err := s.GetNumber(ctx, numberID, customerFilter)
	if err != nil {
		return nil, err
	}

	// Update local record
	updated, err := s.repo.Update(ctx, numberID, req, updatedBy)
	if err != nil {
		return nil, err
	}

	// Sync metadata to SOA if we have SOA ID
	if number.SOANumberID != nil {
		metadata := map[string]interface{}{
			"updated_by":    updatedBy.String(),
			"updated_at":    time.Now().Format(time.RFC3339),
			"voice_enabled": updated.VoiceEnabled,
			"sms_enabled":   updated.SMSEnabled,
			"mms_enabled":   updated.MMSEnabled,
		}

		if updated.CampaignID != nil {
			metadata["campaign_id"] = updated.CampaignID.String()
		}
		if updated.TrunkID != nil {
			metadata["trunk_id"] = updated.TrunkID.String()
		}

		_, err := s.soaClient.UpdateMetadata(ctx, number.Number, metadata)
		if err != nil {
			s.logger.Warn("Failed to sync metadata to SOA",
				zap.String("number", number.Number),
				zap.Error(err),
			)
			// Mark as pending sync - don't fail the operation
			_ = s.repo.UpdateSOASyncStatus(ctx, numberID, "PENDING")
		}
	}

	return updated, nil
}

// ReleaseNumber releases a number back to SOA
// Status in SOA: IN_USE → RESERVED (for audit/grooming, not AVAILABLE)
// Local: Sets released_at timestamp, keeps record for billing
func (s *NumberService) ReleaseNumber(
	ctx context.Context,
	numberID uuid.UUID,
	req *models.ReleaseNumberRequest,
	customerFilter []uuid.UUID,
	releasedBy uuid.UUID,
) error {
	// Verify access
	number, err := s.GetNumber(ctx, numberID, customerFilter)
	if err != nil {
		return err
	}

	if !number.Active {
		return fmt.Errorf("number already released")
	}

	// Step 1: Release in SOA (sets to RESERVED status)
	_, err = s.soaClient.ReleaseNumber(ctx, number.Number)
	if err != nil {
		// Check if it's already released in SOA (idempotent)
		if !soa.IsNotFound(err) {
			s.logger.Error("Failed to release number in SOA",
				zap.String("number", number.Number),
				zap.Error(err),
			)
			return fmt.Errorf("failed to release in upstream: %w", err)
		}
		s.logger.Warn("Number not found in SOA (may be already released)",
			zap.String("number", number.Number),
		)
	}

	// Step 2: Mark as released locally (keep record for billing proration)
	_, err = s.repo.Release(ctx, numberID, req.Reason, releasedBy)
	if err != nil {
		s.logger.Error("Failed to mark number as released locally",
			zap.String("number", number.Number),
			zap.Error(err),
		)
		return fmt.Errorf("released in SOA but failed to update local: %w", err)
	}

	s.logger.Info("Number released",
		zap.String("number", number.Number),
		zap.String("reason", req.Reason),
		zap.String("released_by", releasedBy.String()),
	)

	return nil
}

// GetInventorySummary retrieves aggregate statistics for a customer's numbers
func (s *NumberService) GetInventorySummary(ctx context.Context, customerID uuid.UUID) (*models.NumberInventorySummary, error) {
	return s.repo.GetInventorySummary(ctx, customerID)
}

// SyncFromSOA syncs a number's status from SOA to local database
func (s *NumberService) SyncFromSOA(ctx context.Context, numberID uuid.UUID, customerFilter []uuid.UUID) (*models.AssignedNumber, error) {
	// Get local record (verifies access)
	number, err := s.GetNumber(ctx, numberID, customerFilter)
	if err != nil {
		return nil, err
	}

	// Fetch from SOA
	soaNumber, err := s.soaClient.GetNumberDetails(ctx, number.Number)
	if err != nil {
		if soa.IsNotFound(err) {
			// Number no longer in SOA - mark as failed sync
			_ = s.repo.UpdateSOASyncStatus(ctx, numberID, "FAILED")
			return nil, fmt.Errorf("number not found in SOA")
		}
		return nil, fmt.Errorf("failed to fetch from SOA: %w", err)
	}

	// Update local record with SOA data
	now := time.Now()
	number.SOANumberID = &soaNumber.ID
	number.SOALastSynced = &now
	number.SOASyncStatus = "SYNCED"

	// Update any changed fields
	if soaNumber.NPA != "" {
		number.NPA = &soaNumber.NPA
	}
	if soaNumber.NXX != "" {
		number.NXX = &soaNumber.NXX
	}
	if soaNumber.State != "" {
		number.State = &soaNumber.State
	}
	if soaNumber.Locality != "" {
		number.RateCenter = &soaNumber.Locality
	}

	// Update sync status
	_ = s.repo.UpdateSOASyncStatus(ctx, numberID, "SYNCED")

	return number, nil
}

// hasCustomerAccess checks if the given customerID is in the filter
// nil filter means superadmin with access to all
func (s *NumberService) hasCustomerAccess(customerID uuid.UUID, filter []uuid.UUID) bool {
	// nil filter = superadmin access to all
	if filter == nil {
		return true
	}

	for _, id := range filter {
		if id == customerID {
			return true
		}
	}
	return false
}

// Helper functions

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func isTollFree(tn string) bool {
	// Toll-free NPAs: 800, 833, 844, 855, 866, 877, 888
	tollFreeNPAs := map[string]bool{
		"800": true, "833": true, "844": true,
		"855": true, "866": true, "877": true, "888": true,
	}

	// Extract NPA from E.164 format (+1NPANXXXXXX)
	if len(tn) >= 5 {
		npa := ""
		if tn[0] == '+' {
			npa = tn[2:5] // +1NPA...
		} else if len(tn) >= 3 {
			npa = tn[0:3] // NPA...
		}
		return tollFreeNPAs[npa]
	}
	return false
}
