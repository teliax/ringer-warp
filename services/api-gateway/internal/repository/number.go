package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

// NumberRepository handles database operations for customer-assigned numbers
type NumberRepository struct {
	db *pgxpool.Pool
}

// NewNumberRepository creates a new NumberRepository
func NewNumberRepository(db *pgxpool.Pool) *NumberRepository {
	return &NumberRepository{db: db}
}

// Create creates a new assigned number record
func (r *NumberRepository) Create(ctx context.Context, number *models.AssignedNumber) (*models.AssignedNumber, error) {
	query := `
		INSERT INTO numbers.assigned_numbers (
			customer_id, number, soa_number_id, soa_sync_status,
			number_type, npa, nxx, rate_center, state,
			voice_enabled, sms_enabled, mms_enabled, fax_enabled,
			trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
			campaign_id, brand_id, tcr_status,
			e911_enabled, e911_address_id,
			cnam_enabled, cnam_display_name,
			friendly_name, description,
			active, monthly_charge, billing_start_date,
			created_by
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8, $9,
			$10, $11, $12, $13,
			$14, $15, $16, $17,
			$18, $19, $20,
			$21, $22,
			$23, $24,
			$25, $26,
			$27, $28, $29,
			$30
		)
		RETURNING id, customer_id, number, soa_number_id, soa_last_synced, soa_sync_status,
		          number_type, npa, nxx, rate_center, state,
		          voice_enabled, sms_enabled, mms_enabled, fax_enabled,
		          trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
		          campaign_id, brand_id, tcr_status,
		          e911_enabled, e911_address_id,
		          cnam_enabled, cnam_display_name,
		          friendly_name, description,
		          active, monthly_charge, billing_start_date,
		          activated_at, released_at, release_reason,
		          created_at, updated_at, created_by, updated_by
	`

	result := &models.AssignedNumber{}
	err := r.db.QueryRow(ctx, query,
		number.CustomerID, number.Number, number.SOANumberID, coalesce(number.SOASyncStatus, "SYNCED"),
		coalesce(number.NumberType, "DID"), number.NPA, number.NXX, number.RateCenter, number.State,
		number.VoiceEnabled, number.SMSEnabled, number.MMSEnabled, number.FaxEnabled,
		number.TrunkID, number.VoiceDestination, number.VoiceFailoverDestination, number.VoiceRoutingType,
		number.CampaignID, number.BrandID, number.TCRStatus,
		number.E911Enabled, number.E911AddressID,
		number.CNAMEnabled, number.CNAMDisplayName,
		number.FriendlyName, number.Description,
		coalesce(number.Active, true), number.MonthlyCharge, number.BillingStartDate,
		number.CreatedBy,
	).Scan(
		&result.ID, &result.CustomerID, &result.Number, &result.SOANumberID, &result.SOALastSynced, &result.SOASyncStatus,
		&result.NumberType, &result.NPA, &result.NXX, &result.RateCenter, &result.State,
		&result.VoiceEnabled, &result.SMSEnabled, &result.MMSEnabled, &result.FaxEnabled,
		&result.TrunkID, &result.VoiceDestination, &result.VoiceFailoverDestination, &result.VoiceRoutingType,
		&result.CampaignID, &result.BrandID, &result.TCRStatus,
		&result.E911Enabled, &result.E911AddressID,
		&result.CNAMEnabled, &result.CNAMDisplayName,
		&result.FriendlyName, &result.Description,
		&result.Active, &result.MonthlyCharge, &result.BillingStartDate,
		&result.ActivatedAt, &result.ReleasedAt, &result.ReleaseReason,
		&result.CreatedAt, &result.UpdatedAt, &result.CreatedBy, &result.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create assigned number: %w", err)
	}

	return result, nil
}

