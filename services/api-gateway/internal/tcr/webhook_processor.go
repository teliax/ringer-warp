package tcr

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/email"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"go.uber.org/zap"
)

// WebhookProcessor processes TCR webhook events and updates database
type WebhookProcessor struct {
	db           *pgxpool.Pool
	emailService *email.Service
	webhookRepo  *repository.TCRWebhookEventRepository
	logger       *zap.Logger
}

// NewWebhookProcessor creates a new webhook processor
func NewWebhookProcessor(db *pgxpool.Pool, emailService *email.Service, logger *zap.Logger) *WebhookProcessor {
	return &WebhookProcessor{
		db:           db,
		emailService: emailService,
		webhookRepo:  repository.NewTCRWebhookEventRepository(db),
		logger:       logger,
	}
}

// ProcessBrandEvent processes brand-related webhook events
func (p *WebhookProcessor) ProcessBrandEvent(ctx context.Context, event *WebhookEvent) error {
	p.logger.Info("Processing brand webhook event",
		zap.String("event_type", event.EventType),
		zap.String("brand_id", event.BrandID),
	)

	// Find brand by TCR brand ID
	var brandUUID uuid.UUID
	err := p.db.QueryRow(ctx, `
		SELECT id FROM messaging.brands_10dlc
		WHERE tcr_brand_id = $1
	`, event.BrandID).Scan(&brandUUID)

	if err != nil {
		return fmt.Errorf("brand not found for TCR ID %s: %w", event.BrandID, err)
	}

	// Update brand status based on event type
	switch event.EventType {
	case "BRAND_ADD", "BRAND_UPDATE", "BRAND_SCORE_UPDATE":
		return p.updateBrandStatus(ctx, brandUUID, event)

	case "BRAND_FEEDBACK":
		// Brand was rejected or has feedback
		return p.storeBrandFeedback(ctx, brandUUID, event)

	default:
		p.logger.Warn("Unknown brand event type",
			zap.String("event_type", event.EventType),
		)
		return nil // Not an error, just unknown event
	}
}

// ProcessCampaignEvent processes campaign-related webhook events
func (p *WebhookProcessor) ProcessCampaignEvent(ctx context.Context, event *WebhookEvent) error {
	p.logger.Info("Processing campaign webhook event",
		zap.String("event_type", event.EventType),
		zap.String("campaign_id", event.CampaignID),
	)

	// Find campaign by TCR campaign ID
	var campaignUUID uuid.UUID
	err := p.db.QueryRow(ctx, `
		SELECT id FROM messaging.campaigns_10dlc
		WHERE tcr_campaign_id = $1
	`, event.CampaignID).Scan(&campaignUUID)

	if err != nil {
		return fmt.Errorf("campaign not found for TCR ID %s: %w", event.CampaignID, err)
	}

	// Update campaign status based on event type
	switch event.EventType {
	case "CAMPAIGN_SHARE_ADD", "CAMPAIGN_SHARE_ACCEPT":
		// Campaign approved by MNO
		return p.updateCampaignStatus(ctx, campaignUUID, event, "REGISTERED")

	case "CAMPAIGN_SHARE_DELETE", "CAMPAIGN_SHARE_REJECT":
		// Campaign rejected by MNO
		return p.updateCampaignStatus(ctx, campaignUUID, event, "REJECTED")

	case "CAMPAIGN_UPDATE":
		// Campaign details updated
		return p.syncCampaignStatus(ctx, campaignUUID, event)

	default:
		p.logger.Warn("Unknown campaign event type",
			zap.String("event_type", event.EventType),
		)
		return nil
	}
}

