package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type InvitationRepository struct {
	db *pgxpool.Pool
}

func NewInvitationRepository(db *pgxpool.Pool) *InvitationRepository {
	return &InvitationRepository{db: db}
}

// Create creates a new invitation
func (r *InvitationRepository) Create(
	ctx context.Context,
	email string,
	userTypeID uuid.UUID,
	customerID uuid.UUID,
	role string,
	message *string,
	invitedBy uuid.UUID,
) (*models.Invitation, error) {
	query := `
		INSERT INTO auth.user_invitations (
			email, user_type_id, customer_id, role, message, invited_by
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, token, email, user_type_id, customer_id, role,
		          invited_by, message, expires_at, status, sent_at,
		          accepted_at, accepted_by_user_id, created_at, updated_at
	`

	invitation := &models.Invitation{}
	err := r.db.QueryRow(ctx, query,
		email, userTypeID, customerID, role, message, invitedBy,
	).Scan(
		&invitation.ID, &invitation.Token, &invitation.Email, &invitation.UserTypeID,
		&invitation.CustomerID, &invitation.Role, &invitation.InvitedBy, &invitation.Message,
		&invitation.ExpiresAt, &invitation.Status, &invitation.SentAt,
		&invitation.AcceptedAt, &invitation.AcceptedByUserID,
		&invitation.CreatedAt, &invitation.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create invitation: %w", err)
	}

	return invitation, nil
}

// GetByToken retrieves an invitation by its token
func (r *InvitationRepository) GetByToken(ctx context.Context, token uuid.UUID) (*models.Invitation, error) {
	query := `
		SELECT i.id, i.token, i.email, i.user_type_id, i.customer_id, i.role,
		       i.invited_by, i.message, i.expires_at, i.status, i.sent_at,
		       i.accepted_at, i.accepted_by_user_id, i.created_at, i.updated_at,
		       ut.type_name, ut.description,
		       c.id, c.ban, c.company_name,
		       u.id, u.email, u.display_name
		FROM auth.user_invitations i
		JOIN auth.user_types ut ON i.user_type_id = ut.id
		JOIN accounts.customers c ON i.customer_id = c.id
		JOIN auth.users u ON i.invited_by = u.id
		WHERE i.token = $1
	`

	invitation := &models.Invitation{
		UserType:      &models.UserType{},
		Customer:      &models.Customer{},
		InvitedByUser: &models.User{},
	}

	err := r.db.QueryRow(ctx, query, token).Scan(
		&invitation.ID, &invitation.Token, &invitation.Email, &invitation.UserTypeID,
		&invitation.CustomerID, &invitation.Role, &invitation.InvitedBy, &invitation.Message,
		&invitation.ExpiresAt, &invitation.Status, &invitation.SentAt,
		&invitation.AcceptedAt, &invitation.AcceptedByUserID,
		&invitation.CreatedAt, &invitation.UpdatedAt,
		&invitation.UserType.TypeName, &invitation.UserType.Description,
		&invitation.Customer.ID, &invitation.Customer.BAN, &invitation.Customer.CompanyName,
		&invitation.InvitedByUser.ID, &invitation.InvitedByUser.Email, &invitation.InvitedByUser.DisplayName,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get invitation by token: %w", err)
	}

	return invitation, nil
}

// GetByID retrieves an invitation by ID
func (r *InvitationRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Invitation, error) {
	query := `
		SELECT i.id, i.token, i.email, i.user_type_id, i.customer_id, i.role,
		       i.invited_by, i.message, i.expires_at, i.status, i.sent_at,
		       i.accepted_at, i.accepted_by_user_id, i.created_at, i.updated_at,
		       ut.type_name, ut.description,
		       c.id, c.ban, c.company_name,
		       u.id, u.email, u.display_name
		FROM auth.user_invitations i
		JOIN auth.user_types ut ON i.user_type_id = ut.id
		JOIN accounts.customers c ON i.customer_id = c.id
		JOIN auth.users u ON i.invited_by = u.id
		WHERE i.id = $1
	`

	invitation := &models.Invitation{
		UserType:      &models.UserType{},
		Customer:      &models.Customer{},
		InvitedByUser: &models.User{},
	}

	err := r.db.QueryRow(ctx, query, id).Scan(
		&invitation.ID, &invitation.Token, &invitation.Email, &invitation.UserTypeID,
		&invitation.CustomerID, &invitation.Role, &invitation.InvitedBy, &invitation.Message,
		&invitation.ExpiresAt, &invitation.Status, &invitation.SentAt,
		&invitation.AcceptedAt, &invitation.AcceptedByUserID,
		&invitation.CreatedAt, &invitation.UpdatedAt,
		&invitation.UserType.TypeName, &invitation.UserType.Description,
		&invitation.Customer.ID, &invitation.Customer.BAN, &invitation.Customer.CompanyName,
		&invitation.InvitedByUser.ID, &invitation.InvitedByUser.Email, &invitation.InvitedByUser.DisplayName,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get invitation by ID: %w", err)
	}

	return invitation, nil
}

