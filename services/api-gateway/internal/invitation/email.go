package invitation

import (
	"context"
	"fmt"

	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
	"go.uber.org/zap"
)

// EmailService handles sending invitation and welcome emails
type EmailService struct {
	fromEmail      string
	fromName       string
	baseURL        string // e.g., https://admin.rns.ringer.tel
	sendGridAPIKey string
	logger         *zap.Logger
}

// NewEmailService creates a new email service
func NewEmailService(fromEmail, fromName, baseURL, sendGridAPIKey string, logger *zap.Logger) *EmailService {
	return &EmailService{
		fromEmail:      fromEmail,
		fromName:       fromName,
		baseURL:        baseURL,
		sendGridAPIKey: sendGridAPIKey,
		logger:         logger,
	}
}

// SendInvitation sends an invitation email
func (s *EmailService) SendInvitation(ctx context.Context, invitation *models.Invitation) error {
	invitationURL := fmt.Sprintf("%s/invitations/accept/%s", s.baseURL, invitation.Token)

	// Build email content
	subject := "You've been invited to WARP Platform"

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #231F20; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #58C5C7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .details { background: white; padding: 15px; border-left: 4px solid #58C5C7; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>You've been invited to WARP!</h1>
        </div>

        <div class="content">
            <p>Hi there,</p>

            <p><strong>%s</strong> (%s) has invited you to join <strong>%s</strong> on the WARP platform.</p>

            <p><strong>Your Role:</strong> %s</p>
            <p>You'll be able to manage telecommunications services for your account.</p>

            <div style="text-align: center;">
                <a href="%s" class="button">Accept Invitation</a>
            </div>

            <div class="details">
                <p><strong>Invitation Details:</strong></p>
                <ul>
                    <li>Company: %s (%s)</li>
                    <li>Account Role: %s</li>
                    <li>Expires: %s</li>
                    <li>Your Email: %s</li>
                </ul>
            </div>

            %s
        </div>

        <div class="footer">
            <p>This invitation link is valid for 7 days and can only be used once.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>
`,
		invitation.InvitedByUser.DisplayName,
		invitation.InvitedByUser.Email,
		invitation.Customer.CompanyName,
		invitation.UserType.Description,
		invitationURL,
		invitation.Customer.CompanyName,
		invitation.Customer.BAN,
		invitation.Role,
		invitation.ExpiresAt.Format("January 2, 2006 at 3:04 PM MST"),
		invitation.Email,
		func() string {
			if invitation.Message != nil && *invitation.Message != "" {
				return fmt.Sprintf("<div class=\"details\"><p><strong>Personal message from %s:</strong></p><blockquote>%s</blockquote></div>",
					invitation.InvitedByUser.DisplayName, *invitation.Message)
			}
			return ""
		}(),
	)

	plainBody := fmt.Sprintf(`You've been invited to WARP Platform

%s (%s) has invited you to join %s on the WARP platform.

Your Role: %s
You'll be able to manage telecommunications services for your account.

Accept invitation: %s

Invitation Details:
- Company: %s (%s)
- Account Role: %s
- Expires: %s
- Your Email: %s

%s

---
This invitation link is valid for 7 days and can only be used once.
If you didn't expect this invitation, you can safely ignore this email.
`,
		invitation.InvitedByUser.DisplayName,
		invitation.InvitedByUser.Email,
		invitation.Customer.CompanyName,
		invitation.UserType.Description,
		invitationURL,
		invitation.Customer.CompanyName,
		invitation.Customer.BAN,
		invitation.Role,
		invitation.ExpiresAt.Format("January 2, 2006 at 3:04 PM MST"),
		invitation.Email,
		func() string {
			if invitation.Message != nil && *invitation.Message != "" {
				return fmt.Sprintf("Personal message: %s", *invitation.Message)
			}
			return ""
		}(),
	)

	// Send email
	if err := s.sendEmail(invitation.Email, subject, htmlBody, plainBody); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	s.logger.Info("Invitation email sent",
		zap.String("to", invitation.Email),
		zap.String("invitation_id", invitation.ID.String()),
	)

	return nil
}

// SendWelcome sends a welcome email after invitation acceptance
func (s *EmailService) SendWelcome(ctx context.Context, user *models.User, customer *models.Customer) error {
	subject := "Welcome to WARP Platform!"

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #231F20; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #58C5C7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .features { background: white; padding: 20px; margin: 20px 0; }
        .feature { padding: 10px 0; border-bottom: 1px solid #eee; }
        .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to WARP!</h1>
        </div>

        <div class="content">
            <p>Hi %s,</p>

            <p>Your account has been activated! You now have access to <strong>%s</strong> on the WARP platform.</p>

            <div class="features">
                <p><strong>What you can do:</strong></p>
                <div class="feature">✅ Manage SIP trunks and voice routing</div>
                <div class="feature">✅ Purchase and configure phone numbers</div>
                <div class="feature">✅ Send and receive SMS/MMS messages</div>
                <div class="feature">✅ View call detail records (CDRs)</div>
                <div class="feature">✅ Monitor usage and billing</div>
            </div>

            <div style="text-align: center;">
                <a href="%s/dashboard" class="button">Go to Dashboard</a>
            </div>

            <p><strong>Need help?</strong> Visit our <a href="https://docs.ringer.tel">documentation</a> or contact support at support@ringer.tel.</p>
        </div>

        <div class="footer">
            <p>&copy; 2025 Ringer. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`,
		user.DisplayName,
		customer.CompanyName,
		s.baseURL,
	)

	plainBody := fmt.Sprintf(`Welcome to WARP, %s!

Your account has been activated. You now have access to %s on the WARP platform.

What you can do:
✅ Manage SIP trunks and voice routing
✅ Purchase and configure phone numbers
✅ Send and receive SMS/MMS messages
✅ View call detail records (CDRs)
✅ Monitor usage and billing

Go to dashboard: %s/dashboard

Need help? Visit our documentation at https://docs.ringer.tel or contact support at support@ringer.tel.

---
© 2025 Ringer. All rights reserved.
`,
		user.DisplayName,
		customer.CompanyName,
		s.baseURL,
	)

	if err := s.sendEmail(user.Email, subject, htmlBody, plainBody); err != nil {
		return fmt.Errorf("failed to send welcome email: %w", err)
	}

	s.logger.Info("Welcome email sent",
		zap.String("to", user.Email),
		zap.String("user_id", user.ID.String()),
	)

	return nil
}

// sendEmail is the low-level email sending function
func (s *EmailService) sendEmail(to, subject, htmlBody, plainBody string) error {
	// If SendGrid API key is not set, log only (development mode)
	if s.sendGridAPIKey == "" {
		s.logger.Info("Email would be sent (SendGrid not configured)",
			zap.String("to", to),
			zap.String("subject", subject),
			zap.String("preview", plainBody[:min(100, len(plainBody))]),
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