// ProcessVettingEvent processes vetting completion webhook events
func (p *WebhookProcessor) ProcessVettingEvent(ctx context.Context, event *WebhookEvent) error {
	p.logger.Info("Processing vetting webhook event",
		zap.String("event_type", event.EventType),
		zap.String("brand_id", event.BrandID),
	)

	// Route to Auth+ handler if event is Auth+-related
	if strings.Contains(event.EventType, "AUTHPLUS") || strings.Contains(event.EventType, "2FA") {
		return p.processAuthPlusEvent(ctx, event)
	}

	// Find brand by TCR brand ID
	var brandUUID uuid.UUID
	err := p.db.QueryRow(ctx, `
		SELECT id FROM messaging.brands_10dlc
		WHERE tcr_brand_id = $1
	`, event.BrandID).Scan(&brandUUID)

	if err != nil {
		return fmt.Errorf("brand not found for TCR ID %s: %w", event.BrandID, err)
	}

	// Update brand with vetting results
	query := `
		UPDATE messaging.brands_10dlc
		SET
			identity_status = $2,
			trust_score = $3,
			last_synced_at = NOW(),
			sync_source = 'webhook',
			updated_at = NOW()
		WHERE id = $1
	`

	_, err = p.db.Exec(ctx, query,
		brandUUID,
		event.IdentityStatus,
		event.TrustScore,
	)

	if err != nil {
		return fmt.Errorf("failed to update brand vetting status: %w", err)
	}

	p.logger.Info("Brand vetting status updated",
		zap.String("brand_uuid", brandUUID.String()),
		zap.String("identity_status", event.IdentityStatus),
		zap.Int("trust_score", event.TrustScore),
	)

	return nil
}

// updateBrandStatus updates brand status and metadata from webhook
func (p *WebhookProcessor) updateBrandStatus(ctx context.Context, brandUUID uuid.UUID, event *WebhookEvent) error {
	query := `
		UPDATE messaging.brands_10dlc
		SET
			identity_status = COALESCE($2, identity_status),
			trust_score = COALESCE($3, trust_score),
			last_synced_at = NOW(),
			sync_source = 'webhook',
			updated_at = NOW()
		WHERE id = $1
	`

	var identityStatus *string
	var trustScore *int

	if event.IdentityStatus != "" {
		identityStatus = &event.IdentityStatus
	}
	if event.TrustScore > 0 {
		trustScore = &event.TrustScore
	}

	_, err := p.db.Exec(ctx, query, brandUUID, identityStatus, trustScore)
	if err != nil {
		return fmt.Errorf("failed to update brand status: %w", err)
	}

	p.logger.Info("Brand status updated from webhook",
		zap.String("brand_uuid", brandUUID.String()),
		zap.String("event_type", event.EventType),
	)

	// Send email notification
	go p.sendBrandStatusEmail(context.Background(), event.BrandID, event.EventType)

	return nil
}

// storeBrandFeedback stores rejection feedback for a brand
func (p *WebhookProcessor) storeBrandFeedback(ctx context.Context, brandUUID uuid.UUID, event *WebhookEvent) error {
	// Store rejection reason if present
	if event.RejectionReason != "" {
		query := `
			UPDATE messaging.brands_10dlc
			SET
				notes = CONCAT(COALESCE(notes, ''), E'\n\n[', NOW(), '] TCR Feedback: ', $2),
				last_synced_at = NOW(),
				sync_source = 'webhook',
				updated_at = NOW()
			WHERE id = $1
		`

		_, err := p.db.Exec(ctx, query, brandUUID, event.RejectionReason)
		if err != nil {
			return fmt.Errorf("failed to store brand feedback: %w", err)
		}

		p.logger.Info("Brand feedback stored",
			zap.String("brand_uuid", brandUUID.String()),
			zap.String("feedback", event.RejectionReason),
		)
	}

	return nil
}

// updateCampaignStatus updates campaign status from webhook
func (p *WebhookProcessor) updateCampaignStatus(ctx context.Context, campaignUUID uuid.UUID, event *WebhookEvent, newStatus string) error {
	query := `
		UPDATE messaging.campaigns_10dlc
		SET
			status = $2,
			last_synced_at = NOW(),
			sync_source = 'webhook',
			updated_at = NOW()
		WHERE id = $1
	`

	_, err := p.db.Exec(ctx, query, campaignUUID, newStatus)
	if err != nil {
		return fmt.Errorf("failed to update campaign status: %w", err)
	}

	p.logger.Info("Campaign status updated from webhook",
		zap.String("campaign_uuid", campaignUUID.String()),
		zap.String("status", newStatus),
		zap.String("event_type", event.EventType),
	)

	// Send email notification
	go p.sendCampaignStatusEmail(context.Background(), event.CampaignID, event.EventType, newStatus)

	// Update MNO statuses if present
	if len(event.MNOStatuses) > 0 {
		return p.updateMNOStatuses(ctx, campaignUUID, event.MNOStatuses)
	}

	return nil
}

