package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type VendorRepository struct {
	db *pgxpool.Pool
}

func NewVendorRepository(db *pgxpool.Pool) *VendorRepository {
	return &VendorRepository{db: db}
}

// CreateVoiceVendor creates a new voice vendor
func (r *VendorRepository) CreateVoiceVendor(ctx context.Context, req *models.CreateVoiceVendorRequest) (*models.VoiceVendor, error) {
	query := `
		INSERT INTO voice.vendors (
			vendor_code, vendor_name, vendor_type, billing_model,
			sip_endpoints, auth_type, supported_codecs, capacity_cps
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, vendor_code, vendor_name, vendor_type, billing_model,
		          sip_endpoints, auth_type, supported_codecs, capacity_cps,
		          active, health_status, created_at, updated_at
	`

	vendor := &models.VoiceVendor{}
	err := r.db.QueryRow(ctx, query,
		req.VendorCode,
		req.VendorName,
		req.VendorType,
		req.BillingModel,
		req.SIPEndpoints,
		req.AuthType,
		req.SupportedCodecs,
		req.CapacityCPS,
	).Scan(
		&vendor.ID,
		&vendor.VendorCode,
		&vendor.VendorName,
		&vendor.VendorType,
		&vendor.BillingModel,
		&vendor.SIPEndpoints,
		&vendor.AuthType,
		&vendor.SupportedCodecs,
		&vendor.CapacityCPS,
		&vendor.Active,
		&vendor.HealthStatus,
		&vendor.CreatedAt,
		&vendor.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create voice vendor: %w", err)
	}

	return vendor, nil
}

// ListVoiceVendors retrieves all voice vendors
func (r *VendorRepository) ListVoiceVendors(ctx context.Context, activeOnly bool) ([]models.VoiceVendor, error) {
	query := `
		SELECT id, vendor_code, vendor_name, vendor_type, billing_model,
		       sip_endpoints, auth_type, supported_codecs, capacity_cps,
		       active, health_status, created_at, updated_at
		FROM voice.vendors
		WHERE 1=1
	`

	args := []interface{}{}
	if activeOnly {
		query += " AND active = $1"
		args = append(args, true)
	}

	query += " ORDER BY vendor_name"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list voice vendors: %w", err)
	}
	defer rows.Close()

	vendors := []models.VoiceVendor{}
	for rows.Next() {
		var v models.VoiceVendor
		err := rows.Scan(
			&v.ID, &v.VendorCode, &v.VendorName, &v.VendorType, &v.BillingModel,
			&v.SIPEndpoints, &v.AuthType, &v.SupportedCodecs, &v.CapacityCPS,
			&v.Active, &v.HealthStatus, &v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan voice vendor: %w", err)
		}
		vendors = append(vendors, v)
	}

	return vendors, nil
}

// CreateSMSVendor creates a new SMS vendor
func (r *VendorRepository) CreateSMSVendor(ctx context.Context, req *models.CreateSMSVendorRequest) (*models.SMSVendor, error) {
	query := `
		INSERT INTO messaging.vendors (
			vendor_name, vendor_type, smpp_config, sms_rate, throughput_limit
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, vendor_name, vendor_type, smpp_config, sms_rate,
		          throughput_limit, active, health_status, last_health_check,
		          created_at, updated_at
	`

	vendor := &models.SMSVendor{}
	err := r.db.QueryRow(ctx, query,
		req.VendorName,
		req.VendorType,
		req.SMPPConfig,
		req.SMSRate,
		coalesce(req.ThroughputLimit, 100),
	).Scan(
		&vendor.ID,
		&vendor.VendorName,
		&vendor.VendorType,
		&vendor.SMPPConfig,
		&vendor.SMSRate,
		&vendor.ThroughputLimit,
		&vendor.Active,
		&vendor.HealthStatus,
		&vendor.LastHealthCheck,
		&vendor.CreatedAt,
		&vendor.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create SMS vendor: %w", err)
	}

	return vendor, nil
}

// ListSMSVendors retrieves all SMS vendors
func (r *VendorRepository) ListSMSVendors(ctx context.Context) ([]models.SMSVendor, error) {
	query := `
		SELECT id, vendor_name, vendor_type, smpp_config, sms_rate,
		       throughput_limit, active, health_status, last_health_check,
		       created_at, updated_at
		FROM messaging.vendors
		ORDER BY vendor_name
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list SMS vendors: %w", err)
	}
	defer rows.Close()

	vendors := []models.SMSVendor{}
	for rows.Next() {
		var v models.SMSVendor
		err := rows.Scan(
			&v.ID, &v.VendorName, &v.VendorType, &v.SMPPConfig, &v.SMSRate,
			&v.ThroughputLimit, &v.Active, &v.HealthStatus, &v.LastHealthCheck,
			&v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan SMS vendor: %w", err)
		}
		vendors = append(vendors, v)
	}

	return vendors, nil
}
