package invitation

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/auth"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"go.uber.org/zap"
)

// Service handles invitation business logic
type Service struct {
	invitationRepo *repository.InvitationRepository
	userRepo       *repository.UserRepository
	emailService   *EmailService
	jwtService     *auth.JWTService
	logger         *zap.Logger
}

// NewService creates a new invitation service
func NewService(
	invitationRepo *repository.InvitationRepository,
	userRepo *repository.UserRepository,
	emailService *EmailService,
	jwtService *auth.JWTService,
	logger *zap.Logger,
) *Service {
	return &Service{
		invitationRepo: invitationRepo,
		userRepo:       userRepo,
		emailService:   emailService,
		jwtService:     jwtService,
		logger:         logger,
	}
}

// CreateInvitation creates and sends a new invitation
func (s *Service) CreateInvitation(
	ctx context.Context,
	email string,
	userTypeName string,
	customerID uuid.UUID,
	role string,
	message *string,
	invitedBy uuid.UUID,
) (*models.Invitation, error) {
	// 1. Validate email not already a user
	existingUser, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}
	if existingUser != nil {
		return nil, fmt.Errorf("user with email %s already exists - use customer assignment instead", email)
	}

	// 2. Check for pending invitation
	hasPending, err := s.invitationRepo.CheckPendingInvitation(ctx, email, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to check pending invitation: %w", err)
	}
	if hasPending {
		return nil, fmt.Errorf("pending invitation already exists for %s to this customer", email)
	}

	// 3. Get user type ID by name
	userTypeID, err := s.userRepo.GetUserTypeIDByName(ctx, userTypeName)
	if err != nil {
		return nil, fmt.Errorf("failed to get user type ID: %w", err)
	}

	// 4. Create invitation in database
	invitation, err := s.invitationRepo.Create(ctx, email, userTypeID, customerID, role, message, invitedBy)
	if err != nil {
		return nil, fmt.Errorf("failed to create invitation: %w", err)
	}

	// 5. Load related data for email
	fullInvitation, err := s.invitationRepo.GetByID(ctx, invitation.ID)
	if err != nil {
		s.logger.Warn("Failed to load invitation details for email", zap.Error(err))
		fullInvitation = invitation // Use what we have
	}

	// 6. Send invitation email
	if err := s.emailService.SendInvitation(ctx, fullInvitation); err != nil {
		s.logger.Error("Failed to send invitation email",
			zap.String("invitation_id", invitation.ID.String()),
			zap.String("email", email),
			zap.Error(err),
		)
		// Don't fail the invitation creation - email can be resent
	}

	s.logger.Info("Invitation created and sent",
		zap.String("invitation_id", invitation.ID.String()),
		zap.String("email", email),
		zap.String("customer_id", customerID.String()),
		zap.String("user_type", userTypeName),
	)

	return fullInvitation, nil
}

// GetInvitationByToken retrieves an invitation by token and validates it
func (s *Service) GetInvitationByToken(ctx context.Context, token uuid.UUID) (*models.Invitation, error) {
	invitation, err := s.invitationRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, err
	}

	if invitation == nil {
		return nil, fmt.Errorf("invitation not found")
	}

	// Auto-expire if past expiry date
	if invitation.Status == "PENDING" && time.Now().After(invitation.ExpiresAt) {
		if err := s.invitationRepo.UpdateStatus(ctx, invitation.ID, "EXPIRED"); err != nil {
			s.logger.Warn("Failed to auto-expire invitation", zap.Error(err))
		}
		invitation.Status = "EXPIRED"
	}

	return invitation, nil
}