// syncCampaignStatus synchronizes campaign status without forcing a specific status
func (p *WebhookProcessor) syncCampaignStatus(ctx context.Context, campaignUUID uuid.UUID, event *WebhookEvent) error {
	query := `
		UPDATE messaging.campaigns_10dlc
		SET
			status = COALESCE($2, status),
			last_synced_at = NOW(),
			sync_source = 'webhook',
			updated_at = NOW()
		WHERE id = $1
	`

	var status *string
	if event.Status != "" {
		status = &event.Status
	}

	_, err := p.db.Exec(ctx, query, campaignUUID, status)
	if err != nil {
		return fmt.Errorf("failed to sync campaign status: %w", err)
	}

	p.logger.Info("Campaign synced from webhook",
		zap.String("campaign_uuid", campaignUUID.String()),
		zap.String("event_type", event.EventType),
	)

	// Update MNO statuses if present
	if len(event.MNOStatuses) > 0 {
		return p.updateMNOStatuses(ctx, campaignUUID, event.MNOStatuses)
	}

	return nil
}

// updateMNOStatuses updates per-carrier campaign statuses
func (p *WebhookProcessor) updateMNOStatuses(ctx context.Context, campaignUUID uuid.UUID, mnoStatuses map[string]string) error {
	// Upsert MNO statuses for each carrier
	for mnoID, status := range mnoStatuses {
		query := `
			INSERT INTO messaging.campaign_mno_status (
				campaign_id,
				mno_id,
				status,
				updated_at
			) VALUES ($1, $2, $3, NOW())
			ON CONFLICT (campaign_id, mno_id)
			DO UPDATE SET
				status = EXCLUDED.status,
				updated_at = NOW()
		`

		_, err := p.db.Exec(ctx, query, campaignUUID, mnoID, status)
		if err != nil {
			p.logger.Error("Failed to update MNO status",
				zap.String("campaign_uuid", campaignUUID.String()),
				zap.String("mno_id", mnoID),
				zap.Error(err),
			)
			// Continue with other MNOs even if one fails
		}
	}

	p.logger.Info("MNO statuses updated",
		zap.String("campaign_uuid", campaignUUID.String()),
		zap.Int("mno_count", len(mnoStatuses)),
	)

	return nil
}

// UpdateSyncTimestamp updates the last_synced_at timestamp for a brand or campaign
func (p *WebhookProcessor) UpdateSyncTimestamp(ctx context.Context, table string, id uuid.UUID, source string) error {
	query := fmt.Sprintf(`
		UPDATE messaging.%s
		SET
			last_synced_at = NOW(),
			sync_source = $2
		WHERE id = $1
	`, table)

	_, err := p.db.Exec(ctx, query, id, source)
	return err
}

