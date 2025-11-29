package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type TCRCampaignRepository struct {
	db *pgxpool.Pool
}

func NewTCRCampaignRepository(db *pgxpool.Pool) *TCRCampaignRepository {
	return &TCRCampaignRepository{db: db}
}

// Create creates a new campaign registration
func (r *TCRCampaignRepository) Create(ctx context.Context, req *models.CreateCampaignRequest, customerID uuid.UUID, createdBy uuid.UUID) (*models.Campaign10DLC, error) {
	query := `
		INSERT INTO messaging.campaigns_10dlc (
			customer_id, brand_id, use_case, sub_use_cases,
			description, message_flow, sample_messages,
			subscriber_optin, subscriber_optout, subscriber_help,
			optin_keywords, optin_message,
			optout_keywords, optout_message,
			help_keywords, help_message,
			embedded_link, embedded_phone, number_pool, age_gated, direct_lending,
			privacy_policy_url, terms_url, auto_renewal,
			reference_id, status, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
			$21, $22, $23, $24, $25, $26, $27
		)
		RETURNING id, customer_id, brand_id, tcr_campaign_id, reseller_id,
		          use_case, sub_use_cases, description, message_flow, sample_messages,
		          subscriber_optin, subscriber_optout, subscriber_help,
		          optin_keywords, optin_message, optout_keywords, optout_message,
		          help_keywords, help_message,
		          embedded_link, embedded_phone, number_pool, age_gated, direct_lending,
		          privacy_policy_url, terms_url, auto_renewal, expiration_date,
		          throughput_limit, daily_cap, status,
		          tcr_submission_date, tcr_approval_date, trust_score,
		          reference_id, tcr_created_at, tcr_updated_at,
		          created_at, updated_at, created_by, updated_by
	`

	campaign := &models.Campaign10DLC{}
	err := r.db.QueryRow(ctx, query,
		customerID, req.BrandID, req.UseCase, req.SubUseCases,
		req.Description, req.MessageFlow, req.SampleMessages,
		req.SubscriberOptin, req.SubscriberOptout, req.SubscriberHelp,
		req.OptinKeywords, req.OptinMessage,
		req.OptoutKeywords, req.OptoutMessage,
		req.HelpKeywords, req.HelpMessage,
		req.EmbeddedLink, req.EmbeddedPhone, req.NumberPool, req.AgeGated, req.DirectLending,
		req.PrivacyPolicyURL, req.TermsURL, req.AutoRenewal,
		req.ReferenceID, "PENDING", createdBy,
	).Scan(
		&campaign.ID, &campaign.CustomerID, &campaign.BrandID, &campaign.TCRCampaignID, &campaign.ResellerID,
		&campaign.UseCase, &campaign.SubUseCases, &campaign.Description, &campaign.MessageFlow, &campaign.SampleMessages,
		&campaign.SubscriberOptin, &campaign.SubscriberOptout, &campaign.SubscriberHelp,
		&campaign.OptinKeywords, &campaign.OptinMessage, &campaign.OptoutKeywords, &campaign.OptoutMessage,
		&campaign.HelpKeywords, &campaign.HelpMessage,
		&campaign.EmbeddedLink, &campaign.EmbeddedPhone, &campaign.NumberPool, &campaign.AgeGated, &campaign.DirectLending,
		&campaign.PrivacyPolicyURL, &campaign.TermsURL, &campaign.AutoRenewal, &campaign.ExpirationDate,
		&campaign.ThroughputLimit, &campaign.DailyCap, &campaign.Status,
		&campaign.TCRSubmissionDate, &campaign.TCRApprovalDate, &campaign.TrustScore,
		&campaign.ReferenceID, &campaign.TCRCreatedAt, &campaign.TCRUpdatedAt,
		&campaign.CreatedAt, &campaign.UpdatedAt, &campaign.CreatedBy, &campaign.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create campaign: %w", err)
	}

	return campaign, nil
}