// AcceptInvitation processes an invitation acceptance
func (s *Service) AcceptInvitation(
	ctx context.Context,
	token uuid.UUID,
	googleID string,
	email string,
	name string,
) (*models.User, *models.AuthTokens, error) {
	// 1. Get invitation
	invitation, err := s.GetInvitationByToken(ctx, token)
	if err != nil {
		return nil, nil, err
	}

	if invitation == nil {
		return nil, nil, fmt.Errorf("invitation not found")
	}

	// 2. Validate invitation status
	if invitation.Status == "EXPIRED" {
		return nil, nil, fmt.Errorf("invitation has expired")
	}
	if invitation.Status == "REVOKED" {
		return nil, nil, fmt.Errorf("invitation has been revoked")
	}
	if invitation.Status == "ACCEPTED" {
		return nil, nil, fmt.Errorf("invitation has already been accepted")
	}

	// 3. Validate email matches
	if email != invitation.Email {
		return nil, nil, fmt.Errorf("email mismatch: please sign in with %s", invitation.Email)
	}

	// 4. Check if user already exists (might have been created after invitation sent)
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to check existing user: %w", err)
	}

	// 5. Create user if doesn't exist
	if user == nil {
		user, err = s.userRepo.Create(ctx, googleID, email, name, invitation.UserTypeID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create user: %w", err)
		}

		s.logger.Info("User created via invitation",
			zap.String("user_id", user.ID.String()),
			zap.String("email", email),
			zap.String("invitation_id", invitation.ID.String()),
		)
	} else {
		// Update Google ID if changed or empty
		if user.GoogleID != googleID {
			if err := s.userRepo.UpdateGoogleID(ctx, user.ID, googleID); err != nil {
				s.logger.Warn("Failed to update Google ID", zap.Error(err))
			}
		}
	}

	// 6. Grant customer access
	if err := s.invitationRepo.GrantCustomerAccess(ctx, user.ID, invitation.CustomerID, invitation.Role, "invitation"); err != nil {
		return nil, nil, fmt.Errorf("failed to grant customer access: %w", err)
	}

	s.logger.Info("Customer access granted",
		zap.String("user_id", user.ID.String()),
		zap.String("customer_id", invitation.CustomerID.String()),
		zap.String("role", invitation.Role),
	)

	// 7. Mark invitation as accepted
	if err := s.invitationRepo.MarkAccepted(ctx, invitation.ID, user.ID); err != nil {
		s.logger.Warn("Failed to mark invitation accepted", zap.Error(err))
		// Don't fail - user already created and granted access
	}

	// 8. Generate JWT tokens
	accessToken, err := s.jwtService.GenerateAccessToken(user.ID, user.Email, user.UserTypeID, invitation.UserType.TypeName)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.jwtService.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	tokens := &models.AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    24 * 3600, // 24 hours
		Email:        user.Email,
		UserID:       user.ID.String(),
		UserType:     invitation.UserType.TypeName,
	}

	// 9. Send welcome email
	if err := s.emailService.SendWelcome(ctx, user, invitation.Customer); err != nil {
		s.logger.Warn("Failed to send welcome email",
			zap.String("user_id", user.ID.String()),
			zap.Error(err),
		)
		// Don't fail - user account is created
	}

	s.logger.Info("Invitation accepted successfully",
		zap.String("user_id", user.ID.String()),
		zap.String("email", email),
		zap.String("customer_id", invitation.CustomerID.String()),
	)

	return user, tokens, nil
}

// RevokeInvitation revokes a pending invitation
func (s *Service) RevokeInvitation(ctx context.Context, invitationID uuid.UUID) error {
	// Get invitation to check status
	invitation, err := s.invitationRepo.GetByID(ctx, invitationID)
	if err != nil {
		return err
	}

	if invitation == nil {
		return fmt.Errorf("invitation not found")
	}

	if invitation.Status != "PENDING" {
		return fmt.Errorf("can only revoke pending invitations (current status: %s)", invitation.Status)
	}

	// Update status to REVOKED
	if err := s.invitationRepo.UpdateStatus(ctx, invitationID, "REVOKED"); err != nil {
		return fmt.Errorf("failed to revoke invitation: %w", err)
	}

	s.logger.Info("Invitation revoked",
		zap.String("invitation_id", invitationID.String()),
		zap.String("email", invitation.Email),
	)

	return nil
}