// sendBrandStatusEmail sends email notification for brand status changes
func (p *WebhookProcessor) sendBrandStatusEmail(ctx context.Context, tcrBrandID, eventType string) {
	// Get brand details and user email
	brandDetails, err := p.webhookRepo.GetBrandDetailsByTCRID(ctx, tcrBrandID)
	if err != nil {
		p.logger.Error("Failed to get brand details for email",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.Error(err),
		)
		return
	}

	// Determine status message and next steps based on status
	var statusMessage, nextSteps, vettingInfo string
	var statusClass string

	if brandDetails.Status != nil {
		switch *brandDetails.Status {
		case "VERIFIED", "VETTED_VERIFIED":
			statusClass = "status-success"
			statusMessage = "Congratulations! Your brand has been successfully verified by The Campaign Registry."
			nextSteps = "You can now create SMS campaigns using this brand. Your campaigns will be reviewed and approved by carriers typically within 1-2 business days."
		case "REGISTERED":
			statusClass = "status-info"
			statusMessage = "Your brand has been registered with TCR and is pending verification."
			nextSteps = "TCR is currently verifying your brand identity. This process typically takes 1-3 business days. You'll receive another notification once verification is complete."
		case "UNVERIFIED":
			statusClass = "status-warning"
			statusMessage = "Your brand could not be automatically verified."
			nextSteps = "You may need to provide additional documentation or use an External Vetting Provider (EVP) to complete verification. Please contact support for assistance."
			vettingInfo = "External vetting typically costs $40 and takes 3-5 business days. Verified brands have higher trust scores and better campaign approval rates."
		case "SUSPENDED":
			statusClass = "status-danger"
			statusMessage = "Your brand has been suspended by The Campaign Registry."
			nextSteps = "This typically occurs due to compliance violations or invalid information. Please review your brand details and contact TCR support immediately."
		case "PENDING":
			statusClass = "status-info"
			statusMessage = "Your brand registration is being processed."
			nextSteps = "Your brand submission is in queue for review. You'll be notified once the initial review is complete."
		default:
			statusClass = "status-info"
			statusMessage = fmt.Sprintf("Your brand status has been updated to: %s", *brandDetails.Status)
		}
	}

	// Build email data
	emailData := &email.TCRBrandStatusChangedData{
		UserName:       brandDetails.UserName,
		BrandName:      brandDetails.DisplayName,
		TCRBrandID:     brandDetails.TCRBrandID,
		BrandID:        brandDetails.ID.String(),
		NewStatus:      getString(brandDetails.Status),
		StatusClass:    statusClass,
		IdentityStatus: getString(brandDetails.IdentityStatus),
		TrustScore:     getInt(brandDetails.TrustScore),
		UpdatedAt:      time.Now().Format("January 2, 2006 at 3:04 PM MST"),
		StatusMessage:  statusMessage,
		NextSteps:      nextSteps,
		VettingInfo:    vettingInfo,
	}

	// Send email
	if err := p.emailService.SendTCRBrandStatusChanged(brandDetails.UserEmail, emailData); err != nil {
		p.logger.Error("Failed to send brand status email",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.String("user_email", brandDetails.UserEmail),
			zap.Error(err),
		)
		return
	}

	p.logger.Info("Brand status email sent",
		zap.String("tcr_brand_id", tcrBrandID),
		zap.String("user_email", brandDetails.UserEmail),
		zap.String("status", getString(brandDetails.Status)),
	)

	// Update notification tracking
	_, _ = p.db.Exec(ctx, `
		UPDATE messaging.brands_10dlc
		SET last_notification_sent_at = NOW(),
		    notification_status = 'sent'
		WHERE tcr_brand_id = $1
	`, tcrBrandID)
}

// sendCampaignStatusEmail sends email notification for campaign status changes
func (p *WebhookProcessor) sendCampaignStatusEmail(ctx context.Context, tcrCampaignID, eventType, newStatus string) {
	// Get campaign details and user email
	campaignDetails, err := p.webhookRepo.GetCampaignDetailsByTCRID(ctx, tcrCampaignID)
	if err != nil {
		p.logger.Error("Failed to get campaign details for email",
			zap.String("tcr_campaign_id", tcrCampaignID),
			zap.Error(err),
		)
		return
	}

	// Determine if this is an approval or rejection based on event and status
	isApproval := strings.Contains(eventType, "ACCEPT") || newStatus == "REGISTERED"
	isRejection := strings.Contains(eventType, "DELETE") || strings.Contains(eventType, "REJECT") || newStatus == "REJECTED"

	// Extract carrier name from event type or default
	carrierName := "Carrier"
	if strings.Contains(eventType, "ATT") {
		carrierName = "AT&T"
	} else if strings.Contains(eventType, "TMO") {
		carrierName = "T-Mobile"
	} else if strings.Contains(eventType, "VZW") {
		carrierName = "Verizon"
	}

	if isApproval {
		emailData := &email.TCRCampaignApprovedData{
			UserName:            campaignDetails.UserName,
			CampaignDescription: campaignDetails.Description,
			TCRCampaignID:       campaignDetails.TCRCampaignID,
			CampaignID:          campaignDetails.ID.String(),
			BrandName:           campaignDetails.BrandName,
			UseCase:             campaignDetails.UseCase,
			CarrierName:         carrierName,
			ApprovedAt:          time.Now().Format("January 2, 2006 at 3:04 PM MST"),
			ThroughputLimit:     "Varies by carrier",
			DailyLimit:          "Based on brand trust score",
		}

		if err := p.emailService.SendTCRCampaignApproved(campaignDetails.UserEmail, emailData); err != nil {
			p.logger.Error("Failed to send campaign approved email",
				zap.String("tcr_campaign_id", tcrCampaignID),
				zap.Error(err),
			)
			return
		}
	} else if isRejection {
		emailData := &email.TCRCampaignRejectedData{
			UserName:            campaignDetails.UserName,
			CampaignDescription: campaignDetails.Description,
			TCRCampaignID:       campaignDetails.TCRCampaignID,
			CampaignID:          campaignDetails.ID.String(),
			BrandName:           campaignDetails.BrandName,
			UseCase:             campaignDetails.UseCase,
			CarrierName:         carrierName,
			RejectionReason:     "Please review campaign details and resubmit",
		}

		if err := p.emailService.SendTCRCampaignRejected(campaignDetails.UserEmail, emailData); err != nil {
			p.logger.Error("Failed to send campaign rejected email",
				zap.String("tcr_campaign_id", tcrCampaignID),
				zap.Error(err),
			)
			return
		}
	}

	p.logger.Info("Campaign status email sent",
		zap.String("tcr_campaign_id", tcrCampaignID),
		zap.String("user_email", campaignDetails.UserEmail),
		zap.String("event_type", eventType),
	)

	// Update notification tracking
	_, _ = p.db.Exec(ctx, `
		UPDATE messaging.campaigns_10dlc
		SET last_notification_sent_at = NOW(),
		    notification_status = 'sent'
		WHERE tcr_campaign_id = $1
	`, tcrCampaignID)
}