// List retrieves invitations with optional filtering
func (r *InvitationRepository) List(
	ctx context.Context,
	customerFilter []uuid.UUID, // Multi-tenant scoping
	status string,
	page, perPage int,
) ([]models.Invitation, int64, error) {
	baseQuery := `
		FROM auth.user_invitations i
		JOIN auth.user_types ut ON i.user_type_id = ut.id
		JOIN accounts.customers c ON i.customer_id = c.id
		JOIN auth.users u ON i.invited_by = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	argPos := 1

	// Customer scoping (multi-tenant isolation)
	if customerFilter != nil {
		if len(customerFilter) == 0 {
			return []models.Invitation{}, 0, nil
		}
		baseQuery += fmt.Sprintf(" AND i.customer_id = ANY($%d)", argPos)
		args = append(args, customerFilter)
		argPos++
	}

	// Status filter
	if status != "" {
		baseQuery += fmt.Sprintf(" AND i.status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count invitations: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * perPage
	dataQuery := fmt.Sprintf(`
		SELECT i.id, i.token, i.email, i.user_type_id, i.customer_id, i.role,
		       i.invited_by, i.message, i.expires_at, i.status, i.sent_at,
		       i.accepted_at, i.accepted_by_user_id, i.created_at, i.updated_at,
		       ut.type_name, ut.description,
		       c.id, c.ban, c.company_name,
		       u.id, u.email, u.display_name
		%s
		ORDER BY i.created_at DESC
		LIMIT $%d OFFSET $%d
	`, baseQuery, argPos, argPos+1)

	args = append(args, perPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list invitations: %w", err)
	}
	defer rows.Close()

	invitations := []models.Invitation{}
	for rows.Next() {
		invitation := models.Invitation{
			UserType:      &models.UserType{},
			Customer:      &models.Customer{},
			InvitedByUser: &models.User{},
		}

		err := rows.Scan(
			&invitation.ID, &invitation.Token, &invitation.Email, &invitation.UserTypeID,
			&invitation.CustomerID, &invitation.Role, &invitation.InvitedBy, &invitation.Message,
			&invitation.ExpiresAt, &invitation.Status, &invitation.SentAt,
			&invitation.AcceptedAt, &invitation.AcceptedByUserID,
			&invitation.CreatedAt, &invitation.UpdatedAt,
			&invitation.UserType.TypeName, &invitation.UserType.Description,
			&invitation.Customer.ID, &invitation.Customer.BAN, &invitation.Customer.CompanyName,
			&invitation.InvitedByUser.ID, &invitation.InvitedByUser.Email, &invitation.InvitedByUser.DisplayName,
		)

		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan invitation: %w", err)
		}

		invitations = append(invitations, invitation)
	}

	return invitations, total, nil
}

// UpdateStatus updates the status of an invitation
func (r *InvitationRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `
		UPDATE auth.user_invitations
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`

	result, err := r.db.Exec(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update invitation status: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("invitation not found")
	}

	return nil
}

// MarkAccepted marks an invitation as accepted
func (r *InvitationRepository) MarkAccepted(ctx context.Context, id uuid.UUID, acceptedByUserID uuid.UUID) error {
	query := `
		UPDATE auth.user_invitations
		SET status = 'ACCEPTED',
		    accepted_at = NOW(),
		    accepted_by_user_id = $1,
		    updated_at = NOW()
		WHERE id = $2
	`

	result, err := r.db.Exec(ctx, query, acceptedByUserID, id)
	if err != nil {
		return fmt.Errorf("failed to mark invitation accepted: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("invitation not found")
	}

	return nil
}

// Delete deletes an invitation (revoke)
func (r *InvitationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM auth.user_invitations WHERE id = $1`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete invitation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("invitation not found")
	}

	return nil
}

// CheckPendingInvitation checks if a pending invitation exists for email+customer
func (r *InvitationRepository) CheckPendingInvitation(ctx context.Context, email string, customerID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM auth.user_invitations
			WHERE email = $1 AND customer_id = $2 AND status = 'PENDING'
		)
	`

	var exists bool
	err := r.db.QueryRow(ctx, query, email, customerID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check pending invitation: %w", err)
	}

	return exists, nil
}

// ExpireOldInvitations expires invitations past their expiry date (run via CronJob)
func (r *InvitationRepository) ExpireOldInvitations(ctx context.Context) (int, error) {
	query := `SELECT auth.expire_old_invitations()`

	var expiredCount int
	err := r.db.QueryRow(ctx, query).Scan(&expiredCount)
	if err != nil {
		return 0, fmt.Errorf("failed to expire old invitations: %w", err)
	}

	return expiredCount, nil
}

// CleanupOldInvitations removes processed invitations older than 90 days
func (r *InvitationRepository) CleanupOldInvitations(ctx context.Context) (int, error) {
	query := `SELECT auth.cleanup_old_invitations()`

	var deletedCount int
	err := r.db.QueryRow(ctx, query).Scan(&deletedCount)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old invitations: %w", err)
	}

	return deletedCount, nil
}

// GrantCustomerAccess creates a user-customer access entry
// This is called when an invitation is accepted
func (r *InvitationRepository) GrantCustomerAccess(
	ctx context.Context,
	userID uuid.UUID,
	customerID uuid.UUID,
	role string,
	grantedBy string,
) error {
	query := `
		INSERT INTO auth.user_customer_access (user_id, customer_id, role, granted_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, customer_id) DO UPDATE
		SET role = EXCLUDED.role,
		    granted_by = EXCLUDED.granted_by
	`

	_, err := r.db.Exec(ctx, query, userID, customerID, role, grantedBy)
	if err != nil {
		return fmt.Errorf("failed to grant customer access: %w", err)
	}

	return nil
}
