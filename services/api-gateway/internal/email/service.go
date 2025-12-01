// Package email provides centralized email notification services
package email

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"strings"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
	"go.uber.org/zap"
)

//go:embed templates/**/*.html
var templateFS embed.FS

// Service is a centralized email notification service
type Service struct {
	fromEmail      string
	fromName       string
	dashboardURL   string // e.g., https://console.rns.ringer.tel
	sendGridAPIKey string
	templates      map[string]*template.Template
	logger         *zap.Logger
}

// Config holds email service configuration
type Config struct {
	FromEmail      string
	FromName       string
	DashboardURL   string
	SendGridAPIKey string
}

// NewService creates a new centralized email service
func NewService(cfg Config, logger *zap.Logger) (*Service, error) {
	s := &Service{
		fromEmail:      cfg.FromEmail,
		fromName:       cfg.FromName,
		dashboardURL:   cfg.DashboardURL,
		sendGridAPIKey: cfg.SendGridAPIKey,
		templates:      make(map[string]*template.Template),
		logger:         logger,
	}

	// Load base layout template
	baseLayout, err := template.ParseFS(templateFS, "templates/base/layout.html")
	if err != nil {
		return nil, fmt.Errorf("failed to load base layout: %w", err)
	}

	// Load all TCR templates
	tcrTemplates := []string{
		"templates/tcr/brand_verified.html",
		"templates/tcr/brand_status_changed.html",
		"templates/tcr/campaign_approved.html",
		"templates/tcr/campaign_rejected.html",
		"templates/tcr/auth_plus_complete.html",
		"templates/tcr/auth_plus_failed.html",
		"templates/tcr/auth_plus_pin_expired.html",
	}

	for _, templatePath := range tcrTemplates {
		// Extract template name from path (e.g., "brand_verified" from "templates/tcr/brand_verified.html")
		parts := strings.Split(templatePath, "/")
		templateName := strings.TrimSuffix(parts[len(parts)-1], ".html")
		fullName := parts[len(parts)-2] + "/" + templateName // e.g., "tcr/brand_verified"

		// Clone base layout and parse content template
		tmpl, err := baseLayout.Clone()
		if err != nil {
			return nil, fmt.Errorf("failed to clone base layout for %s: %w", fullName, err)
		}

		// Parse content template
		tmpl, err = tmpl.ParseFS(templateFS, templatePath)
		if err != nil {
			return nil, fmt.Errorf("failed to parse template %s: %w", fullName, err)
		}

		s.templates[fullName] = tmpl
	}

	logger.Info("Email service initialized",
		zap.Int("templates_loaded", len(s.templates)),
		zap.String("from", cfg.FromEmail),
	)

	return s, nil
}

// EmailData is the base data structure for all emails
type EmailData struct {
	Subject        string
	HeaderTitle    string
	Content        string // Rendered content from specific template
	DashboardURL   string
	UnsubscribeURL string
}

// SendTemplatedEmail sends an email using a template
func (s *Service) SendTemplatedEmail(to, subject, templateName string, data interface{}) error {
	// Get template
	tmpl, ok := s.templates[templateName]
	if !ok {
		return fmt.Errorf("template not found: %s", templateName)
	}

	// Render content template
	var contentBuf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&contentBuf, templateName+".html", data); err != nil {
		return fmt.Errorf("failed to render content template: %w", err)
	}

	// Render full email with base layout
	emailData := EmailData{
		Subject:        subject,
		HeaderTitle:    subject,
		Content:        contentBuf.String(),
		DashboardURL:   s.dashboardURL,
		UnsubscribeURL: s.dashboardURL + "/settings/notifications",
	}

	var htmlBuf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&htmlBuf, "layout.html", emailData); err != nil {
		return fmt.Errorf("failed to render email layout: %w", err)
	}

	// Generate plain text version (strip HTML tags)
	plainBody := s.htmlToPlainText(htmlBuf.String())

	// Send via SendGrid
	return s.sendEmail(to, subject, htmlBuf.String(), plainBody)
}