// Helper functions
// processAuthPlusEvent handles Auth+ verification webhook events
func (p *WebhookProcessor) processAuthPlusEvent(ctx context.Context, event *WebhookEvent) error {
	// Find brand
	var brandUUID uuid.UUID
	err := p.db.QueryRow(ctx, `
		SELECT id FROM messaging.brands_10dlc WHERE tcr_brand_id = $1
	`, event.BrandID).Scan(&brandUUID)
	if err != nil {
		return fmt.Errorf("brand not found: %w", err)
	}

	p.logger.Info("Processing Auth+ event",
		zap.String("event_type", event.EventType),
		zap.String("brand_uuid", brandUUID.String()),
	)

	switch event.EventType {
	case "BRAND_AUTHPLUS_VERIFICATION_ADD", "BRAND_AUTHPLUS_RE_VERIFICATION_ADD":
		return p.updateAuthPlusStatus(ctx, brandUUID, "PENDING", event.VettingID)

	case "BRAND_AUTHPLUS_DOMAIN_VERIFIED":
		// Update tracking field for UI progress
		_, err = p.db.Exec(ctx, `
			UPDATE messaging.brands_10dlc
			SET auth_plus_domain_verified = true,
				updated_at = NOW()
			WHERE id = $1
		`, brandUUID)
		return err

	case "BRAND_AUTHPLUS_DOMAIN_FAILED":
		err = p.updateAuthPlusStatus(ctx, brandUUID, "FAILED", event.VettingID)
		if err == nil {
			// Send email notification about failure
			go p.sendAuthPlusFailedEmail(context.Background(), event.BrandID, "domain_failed")
		}
		return err

	case "BRAND_AUTHPLUS_2FA_VERIFIED":
		// Update tracking field for UI progress
		_, err = p.db.Exec(ctx, `
			UPDATE messaging.brands_10dlc
			SET auth_plus_2fa_verified = true,
				updated_at = NOW()
			WHERE id = $1
		`, brandUUID)
		return err

	case "BRAND_AUTHPLUS_VERIFICATION_COMPLETE":
		err = p.updateAuthPlusStatus(ctx, brandUUID, "ACTIVE", event.VettingID)
		if err == nil {
			// Send success email
			go p.sendAuthPlusCompleteEmail(context.Background(), event.BrandID)
		}
		return err

	case "BRAND_AUTHPLUS_VERIFICATION_FAILED", "BRAND_AUTHPLUS_2FA_FAILED":
		err = p.updateAuthPlusStatus(ctx, brandUUID, "FAILED", event.VettingID)
		if err == nil {
			go p.sendAuthPlusFailedEmail(context.Background(), event.BrandID, "verification_failed")
		}
		return err

	case "BRAND_AUTHPLUS_VERIFICATION_EXPIRED":
		return p.updateAuthPlusStatus(ctx, brandUUID, "EXPIRED", event.VettingID)

	case "BRAND_EMAIL_2FA_SEND":
		// Track email sent for UI progress
		_, err = p.db.Exec(ctx, `
			UPDATE messaging.brands_10dlc
			SET auth_plus_email_sent_at = NOW(),
				updated_at = NOW()
			WHERE id = $1
		`, brandUUID)
		return err

	case "BRAND_EMAIL_2FA_OPEN":
		// Track email opened
		_, err = p.db.Exec(ctx, `
			UPDATE messaging.brands_10dlc
			SET auth_plus_email_opened_at = NOW(),
				updated_at = NOW()
			WHERE id = $1
		`, brandUUID)
		return err

	case "BRAND_EMAIL_2FA_EXPIRED":
		// Notify user PIN expired
		go p.sendPINExpiredEmail(context.Background(), event.BrandID)
		return nil

	default:
		p.logger.Warn("Unknown Auth+ event type", zap.String("event_type", event.EventType))
		return nil
	}
}

