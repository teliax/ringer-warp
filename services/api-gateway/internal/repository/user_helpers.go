package repository

import (
	"context"
	"fmt"
	
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/ringer-warp/api-gateway/internal/models"
)

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT u.id, u.google_id, u.email, u.display_name, u.photo_url,
		       u.user_type_id, u.is_active, u.last_login,
		       u.created_at, u.updated_at,
		       ut.type_name
		FROM auth.users u
		JOIN auth.user_types ut ON ut.id = u.user_type_id
		WHERE u.email = $1
	`

	user := &models.User{
		UserType: &models.UserType{},
	}
	
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.GoogleID,
		&user.Email,
		&user.DisplayName,
		&user.PhotoURL,
		&user.UserTypeID,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.UserType.TypeName,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	return user, nil
}

// UpdateGoogleID updates a user's Google OAuth ID (for first-time login)
func (r *UserRepository) UpdateGoogleID(ctx context.Context, userID uuid.UUID, googleID string) error {
	query := `
		UPDATE auth.users
		SET google_id = $1, updated_at = NOW()
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, googleID, userID)
	if err != nil {
		return fmt.Errorf("failed to update Google ID: %w", err)
	}

	return nil
}

// HasCustomerAccess checks if a user has access to a specific customer
func (r *UserRepository) HasCustomerAccess(ctx context.Context, userID uuid.UUID, customerID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM auth.user_customer_access
			WHERE user_id = $1 AND customer_id = $2
		)
	`

	var hasAccess bool
	err := r.db.QueryRow(ctx, query, userID, customerID).Scan(&hasAccess)
	if err != nil {
		return false, fmt.Errorf("failed to check customer access: %w", err)
	}

	return hasAccess, nil
}

// GetCustomerUsers retrieves all users with access to a specific customer
func (r *UserRepository) GetCustomerUsers(ctx context.Context, customerID uuid.UUID) ([]models.CustomerUser, error) {
	query := `
		SELECT
			u.id,
			u.email,
			u.display_name,
			u.photo_url,
			ut.type_name as user_type,
			u.is_active,
			uca.role,
			uca.granted_at,
			uca.granted_by,
			u.last_login
		FROM auth.user_customer_access uca
		JOIN auth.users u ON u.id = uca.user_id
		JOIN auth.user_types ut ON ut.id = u.user_type_id
		WHERE uca.customer_id = $1
		ORDER BY u.display_name
	`

	rows, err := r.db.Query(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer users: %w", err)
	}
	defer rows.Close()

	var users []models.CustomerUser
	for rows.Next() {
		var user models.CustomerUser
		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.DisplayName,
			&user.PhotoURL,
			&user.UserType,
			&user.IsActive,
			&user.Role,
			&user.GrantedAt,
			&user.GrantedBy,
			&user.LastLogin,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan customer user: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating customer users: %w", err)
	}

	return users, nil
}

// RemoveCustomerAccess removes a user's access to a customer
func (r *UserRepository) RemoveCustomerAccess(ctx context.Context, userID uuid.UUID, customerID uuid.UUID) error {
	query := `
		DELETE FROM auth.user_customer_access
		WHERE user_id = $1 AND customer_id = $2
	`

	result, err := r.db.Exec(ctx, query, userID, customerID)
	if err != nil {
		return fmt.Errorf("failed to remove customer access: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("no access found to remove")
	}

	return nil
}

// UpdateCustomerRole updates a user's role for a specific customer
func (r *UserRepository) UpdateCustomerRole(ctx context.Context, userID uuid.UUID, customerID uuid.UUID, role string, updatedBy string) error {
	query := `
		UPDATE auth.user_customer_access
		SET role = $1, updated_at = NOW(), updated_by = $2
		WHERE user_id = $3 AND customer_id = $4
	`

	result, err := r.db.Exec(ctx, query, role, updatedBy, userID, customerID)
	if err != nil {
		return fmt.Errorf("failed to update customer role: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("no access found to update")
	}

	return nil
}