// sendEmail sends email via SendGrid
func (s *Service) sendEmail(to, subject, htmlBody, plainBody string) error {
	// If SendGrid API key is not set, log only (development mode)
	if s.sendGridAPIKey == "" {
		s.logger.Info("Email would be sent (SendGrid not configured)",
			zap.String("to", to),
			zap.String("subject", subject),
		)
		return nil
	}

	// SendGrid implementation
	from := mail.NewEmail(s.fromName, s.fromEmail)
	toEmail := mail.NewEmail("", to)
	message := mail.NewSingleEmail(from, subject, toEmail, plainBody, htmlBody)

	client := sendgrid.NewSendClient(s.sendGridAPIKey)
	response, err := client.Send(message)
	if err != nil {
		return fmt.Errorf("SendGrid error: %w", err)
	}

	if response.StatusCode >= 400 {
		return fmt.Errorf("SendGrid returned status %d: %s", response.StatusCode, response.Body)
	}

	s.logger.Info("Email sent via SendGrid",
		zap.String("to", to),
		zap.String("subject", subject),
		zap.Int("status_code", response.StatusCode),
	)

	return nil
}

// htmlToPlainText converts HTML to plain text (basic implementation)
func (s *Service) htmlToPlainText(html string) string {
	// Remove HTML tags (basic regex replacement)
	text := html
	text = strings.ReplaceAll(text, "<br>", "\n")
	text = strings.ReplaceAll(text, "<br/>", "\n")
	text = strings.ReplaceAll(text, "<br />", "\n")
	text = strings.ReplaceAll(text, "</p>", "\n\n")
	text = strings.ReplaceAll(text, "</div>", "\n")
	text = strings.ReplaceAll(text, "</li>", "\n")

	// Remove all remaining HTML tags
	for strings.Contains(text, "<") && strings.Contains(text, ">") {
		start := strings.Index(text, "<")
		end := strings.Index(text, ">")
		if end > start {
			text = text[:start] + text[end+1:]
		} else {
			break
		}
	}

	// Clean up excessive whitespace
	lines := strings.Split(text, "\n")
	var cleanLines []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			cleanLines = append(cleanLines, trimmed)
		}
	}

	return strings.Join(cleanLines, "\n")
}

// TCR-specific email methods

// TCRBrandVerifiedData holds data for brand verification emails
type TCRBrandVerifiedData struct {
	UserName         string
	BrandName        string
	TCRBrandID       string
	BrandID          string
	IdentityStatus   string
	TrustScore       int
	VerifiedAt       string
	DashboardURL     string
	ThroughputLimit  string
}

// TCRBrandStatusChangedData holds data for generic brand status change emails
type TCRBrandStatusChangedData struct {
	UserName       string
	BrandName      string
	TCRBrandID     string
	BrandID        string
	PreviousStatus string
	NewStatus      string
	StatusClass    string // CSS class for status badge (status-success, status-warning, status-danger)
	IdentityStatus string
	TrustScore     int
	UpdatedAt      string
	StatusMessage  string   // Human-readable status explanation
	NextSteps      string   // What the user should do next
	VettingInfo    string   // Additional vetting information if applicable
	DashboardURL   string
}

// TCRCampaignApprovedData holds data for campaign approval emails
type TCRCampaignApprovedData struct {
	UserName            string
	CampaignDescription string
	TCRCampaignID       string
	CampaignID          string
	BrandName           string
	UseCase             string
	CarrierName         string
	ApprovedAt          string
	ThroughputLimit     string
	DailyLimit          string
	PendingCarriers     []string
	DashboardURL        string
}

// TCRCampaignRejectedData holds data for campaign rejection emails
type TCRCampaignRejectedData struct {
	UserName            string
	CampaignDescription string
	TCRCampaignID       string
	CampaignID          string
	BrandName           string
	UseCase             string
	CarrierName         string
	RejectionReason     string
	DashboardURL        string
}

// TCRAuthPlusCompleteData holds data for Auth+ completion email
type TCRAuthPlusCompleteData struct {
	BrandName    string
	TCRBrandID   string
	DashboardURL string
}