// GetByID retrieves an assigned number by its ID
func (r *NumberRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.AssignedNumber, error) {
	query := `
		SELECT id, customer_id, number, soa_number_id, soa_last_synced, soa_sync_status,
		       number_type, npa, nxx, rate_center, state,
		       voice_enabled, sms_enabled, mms_enabled, fax_enabled,
		       trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
		       campaign_id, brand_id, tcr_status,
		       e911_enabled, e911_address_id,
		       cnam_enabled, cnam_display_name,
		       friendly_name, description,
		       active, monthly_charge, billing_start_date,
		       activated_at, released_at, release_reason,
		       created_at, updated_at, created_by, updated_by
		FROM numbers.assigned_numbers
		WHERE id = $1
	`

	result := &models.AssignedNumber{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&result.ID, &result.CustomerID, &result.Number, &result.SOANumberID, &result.SOALastSynced, &result.SOASyncStatus,
		&result.NumberType, &result.NPA, &result.NXX, &result.RateCenter, &result.State,
		&result.VoiceEnabled, &result.SMSEnabled, &result.MMSEnabled, &result.FaxEnabled,
		&result.TrunkID, &result.VoiceDestination, &result.VoiceFailoverDestination, &result.VoiceRoutingType,
		&result.CampaignID, &result.BrandID, &result.TCRStatus,
		&result.E911Enabled, &result.E911AddressID,
		&result.CNAMEnabled, &result.CNAMDisplayName,
		&result.FriendlyName, &result.Description,
		&result.Active, &result.MonthlyCharge, &result.BillingStartDate,
		&result.ActivatedAt, &result.ReleasedAt, &result.ReleaseReason,
		&result.CreatedAt, &result.UpdatedAt, &result.CreatedBy, &result.UpdatedBy,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get assigned number: %w", err)
	}

	return result, nil
}

// GetByNumber retrieves an assigned number by its telephone number
func (r *NumberRepository) GetByNumber(ctx context.Context, telephoneNumber string) (*models.AssignedNumber, error) {
	query := `
		SELECT id, customer_id, number, soa_number_id, soa_last_synced, soa_sync_status,
		       number_type, npa, nxx, rate_center, state,
		       voice_enabled, sms_enabled, mms_enabled, fax_enabled,
		       trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
		       campaign_id, brand_id, tcr_status,
		       e911_enabled, e911_address_id,
		       cnam_enabled, cnam_display_name,
		       friendly_name, description,
		       active, monthly_charge, billing_start_date,
		       activated_at, released_at, release_reason,
		       created_at, updated_at, created_by, updated_by
		FROM numbers.assigned_numbers
		WHERE number = $1
	`

	result := &models.AssignedNumber{}
	err := r.db.QueryRow(ctx, query, telephoneNumber).Scan(
		&result.ID, &result.CustomerID, &result.Number, &result.SOANumberID, &result.SOALastSynced, &result.SOASyncStatus,
		&result.NumberType, &result.NPA, &result.NXX, &result.RateCenter, &result.State,
		&result.VoiceEnabled, &result.SMSEnabled, &result.MMSEnabled, &result.FaxEnabled,
		&result.TrunkID, &result.VoiceDestination, &result.VoiceFailoverDestination, &result.VoiceRoutingType,
		&result.CampaignID, &result.BrandID, &result.TCRStatus,
		&result.E911Enabled, &result.E911AddressID,
		&result.CNAMEnabled, &result.CNAMDisplayName,
		&result.FriendlyName, &result.Description,
		&result.Active, &result.MonthlyCharge, &result.BillingStartDate,
		&result.ActivatedAt, &result.ReleasedAt, &result.ReleaseReason,
		&result.CreatedAt, &result.UpdatedAt, &result.CreatedBy, &result.UpdatedBy,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get assigned number by TN: %w", err)
	}

	return result, nil
}