// updateAuthPlusStatus updates the vetting_status field for Auth+
func (p *WebhookProcessor) updateAuthPlusStatus(ctx context.Context, brandUUID uuid.UUID, status string, vettingID string) error {
	var timestampField string
	switch status {
	case "PENDING":
		timestampField = "auth_plus_requested_at"
	case "ACTIVE":
		timestampField = "auth_plus_completed_at"
	case "FAILED":
		timestampField = "auth_plus_failed_at"
	}

	query := `
		UPDATE messaging.brands_10dlc
		SET
			vetting_status = $2,
			vetting_token = $3,
			vetting_class = 'AUTHPLUS',
			vetting_provider = 'AEGIS',
			vetting_date = CASE WHEN $2 IN ('ACTIVE', 'FAILED', 'EXPIRED') THEN NOW() ELSE vetting_date END,
	`

	if timestampField != "" {
		query += timestampField + ` = NOW(),`
	}

	query += `
			last_synced_at = NOW(),
			sync_source = 'webhook',
			updated_at = NOW()
		WHERE id = $1
	`

	_, err := p.db.Exec(ctx, query, brandUUID, status, vettingID)
	if err != nil {
		return fmt.Errorf("failed to update Auth+ status: %w", err)
	}

	p.logger.Info("Auth+ status updated",
		zap.String("brand_uuid", brandUUID.String()),
		zap.String("status", status),
	)

	return nil
}

// sendAuthPlusCompleteEmail sends notification when Auth+ verification completes
func (p *WebhookProcessor) sendAuthPlusCompleteEmail(ctx context.Context, tcrBrandID string) {
	// Get user email and brand details
	userEmail, brandName, err := p.webhookRepo.GetUserEmailAndBrandName(ctx, tcrBrandID)
	if err != nil {
		p.logger.Error("Failed to get user email for Auth+ complete notification",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.Error(err),
		)
		return
	}

	// Send email (template to be created)
	err = p.emailService.SendTCRAuthPlusComplete(userEmail, brandName, tcrBrandID)
	if err != nil {
		p.logger.Error("Failed to send Auth+ complete email",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.String("user_email", userEmail),
			zap.Error(err),
		)
	}
}

// sendAuthPlusFailedEmail sends notification when Auth+ verification fails
func (p *WebhookProcessor) sendAuthPlusFailedEmail(ctx context.Context, tcrBrandID string, reason string) {
	userEmail, brandName, err := p.webhookRepo.GetUserEmailAndBrandName(ctx, tcrBrandID)
	if err != nil {
		p.logger.Error("Failed to get user email for Auth+ failed notification",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.Error(err),
		)
		return
	}

	err = p.emailService.SendTCRAuthPlusFailed(userEmail, brandName, tcrBrandID, reason)
	if err != nil {
		p.logger.Error("Failed to send Auth+ failed email",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.Error(err),
		)
	}
}

// sendPINExpiredEmail sends notification when 2FA PIN expires
func (p *WebhookProcessor) sendPINExpiredEmail(ctx context.Context, tcrBrandID string) {
	userEmail, brandName, err := p.webhookRepo.GetUserEmailAndBrandName(ctx, tcrBrandID)
	if err != nil {
		p.logger.Error("Failed to get user email for PIN expired notification",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.Error(err),
		)
		return
	}

	err = p.emailService.SendTCRPINExpired(userEmail, brandName, tcrBrandID)
	if err != nil {
		p.logger.Error("Failed to send PIN expired email",
			zap.String("tcr_brand_id", tcrBrandID),
			zap.Error(err),
		)
	}
}

func getString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func getInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}