// List retrieves campaigns with customer filtering
func (r *TCRCampaignRepository) List(ctx context.Context, customerFilter []uuid.UUID, brandID *uuid.UUID, status string, page, perPage int) ([]models.Campaign10DLC, int64, error) {
	baseQuery := `FROM messaging.campaigns_10dlc WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	// Customer scoping
	if customerFilter != nil {
		if len(customerFilter) == 0 {
			return []models.Campaign10DLC{}, 0, nil
		}
		baseQuery += fmt.Sprintf(" AND customer_id = ANY($%d)", argPos)
		args = append(args, customerFilter)
		argPos++
	}

	// Brand filter
	if brandID != nil {
		baseQuery += fmt.Sprintf(" AND brand_id = $%d", argPos)
		args = append(args, *brandID)
		argPos++
	}

	// Status filter
	if status != "" {
		baseQuery += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count campaigns: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * perPage
	selectQuery := `
		SELECT id, customer_id, brand_id, tcr_campaign_id, reseller_id,
		       use_case, sub_use_cases, description, message_flow, sample_messages,
		       subscriber_optin, subscriber_optout, subscriber_help,
		       optin_keywords, optin_message, optout_keywords, optout_message,
		       help_keywords, help_message,
		       embedded_link, embedded_phone, number_pool, age_gated, direct_lending,
		       privacy_policy_url, terms_url, auto_renewal, expiration_date,
		       throughput_limit, daily_cap, status,
		       tcr_submission_date, tcr_approval_date, trust_score,
		       reference_id, tcr_created_at, tcr_updated_at,
		       created_at, updated_at, created_by, updated_by
	` + baseQuery + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, perPage, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query campaigns: %w", err)
	}
	defer rows.Close()

	campaigns := []models.Campaign10DLC{}
	for rows.Next() {
		var campaign models.Campaign10DLC
		err := rows.Scan(
			&campaign.ID, &campaign.CustomerID, &campaign.BrandID, &campaign.TCRCampaignID, &campaign.ResellerID,
			&campaign.UseCase, &campaign.SubUseCases, &campaign.Description, &campaign.MessageFlow, &campaign.SampleMessages,
			&campaign.SubscriberOptin, &campaign.SubscriberOptout, &campaign.SubscriberHelp,
			&campaign.OptinKeywords, &campaign.OptinMessage, &campaign.OptoutKeywords, &campaign.OptoutMessage,
			&campaign.HelpKeywords, &campaign.HelpMessage,
			&campaign.EmbeddedLink, &campaign.EmbeddedPhone, &campaign.NumberPool, &campaign.AgeGated, &campaign.DirectLending,
			&campaign.PrivacyPolicyURL, &campaign.TermsURL, &campaign.AutoRenewal, &campaign.ExpirationDate,
			&campaign.ThroughputLimit, &campaign.DailyCap, &campaign.Status,
			&campaign.TCRSubmissionDate, &campaign.TCRApprovalDate, &campaign.TrustScore,
			&campaign.ReferenceID, &campaign.TCRCreatedAt, &campaign.TCRUpdatedAt,
			&campaign.CreatedAt, &campaign.UpdatedAt, &campaign.CreatedBy, &campaign.UpdatedBy,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan campaign: %w", err)
		}
		campaigns = append(campaigns, campaign)
	}

	return campaigns, total, nil
}

// GetByID retrieves a campaign by ID with customer verification
func (r *TCRCampaignRepository) GetByID(ctx context.Context, id uuid.UUID, customerFilter []uuid.UUID) (*models.Campaign10DLC, error) {
	query := `
		SELECT id, customer_id, brand_id, tcr_campaign_id, reseller_id,
		       use_case, sub_use_cases, description, message_flow, sample_messages,
		       subscriber_optin, subscriber_optout, subscriber_help,
		       optin_keywords, optin_message, optout_keywords, optout_message,
		       help_keywords, help_message,
		       embedded_link, embedded_phone, number_pool, age_gated, direct_lending,
		       privacy_policy_url, terms_url, auto_renewal, expiration_date,
		       throughput_limit, daily_cap, status,
		       tcr_submission_date, tcr_approval_date, trust_score,
		       reference_id, tcr_created_at, tcr_updated_at,
		       created_at, updated_at, created_by, updated_by
		FROM messaging.campaigns_10dlc
		WHERE id = $1
	`

	args := []interface{}{id}
	argPos := 2

	// Customer scoping check
	if customerFilter != nil {
		if len(customerFilter) == 0 {
			return nil, fmt.Errorf("access denied")
		}
		query += fmt.Sprintf(" AND customer_id = ANY($%d)", argPos)
		args = append(args, customerFilter)
	}

	campaign := &models.Campaign10DLC{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&campaign.ID, &campaign.CustomerID, &campaign.BrandID, &campaign.TCRCampaignID, &campaign.ResellerID,
		&campaign.UseCase, &campaign.SubUseCases, &campaign.Description, &campaign.MessageFlow, &campaign.SampleMessages,
		&campaign.SubscriberOptin, &campaign.SubscriberOptout, &campaign.SubscriberHelp,
		&campaign.OptinKeywords, &campaign.OptinMessage, &campaign.OptoutKeywords, &campaign.OptoutMessage,
		&campaign.HelpKeywords, &campaign.HelpMessage,
		&campaign.EmbeddedLink, &campaign.EmbeddedPhone, &campaign.NumberPool, &campaign.AgeGated, &campaign.DirectLending,
		&campaign.PrivacyPolicyURL, &campaign.TermsURL, &campaign.AutoRenewal, &campaign.ExpirationDate,
		&campaign.ThroughputLimit, &campaign.DailyCap, &campaign.Status,
		&campaign.TCRSubmissionDate, &campaign.TCRApprovalDate, &campaign.TrustScore,
		&campaign.ReferenceID, &campaign.TCRCreatedAt, &campaign.TCRUpdatedAt,
		&campaign.CreatedAt, &campaign.UpdatedAt, &campaign.CreatedBy, &campaign.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get campaign: %w", err)
	}

	return campaign, nil
}

// Update updates a campaign
func (r *TCRCampaignRepository) Update(ctx context.Context, id uuid.UUID, req *models.UpdateCampaignRequest, updatedBy uuid.UUID) error {
	query := `
		UPDATE messaging.campaigns_10dlc
		SET description = COALESCE($1, description),
		    message_flow = COALESCE($2, message_flow),
		    sample_messages = COALESCE($3, sample_messages),
		    optin_message = COALESCE($4, optin_message),
		    optout_message = COALESCE($5, optout_message),
		    help_message = COALESCE($6, help_message),
		    privacy_policy_url = COALESCE($7, privacy_policy_url),
		    terms_url = COALESCE($8, terms_url),
		    auto_renewal = COALESCE($9, auto_renewal),
		    updated_by = $10,
		    updated_at = NOW()
		WHERE id = $11
	`

	_, err := r.db.Exec(ctx, query,
		req.Description, req.MessageFlow, req.SampleMessages,
		req.OptinMessage, req.OptoutMessage, req.HelpMessage,
		req.PrivacyPolicyURL, req.TermsURL, req.AutoRenewal,
		updatedBy, id,
	)

	if err != nil {
		return fmt.Errorf("failed to update campaign: %w", err)
	}

	return nil
}

// UpdateTCRInfo updates campaign with TCR API response
func (r *TCRCampaignRepository) UpdateTCRInfo(ctx context.Context, id uuid.UUID, tcrCampaignID string, status string, throughputLimit, dailyCap *int) error {
	query := `
		UPDATE messaging.campaigns_10dlc
		SET tcr_campaign_id = $1,
		    status = $2,
		    throughput_limit = $3,
		    daily_cap = $4,
		    tcr_submission_date = CASE WHEN tcr_submission_date IS NULL THEN NOW() ELSE tcr_submission_date END,
		    tcr_approval_date = CASE WHEN $2 = 'ACTIVE' AND tcr_approval_date IS NULL THEN NOW() ELSE tcr_approval_date END,
		    tcr_updated_at = NOW(),
		    updated_at = NOW()
		WHERE id = $5
	`

	_, err := r.db.Exec(ctx, query, tcrCampaignID, status, throughputLimit, dailyCap, id)
	if err != nil {
		return fmt.Errorf("failed to update TCR info: %w", err)
	}

	return nil
}

// GetMNOStatus retrieves MNO status for a campaign
func (r *TCRCampaignRepository) GetMNOStatus(ctx context.Context, campaignID uuid.UUID) ([]models.CampaignMNOStatus, error) {
	query := `
		SELECT id, campaign_id, mno_id, mno_name, status, status_updated_at,
		       rejection_reason, rejection_code, created_at, updated_at
		FROM messaging.campaign_mno_status
		WHERE campaign_id = $1
		ORDER BY mno_name
	`

	rows, err := r.db.Query(ctx, query, campaignID)
	if err != nil {
		return nil, fmt.Errorf("failed to query MNO status: %w", err)
	}
	defer rows.Close()

	statuses := []models.CampaignMNOStatus{}
	for rows.Next() {
		var status models.CampaignMNOStatus
		err := rows.Scan(
			&status.ID, &status.CampaignID, &status.MNOID, &status.MNOName,
			&status.Status, &status.StatusUpdatedAt,
			&status.RejectionReason, &status.RejectionCode,
			&status.CreatedAt, &status.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan MNO status: %w", err)
		}
		statuses = append(statuses, status)
	}

	return statuses, nil
}

// UpsertMNOStatus creates or updates MNO status
func (r *TCRCampaignRepository) UpsertMNOStatus(ctx context.Context, campaignID uuid.UUID, mnoID, mnoName, status string, rejectionReason, rejectionCode *string) error {
	query := `
		INSERT INTO messaging.campaign_mno_status (campaign_id, mno_id, mno_name, status, rejection_reason, rejection_code)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (campaign_id, mno_id) DO UPDATE
		SET status = EXCLUDED.status,
		    rejection_reason = EXCLUDED.rejection_reason,
		    rejection_code = EXCLUDED.rejection_code,
		    status_updated_at = NOW(),
		    updated_at = NOW()
	`

	_, err := r.db.Exec(ctx, query, campaignID, mnoID, mnoName, status, rejectionReason, rejectionCode)
	if err != nil {
		return fmt.Errorf("failed to upsert MNO status: %w", err)
	}

	return nil
}

// AssignPhoneNumbers assigns phone numbers to a campaign
func (r *TCRCampaignRepository) AssignPhoneNumbers(ctx context.Context, campaignID uuid.UUID, phoneNumbers []string, assignedBy uuid.UUID) error {
	// Start a transaction
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Insert phone numbers
	query := `
		INSERT INTO messaging.campaign_phone_numbers (campaign_id, phone_number, assigned_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (campaign_id, phone_number, removed_at) DO NOTHING
	`

	batch := &pgx.Batch{}
	for _, phoneNumber := range phoneNumbers {
		batch.Queue(query, campaignID, phoneNumber, assignedBy)
	}

	br := tx.SendBatch(ctx, batch)
	defer br.Close()

	// Execute batch
	for range phoneNumbers {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to assign phone number: %w", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// RemovePhoneNumbers removes phone numbers from a campaign
func (r *TCRCampaignRepository) RemovePhoneNumbers(ctx context.Context, campaignID uuid.UUID, phoneNumbers []string, removedBy uuid.UUID) error {
	query := `
		UPDATE messaging.campaign_phone_numbers
		SET removed_at = NOW(),
		    removed_by = $1
		WHERE campaign_id = $2
		  AND phone_number = ANY($3)
		  AND removed_at IS NULL
	`

	_, err := r.db.Exec(ctx, query, removedBy, campaignID, phoneNumbers)
	if err != nil {
		return fmt.Errorf("failed to remove phone numbers: %w", err)
	}

	return nil
}

// GetCampaignPhoneNumbers retrieves active phone numbers for a campaign
func (r *TCRCampaignRepository) GetCampaignPhoneNumbers(ctx context.Context, campaignID uuid.UUID) ([]models.CampaignPhoneNumber, error) {
	query := `
		SELECT id, campaign_id, phone_number, assigned_at, assigned_by,
		       removed_at, removed_by, is_active
		FROM messaging.campaign_phone_numbers
		WHERE campaign_id = $1 AND is_active = TRUE
		ORDER BY assigned_at DESC
	`

	rows, err := r.db.Query(ctx, query, campaignID)
	if err != nil {
		return nil, fmt.Errorf("failed to query phone numbers: %w", err)
	}
	defer rows.Close()

	numbers := []models.CampaignPhoneNumber{}
	for rows.Next() {
		var number models.CampaignPhoneNumber
		err := rows.Scan(
			&number.ID, &number.CampaignID, &number.PhoneNumber,
			&number.AssignedAt, &number.AssignedBy,
			&number.RemovedAt, &number.RemovedBy, &number.IsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan phone number: %w", err)
		}
		numbers = append(numbers, number)
	}

	return numbers, nil
}