// ListByCustomer retrieves all assigned numbers for a customer with pagination
func (r *NumberRepository) ListByCustomer(ctx context.Context, customerID uuid.UUID, opts ListNumberOptions) ([]models.AssignedNumber, int64, error) {
	// Build query with filters
	baseQuery := `FROM numbers.assigned_numbers WHERE customer_id = $1`
	args := []interface{}{customerID}
	argPos := 2

	// Only active numbers by default
	if !opts.IncludeReleased {
		baseQuery += " AND active = true"
	}

	// Filter by voice/SMS capability
	if opts.VoiceEnabled != nil {
		baseQuery += fmt.Sprintf(" AND voice_enabled = $%d", argPos)
		args = append(args, *opts.VoiceEnabled)
		argPos++
	}
	if opts.SMSEnabled != nil {
		baseQuery += fmt.Sprintf(" AND sms_enabled = $%d", argPos)
		args = append(args, *opts.SMSEnabled)
		argPos++
	}

	// Filter by trunk/campaign
	if opts.TrunkID != nil {
		baseQuery += fmt.Sprintf(" AND trunk_id = $%d", argPos)
		args = append(args, *opts.TrunkID)
		argPos++
	}
	if opts.CampaignID != nil {
		baseQuery += fmt.Sprintf(" AND campaign_id = $%d", argPos)
		args = append(args, *opts.CampaignID)
		argPos++
	}

	// Search by number or friendly name
	if opts.Search != "" {
		baseQuery += fmt.Sprintf(" AND (number ILIKE $%d OR friendly_name ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+opts.Search+"%")
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count numbers: %w", err)
	}

	// Get paginated results
	page := coalesce(opts.Page, 1)
	perPage := coalesce(opts.PerPage, 50)
	offset := (page - 1) * perPage

	dataQuery := `
		SELECT id, customer_id, number, soa_number_id, soa_last_synced, soa_sync_status,
		       number_type, npa, nxx, rate_center, state,
		       voice_enabled, sms_enabled, mms_enabled, fax_enabled,
		       trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
		       campaign_id, brand_id, tcr_status,
		       e911_enabled, e911_address_id,
		       cnam_enabled, cnam_display_name,
		       friendly_name, description,
		       active, monthly_charge, billing_start_date,
		       activated_at, released_at, release_reason,
		       created_at, updated_at, created_by, updated_by
	` + baseQuery + fmt.Sprintf(" ORDER BY number ASC LIMIT $%d OFFSET $%d", argPos, argPos+1)

	args = append(args, perPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list numbers: %w", err)
	}
	defer rows.Close()

	numbers := []models.AssignedNumber{}
	for rows.Next() {
		var n models.AssignedNumber
		err := rows.Scan(
			&n.ID, &n.CustomerID, &n.Number, &n.SOANumberID, &n.SOALastSynced, &n.SOASyncStatus,
			&n.NumberType, &n.NPA, &n.NXX, &n.RateCenter, &n.State,
			&n.VoiceEnabled, &n.SMSEnabled, &n.MMSEnabled, &n.FaxEnabled,
			&n.TrunkID, &n.VoiceDestination, &n.VoiceFailoverDestination, &n.VoiceRoutingType,
			&n.CampaignID, &n.BrandID, &n.TCRStatus,
			&n.E911Enabled, &n.E911AddressID,
			&n.CNAMEnabled, &n.CNAMDisplayName,
			&n.FriendlyName, &n.Description,
			&n.Active, &n.MonthlyCharge, &n.BillingStartDate,
			&n.ActivatedAt, &n.ReleasedAt, &n.ReleaseReason,
			&n.CreatedAt, &n.UpdatedAt, &n.CreatedBy, &n.UpdatedBy,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan number: %w", err)
		}
		numbers = append(numbers, n)
	}

	return numbers, total, nil
}

// Update updates an assigned number's configuration
func (r *NumberRepository) Update(ctx context.Context, id uuid.UUID, updates *models.UpdateNumberRequest, updatedBy uuid.UUID) (*models.AssignedNumber, error) {
	setClause := []string{}
	args := []interface{}{}
	argPos := 1

	// Voice configuration
	if updates.VoiceEnabled != nil {
		setClause = append(setClause, fmt.Sprintf("voice_enabled = $%d", argPos))
		args = append(args, *updates.VoiceEnabled)
		argPos++
	}
	if updates.VoiceDestination != nil {
		setClause = append(setClause, fmt.Sprintf("voice_destination = $%d", argPos))
		args = append(args, *updates.VoiceDestination)
		argPos++
	}
	if updates.VoiceFailoverDestination != nil {
		setClause = append(setClause, fmt.Sprintf("voice_failover_destination = $%d", argPos))
		args = append(args, *updates.VoiceFailoverDestination)
		argPos++
	}
	if updates.VoiceRoutingType != nil {
		setClause = append(setClause, fmt.Sprintf("voice_routing_type = $%d", argPos))
		args = append(args, *updates.VoiceRoutingType)
		argPos++
	}
	if updates.TrunkID != nil {
		setClause = append(setClause, fmt.Sprintf("trunk_id = $%d", argPos))
		args = append(args, *updates.TrunkID)
		argPos++
	}

	// Messaging configuration
	if updates.SMSEnabled != nil {
		setClause = append(setClause, fmt.Sprintf("sms_enabled = $%d", argPos))
		args = append(args, *updates.SMSEnabled)
		argPos++
	}
	if updates.MMSEnabled != nil {
		setClause = append(setClause, fmt.Sprintf("mms_enabled = $%d", argPos))
		args = append(args, *updates.MMSEnabled)
		argPos++
	}
	if updates.CampaignID != nil {
		setClause = append(setClause, fmt.Sprintf("campaign_id = $%d", argPos))
		args = append(args, *updates.CampaignID)
		argPos++
	}

	// E911 configuration
	if updates.E911Enabled != nil {
		setClause = append(setClause, fmt.Sprintf("e911_enabled = $%d", argPos))
		args = append(args, *updates.E911Enabled)
		argPos++
	}
	if updates.E911AddressID != nil {
		setClause = append(setClause, fmt.Sprintf("e911_address_id = $%d", argPos))
		args = append(args, *updates.E911AddressID)
		argPos++
	}

	// CNAM configuration
	if updates.CNAMEnabled != nil {
		setClause = append(setClause, fmt.Sprintf("cnam_enabled = $%d", argPos))
		args = append(args, *updates.CNAMEnabled)
		argPos++
	}
	if updates.CNAMDisplayName != nil {
		setClause = append(setClause, fmt.Sprintf("cnam_display_name = $%d", argPos))
		args = append(args, *updates.CNAMDisplayName)
		argPos++
	}

	// Display info
	if updates.FriendlyName != nil {
		setClause = append(setClause, fmt.Sprintf("friendly_name = $%d", argPos))
		args = append(args, *updates.FriendlyName)
		argPos++
	}
	if updates.Description != nil {
		setClause = append(setClause, fmt.Sprintf("description = $%d", argPos))
		args = append(args, *updates.Description)
		argPos++
	}

	if len(setClause) == 0 {
		return r.GetByID(ctx, id)
	}

	// Add audit fields
	setClause = append(setClause, fmt.Sprintf("updated_by = $%d", argPos))
	args = append(args, updatedBy)
	argPos++

	args = append(args, id)
	query := fmt.Sprintf(`
		UPDATE numbers.assigned_numbers
		SET %s
		WHERE id = $%d
		RETURNING id, customer_id, number, soa_number_id, soa_last_synced, soa_sync_status,
		          number_type, npa, nxx, rate_center, state,
		          voice_enabled, sms_enabled, mms_enabled, fax_enabled,
		          trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
		          campaign_id, brand_id, tcr_status,
		          e911_enabled, e911_address_id,
		          cnam_enabled, cnam_display_name,
		          friendly_name, description,
		          active, monthly_charge, billing_start_date,
		          activated_at, released_at, release_reason,
		          created_at, updated_at, created_by, updated_by
	`, join(setClause, ", "), argPos)

	result := &models.AssignedNumber{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&result.ID, &result.CustomerID, &result.Number, &result.SOANumberID, &result.SOALastSynced, &result.SOASyncStatus,
		&result.NumberType, &result.NPA, &result.NXX, &result.RateCenter, &result.State,
		&result.VoiceEnabled, &result.SMSEnabled, &result.MMSEnabled, &result.FaxEnabled,
		&result.TrunkID, &result.VoiceDestination, &result.VoiceFailoverDestination, &result.VoiceRoutingType,
		&result.CampaignID, &result.BrandID, &result.TCRStatus,
		&result.E911Enabled, &result.E911AddressID,
		&result.CNAMEnabled, &result.CNAMDisplayName,
		&result.FriendlyName, &result.Description,
		&result.Active, &result.MonthlyCharge, &result.BillingStartDate,
		&result.ActivatedAt, &result.ReleasedAt, &result.ReleaseReason,
		&result.CreatedAt, &result.UpdatedAt, &result.CreatedBy, &result.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update number: %w", err)
	}

	return result, nil
}

// Release marks a number as released (sets active=false and records timestamp)
func (r *NumberRepository) Release(ctx context.Context, id uuid.UUID, reason string, releasedBy uuid.UUID) (*models.AssignedNumber, error) {
	query := `
		UPDATE numbers.assigned_numbers
		SET active = false,
		    released_at = NOW(),
		    release_reason = $1,
		    updated_by = $2
		WHERE id = $3
		RETURNING id, customer_id, number, soa_number_id, soa_last_synced, soa_sync_status,
		          number_type, npa, nxx, rate_center, state,
		          voice_enabled, sms_enabled, mms_enabled, fax_enabled,
		          trunk_id, voice_destination, voice_failover_destination, voice_routing_type,
		          campaign_id, brand_id, tcr_status,
		          e911_enabled, e911_address_id,
		          cnam_enabled, cnam_display_name,
		          friendly_name, description,
		          active, monthly_charge, billing_start_date,
		          activated_at, released_at, release_reason,
		          created_at, updated_at, created_by, updated_by
	`

	result := &models.AssignedNumber{}
	err := r.db.QueryRow(ctx, query, reason, releasedBy, id).Scan(
		&result.ID, &result.CustomerID, &result.Number, &result.SOANumberID, &result.SOALastSynced, &result.SOASyncStatus,
		&result.NumberType, &result.NPA, &result.NXX, &result.RateCenter, &result.State,
		&result.VoiceEnabled, &result.SMSEnabled, &result.MMSEnabled, &result.FaxEnabled,
		&result.TrunkID, &result.VoiceDestination, &result.VoiceFailoverDestination, &result.VoiceRoutingType,
		&result.CampaignID, &result.BrandID, &result.TCRStatus,
		&result.E911Enabled, &result.E911AddressID,
		&result.CNAMEnabled, &result.CNAMDisplayName,
		&result.FriendlyName, &result.Description,
		&result.Active, &result.MonthlyCharge, &result.BillingStartDate,
		&result.ActivatedAt, &result.ReleasedAt, &result.ReleaseReason,
		&result.CreatedAt, &result.UpdatedAt, &result.CreatedBy, &result.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to release number: %w", err)
	}

	return result, nil
}

// UpdateSOASyncStatus updates the SOA sync status for a number
func (r *NumberRepository) UpdateSOASyncStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `
		UPDATE numbers.assigned_numbers
		SET soa_sync_status = $1,
		    soa_last_synced = NOW()
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update SOA sync status: %w", err)
	}

	return nil
}

// GetInventorySummary returns summary statistics for a customer's numbers
func (r *NumberRepository) GetInventorySummary(ctx context.Context, customerID uuid.UUID) (*models.NumberInventorySummary, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE active = true) as active_count,
			COUNT(*) FILTER (WHERE active = false) as released_count,
			COUNT(*) FILTER (WHERE voice_enabled = true AND active = true) as voice_enabled_count,
			COUNT(*) FILTER (WHERE sms_enabled = true AND active = true) as sms_enabled_count,
			COUNT(*) FILTER (WHERE campaign_id IS NOT NULL AND active = true) as campaign_linked_count,
			COUNT(*) FILTER (WHERE trunk_id IS NOT NULL AND active = true) as trunk_linked_count,
			COALESCE(SUM(monthly_charge) FILTER (WHERE active = true), 0) as total_monthly_charge
		FROM numbers.assigned_numbers
		WHERE customer_id = $1
	`

	summary := &models.NumberInventorySummary{CustomerID: customerID}
	err := r.db.QueryRow(ctx, query, customerID).Scan(
		&summary.ActiveCount,
		&summary.ReleasedCount,
		&summary.VoiceEnabledCount,
		&summary.SMSEnabledCount,
		&summary.CampaignLinkedCount,
		&summary.TrunkLinkedCount,
		&summary.TotalMonthlyCharge,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get inventory summary: %w", err)
	}

	return summary, nil
}

// ListNumberOptions contains options for listing numbers
type ListNumberOptions struct {
	Search          string
	VoiceEnabled    *bool
	SMSEnabled      *bool
	TrunkID         *uuid.UUID
	CampaignID      *uuid.UUID
	IncludeReleased bool
	Page            int
	PerPage         int
}
