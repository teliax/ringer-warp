package services

import (
	"context"
	"fmt"

	"github.com/ringer-warp/api-gateway/internal/clients/jasmin"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
)

// VendorService handles business logic for vendor management
type VendorService interface {
	CreateSMPPVendor(ctx context.Context, req *models.CreateSMPPVendorRequest) (*models.SMPPVendor, error)
	ListSMPPVendors(ctx context.Context) ([]*models.SMPPVendor, error)
	GetSMPPVendor(ctx context.Context, id string) (*models.SMPPVendor, error)
	UpdateSMPPVendor(ctx context.Context, id string, req *models.CreateSMPPVendorRequest) (*models.SMPPVendor, error)
	DeleteSMPPVendor(ctx context.Context, id string) error
	BindSMPPVendor(ctx context.Context, id string) error
	GetSMPPVendorStatus(ctx context.Context, id string) (*models.SMPPVendorStatus, error)
}

// vendorService implements VendorService
type vendorService struct {
	repo        repository.VendorRepository
	jasminClient *jasmin.JCliClient
}

// NewVendorService creates a new vendor service
func NewVendorService(repo repository.VendorRepository, jasminHost string, jasminPort int, jasminPassword string) VendorService {
	return &vendorService{
		repo:        repo,
		jasminClient: jasmin.NewJCliClient(jasminHost, jasminPort, jasminPassword),
	}
}

// CreateSMPPVendor creates a new SMPP vendor and configures it in Jasmin
func (s *vendorService) CreateSMPPVendor(ctx context.Context, req *models.CreateSMPPVendorRequest) (*models.SMPPVendor, error) {
	// 1. Create vendor model
	vendor := &models.SMPPVendor{
		Name:       req.Name,
		Host:       req.Host,
		Port:       req.Port,
		UseTLS:     req.UseTLS,
		BindType:   req.BindType,
		Priority:   req.Priority,
		Throughput: req.Throughput,
		IsActive:   true,
		Status:     "created",
	}

	// 2. Save to database
	if err := s.repo.Create(ctx, vendor); err != nil {
		return nil, fmt.Errorf("failed to save vendor: %w", err)
	}

	// 3. Create connector in Jasmin
	connector := &jasmin.SMPPConnector{
		CID:              vendor.ID,
		Host:             vendor.Host,
		Port:             vendor.Port,
		SSL:              vendor.UseTLS,
		Username:         "", // IP-based auth
		Password:         "", // IP-based auth
		BindType:         vendor.BindType,
		SubmitThroughput: vendor.Throughput,
		Priority:         vendor.Priority,
	}

	if err := s.jasminClient.CreateSMPPConnector(connector); err != nil {
		return nil, fmt.Errorf("failed to create Jasmin connector: %w", err)
	}

	// 4. Auto-start the bind if it's the primary vendor
	if vendor.IsPrimary {
		if err := s.jasminClient.StartConnector(vendor.ID); err != nil {
			// Log error but don't fail - can be started manually
			vendor.Status = "created_bind_failed"
		} else {
			vendor.Status = "bound"
		}
	}

	return vendor, nil
}

// ListSMPPVendors returns all SMPP vendors
func (s *vendorService) ListSMPPVendors(ctx context.Context) ([]*models.SMPPVendor, error) {
	return s.repo.List(ctx)
}

// GetSMPPVendor retrieves a specific SMPP vendor
func (s *vendorService) GetSMPPVendor(ctx context.Context, id string) (*models.SMPPVendor, error) {
	return s.repo.GetByID(ctx, id)
}

// UpdateSMPPVendor updates an SMPP vendor configuration
func (s *vendorService) UpdateSMPPVendor(ctx context.Context, id string, req *models.CreateSMPPVendorRequest) (*models.SMPPVendor, error) {
	// TODO: Implement
	// 1. Update database
	// 2. Update Jasmin connector if bind is active
	return nil, fmt.Errorf("not implemented")
}

// DeleteSMPPVendor removes an SMPP vendor
func (s *vendorService) DeleteSMPPVendor(ctx context.Context, id string) error {
	// 1. Stop bind in Jasmin
	if err := s.jasminClient.StopConnector(id); err != nil {
		// Log error but continue
	}

	// 2. Soft delete in database
	return s.repo.Delete(ctx, id)
}

// BindSMPPVendor starts the SMPP bind for a vendor
func (s *vendorService) BindSMPPVendor(ctx context.Context, id string) error {
	// Start connector in Jasmin
	return s.jasminClient.StartConnector(id)
}

// GetSMPPVendorStatus retrieves the current bind status from Jasmin
func (s *vendorService) GetSMPPVendorStatus(ctx context.Context, id string) (*models.SMPPVendorStatus, error) {
	// Get vendor from database
	vendor, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Get status from Jasmin
	statusOutput, err := s.jasminClient.GetConnectorStatus()
	if err != nil {
		return &models.SMPPVendorStatus{
			VendorID:   id,
			VendorName: vendor.Name,
			Status:     "error",
			Bound:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// Parse status output
	// TODO: Parse Jasmin status output properly
	bound := false
	if statusOutput != "" {
		// Simple check - improve parsing later
		bound = true
	}

	return &models.SMPPVendorStatus{
		VendorID:   id,
		VendorName: vendor.Name,
		Status:     vendor.Status,
		Bound:      bound,
	}, nil
}