// TCRAuthPlusFailedData holds data for Auth+ failure email
type TCRAuthPlusFailedData struct {
	BrandName     string
	TCRBrandID    string
	FailureReason string
	DashboardURL  string
}

// TCRPINExpiredData holds data for PIN expiration email
type TCRPINExpiredData struct {
	BrandName    string
	TCRBrandID   string
	DashboardURL string
}

// SendTCRBrandVerified sends notification when brand is verified
func (s *Service) SendTCRBrandVerified(to string, data *TCRBrandVerifiedData) error {
	data.DashboardURL = s.dashboardURL
	subject := fmt.Sprintf("✅ Your 10DLC Brand '%s' Has Been Verified", data.BrandName)
	return s.SendTemplatedEmail(to, subject, "tcr/brand_verified", data)
}

// SendTCRBrandStatusChanged sends notification when brand status changes
func (s *Service) SendTCRBrandStatusChanged(to string, data *TCRBrandStatusChangedData) error {
	data.DashboardURL = s.dashboardURL

	// Determine subject based on status
	var emoji string
	switch data.NewStatus {
	case "VERIFIED", "VETTED_VERIFIED":
		emoji = "✅"
	case "UNVERIFIED", "SUSPENDED":
		emoji = "⚠️"
	case "REGISTERED", "PENDING":
		emoji = "⏳"
	default:
		emoji = "📋"
	}

	subject := fmt.Sprintf("%s Your 10DLC Brand '%s' Status: %s", emoji, data.BrandName, data.NewStatus)
	return s.SendTemplatedEmail(to, subject, "tcr/brand_status_changed", data)
}

// SendTCRCampaignApproved sends notification when campaign is approved
func (s *Service) SendTCRCampaignApproved(to string, data *TCRCampaignApprovedData) error {
	data.DashboardURL = s.dashboardURL
	subject := fmt.Sprintf("✅ Your SMS Campaign Approved by %s", data.CarrierName)
	return s.SendTemplatedEmail(to, subject, "tcr/campaign_approved", data)
}

// SendTCRCampaignRejected sends notification when campaign is rejected
func (s *Service) SendTCRCampaignRejected(to string, data *TCRCampaignRejectedData) error {
	data.DashboardURL = s.dashboardURL
	subject := fmt.Sprintf("⚠️ SMS Campaign Rejected by %s", data.CarrierName)
	return s.SendTemplatedEmail(to, subject, "tcr/campaign_rejected", data)
}

// SendTCRAuthPlusComplete sends notification when Auth+ verification completes
func (s *Service) SendTCRAuthPlusComplete(to string, brandName string, tcrBrandID string) error {
	data := &TCRAuthPlusCompleteData{
		BrandName:    brandName,
		TCRBrandID:   tcrBrandID,
		DashboardURL: s.dashboardURL,
	}
	subject := "✅ Auth+ Verification Complete - Create Campaigns Now!"
	return s.SendTemplatedEmail(to, subject, "tcr/auth_plus_complete", data)
}

// SendTCRAuthPlusFailed sends notification when Auth+ verification fails
func (s *Service) SendTCRAuthPlusFailed(to string, brandName string, tcrBrandID string, reason string) error {
	data := &TCRAuthPlusFailedData{
		BrandName:     brandName,
		TCRBrandID:    tcrBrandID,
		FailureReason: reason,
		DashboardURL:  s.dashboardURL,
	}
	subject := "⚠️ Auth+ Verification Failed - Action Required"
	return s.SendTemplatedEmail(to, subject, "tcr/auth_plus_failed", data)
}

// SendTCRPINExpired sends notification when 2FA PIN expires
func (s *Service) SendTCRPINExpired(to string, brandName string, tcrBrandID string) error {
	data := &TCRPINExpiredData{
		BrandName:    brandName,
		TCRBrandID:   tcrBrandID,
		DashboardURL: s.dashboardURL,
	}
	subject := "🔑 Auth+ 2FA PIN Expired - Resend Required"
	return s.SendTemplatedEmail(to, subject, "tcr/auth_plus_pin_expired", data)
}
