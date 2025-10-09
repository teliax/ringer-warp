package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

// VendorRepository handles database operations for vendors
type VendorRepository interface {
	Create(ctx context.Context, vendor *models.SMPPVendor) error
	GetByID(ctx context.Context, id string) (*models.SMPPVendor, error)
	List(ctx context.Context) ([]*models.SMPPVendor, error)
	Update(ctx context.Context, vendor *models.SMPPVendor) error
	Delete(ctx context.Context, id string) error
}

// vendorRepo implements VendorRepository
type vendorRepo struct {
	db *pgxpool.Pool
}

// NewVendorRepository creates a new vendor repository
func NewVendorRepository(db *pgxpool.Pool) VendorRepository {
	if db == nil {
		// Return no-op repository if database not available
		return &noopVendorRepo{}
	}
	return &vendorRepo{db: db}
}

// noopVendorRepo is a no-op implementation when database is unavailable
type noopVendorRepo struct{}

func (r *noopVendorRepo) Create(ctx context.Context, vendor *models.SMPPVendor) error {
	// Generate a temporary ID
	vendor.ID = fmt.Sprintf("temp-%d", time.Now().Unix())
	return nil
}

func (r *noopVendorRepo) GetByID(ctx context.Context, id string) (*models.SMPPVendor, error) {
	return nil, fmt.Errorf("vendor not found (database unavailable)")
}

func (r *noopVendorRepo) List(ctx context.Context) ([]*models.SMPPVendor, error) {
	return []*models.SMPPVendor{}, nil
}

func (r *noopVendorRepo) Update(ctx context.Context, vendor *models.SMPPVendor) error {
	return nil
}

func (r *noopVendorRepo) Delete(ctx context.Context, id string) error {
	return nil
}

// Create creates a new SMPP vendor in the database
func (r *vendorRepo) Create(ctx context.Context, vendor *models.SMPPVendor) error {
	query := `
		INSERT INTO vendor_mgmt.service_providers
		(provider_type, instance_name, display_name, host, port, use_tls, bind_type, priority, throughput, is_active, health_status)
		VALUES ('smpp', $1, $2, $3, $4, $5, $6, $7, $8, true, 'created')
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query,
		vendor.Name,
		vendor.Name, // display_name same as instance_name for now
		vendor.Host,
		vendor.Port,
		vendor.UseTLS,
		vendor.BindType,
		vendor.Priority,
		vendor.Throughput,
	).Scan(&vendor.ID, &vendor.CreatedAt, &vendor.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert vendor: %w", err)
	}

	return nil
}

// GetByID retrieves an SMPP vendor by ID
func (r *vendorRepo) GetByID(ctx context.Context, id string) (*models.SMPPVendor, error) {
	// TODO: Implement PostgreSQL query
	return nil, fmt.Errorf("not implemented")
}

// List retrieves all SMPP vendors
func (r *vendorRepo) List(ctx context.Context) ([]*models.SMPPVendor, error) {
	query := `
		SELECT id, instance_name, display_name, host, port, use_tls, bind_type, priority, throughput,
		       is_active, is_primary, health_status, created_at, updated_at, last_health_check
		FROM vendor_mgmt.service_providers
		WHERE provider_type = 'smpp' AND is_active = true
		ORDER BY priority ASC, created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query vendors: %w", err)
	}
	defer rows.Close()

	var vendors []*models.SMPPVendor
	for rows.Next() {
		var v models.SMPPVendor
		err := rows.Scan(
			&v.ID, &v.Name, &v.Name, &v.Host, &v.Port, &v.UseTLS, &v.BindType,
			&v.Priority, &v.Throughput, &v.IsActive, &v.IsPrimary, &v.Status,
			&v.CreatedAt, &v.UpdatedAt, &v.LastChecked,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan vendor: %w", err)
		}
		vendors = append(vendors, &v)
	}

	return vendors, nil
}

// Update updates an existing vendor
func (r *vendorRepo) Update(ctx context.Context, vendor *models.SMPPVendor) error {
	// TODO: Implement PostgreSQL update
	return fmt.Errorf("not implemented")
}

// Delete soft-deletes a vendor
func (r *vendorRepo) Delete(ctx context.Context, id string) error {
	// TODO: Implement soft delete (set is_active = false)
	return fmt.Errorf("not implemented")
}
