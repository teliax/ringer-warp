package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// GetByGoogleID retrieves a user by their Google OAuth ID
func (r *UserRepository) GetByGoogleID(ctx context.Context, googleID string) (*models.User, error) {
	query := `
		SELECT u.id, u.google_id, u.email, u.display_name, u.photo_url,
		       u.user_type_id, u.is_active, u.last_login, u.login_count,
		       u.created_at, u.updated_at,
		       ut.type_name
		FROM auth.users u
		JOIN auth.user_types ut ON ut.id = u.user_type_id
		WHERE u.google_id = $1
	`

	user := &models.User{
		UserType: &models.UserType{},
	}

	err := r.db.QueryRow(ctx, query, googleID).Scan(
		&user.ID,
		&user.GoogleID,
		&user.Email,
		&user.DisplayName,
		&user.PhotoURL,
		&user.UserTypeID,
		&user.IsActive,
		&user.LastLogin,
		&user.LoginCount,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.UserType.TypeName,
	)

	if err == pgx.ErrNoRows {
		return nil, nil // User not found
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by Google ID: %w", err)
	}

	return user, nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	query := `
		SELECT u.id, u.google_id, u.email, u.display_name, u.photo_url,
		       u.user_type_id, u.is_active, u.last_login, u.login_count,
		       u.created_at, u.updated_at,
		       ut.id as user_type_id, ut.type_name, ut.description
		FROM auth.users u
		JOIN auth.user_types ut ON ut.id = u.user_type_id
		WHERE u.id = $1
	`

	user := &models.User{
		UserType: &models.UserType{},
	}

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&user.ID,
		&user.FirebaseUID,
		&user.Email,
		&user.DisplayName,
		&user.PhotoURL,
		&user.UserTypeID,
		&user.IsActive,
		&user.LastLogin,
		&user.LoginCount,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.UserType.ID,
		&user.UserType.TypeName,
		&user.UserType.Description,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, googleID, email, displayName string, userTypeID uuid.UUID) (*models.User, error) {
	query := `
		INSERT INTO auth.users (google_id, email, display_name, user_type_id, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, google_id, email, display_name, photo_url,
		          user_type_id, is_active, last_login, login_count,
		          created_at, updated_at
	`

	user := &models.User{}
	err := r.db.QueryRow(ctx, query, googleID, email, displayName, userTypeID, email).Scan(
		&user.ID,
		&user.GoogleID,
		&user.Email,
		&user.DisplayName,
		&user.PhotoURL,
		&user.UserTypeID,
		&user.IsActive,
		&user.LastLogin,
		&user.LoginCount,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// UpdateLastLogin updates user's last login timestamp
func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	query := `
		UPDATE auth.users
		SET last_login = NOW(), login_count = login_count + 1
		WHERE id = $1
	`

	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to update last login: %w", err)
	}

	return nil
}

// GetUserCustomerAccess returns customer IDs user can access
func (r *UserRepository) GetUserCustomerAccess(ctx context.Context, userID uuid.UUID) ([]models.CustomerAccess, error) {
	query := `
		SELECT uca.customer_id, uca.role, c.company_name, c.ban
		FROM auth.user_customer_access uca
		JOIN accounts.customers c ON c.id = uca.customer_id
		WHERE uca.user_id = $1
		ORDER BY c.company_name
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer access: %w", err)
	}
	defer rows.Close()

	access := []models.CustomerAccess{}
	for rows.Next() {
		var ca models.CustomerAccess
		err := rows.Scan(&ca.CustomerID, &ca.Role, &ca.CustomerName, &ca.BAN)
		if err != nil {
			return nil, fmt.Errorf("failed to scan customer access: %w", err)
		}
		access = append(access, ca)
	}

	return access, nil
}

// GrantCustomerAccess grants a user access to a customer
func (r *UserRepository) GrantCustomerAccess(ctx context.Context, userID, customerID uuid.UUID, role, grantedBy string) error {
	query := `
		INSERT INTO auth.user_customer_access (user_id, customer_id, role, granted_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, customer_id) DO UPDATE
		SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by, granted_at = NOW()
	`

	_, err := r.db.Exec(ctx, query, userID, customerID, role, grantedBy)
	if err != nil {
		return fmt.Errorf("failed to grant customer access: %w", err)
	}

	return nil
}

// RevokeCustomerAccess removes user's access to a customer
func (r *UserRepository) RevokeCustomerAccess(ctx context.Context, userID, customerID uuid.UUID) error {
	query := `DELETE FROM auth.user_customer_access WHERE user_id = $1 AND customer_id = $2`

	_, err := r.db.Exec(ctx, query, userID, customerID)
	if err != nil {
		return fmt.Errorf("failed to revoke customer access: %w", err)
	}

	return nil
}

// List returns all users
func (r *UserRepository) List(ctx context.Context) ([]models.User, error) {
	query := `
		SELECT u.id, u.google_id, u.email, u.display_name, u.photo_url,
		       u.user_type_id, u.is_active, u.last_login, u.login_count,
		       u.created_at, u.updated_at,
		       ut.type_name
		FROM auth.users u
		JOIN auth.user_types ut ON ut.id = u.user_type_id
		ORDER BY u.created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		u.UserType = &models.UserType{}

		err := rows.Scan(
			&u.ID, &u.GoogleID, &u.Email, &u.DisplayName, &u.PhotoURL,
			&u.UserTypeID, &u.IsActive, &u.LastLogin, &u.LoginCount,
			&u.CreatedAt, &u.UpdatedAt,
			&u.UserType.TypeName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, u)
	}

	return users, nil
}

// Update updates a user
func (r *UserRepository) Update(ctx context.Context, userID uuid.UUID, req *models.UpdateUserRequest) error {
	updates := []string{}
	args := []interface{}{}
	argPos := 1

	if req.DisplayName != nil {
		updates = append(updates, fmt.Sprintf("display_name = $%d", argPos))
		args = append(args, *req.DisplayName)
		argPos++
	}

	if req.UserTypeID != nil {
		updates = append(updates, fmt.Sprintf("user_type_id = $%d", argPos))
		args = append(args, *req.UserTypeID)
		argPos++
	}

	if req.IsActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *req.IsActive)
		argPos++
	}

	if len(updates) == 0 {
		return nil // Nothing to update
	}

	args = append(args, userID)
	query := fmt.Sprintf(`
		UPDATE auth.users
		SET %s, updated_at = NOW()
		WHERE id = $%d
	`, join(updates, ", "), argPos)

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// Delete soft-deletes a user (sets inactive)
func (r *UserRepository) Delete(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE auth.users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`

	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}
