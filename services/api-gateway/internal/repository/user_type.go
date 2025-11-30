package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type UserTypeRepository struct {
	db *pgxpool.Pool
}

func NewUserTypeRepository(db *pgxpool.Pool) *UserTypeRepository {
	return &UserTypeRepository{db: db}
}

// GetUserTypeIDByName returns user type ID by name
func (r *UserRepository) GetUserTypeIDByName(ctx context.Context, typeName string) (uuid.UUID, error) {
	query := `SELECT id FROM auth.user_types WHERE type_name = $1`

	var typeID uuid.UUID
	err := r.db.QueryRow(ctx, query, typeName).Scan(&typeID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to get user type by name: %w", err)
	}

	return typeID, nil
}

// ListAll returns all user types with metadata
func (r *UserTypeRepository) ListAll(ctx context.Context) ([]models.UserTypeResponse, error) {
	query := `
		SELECT
			ut.id,
			ut.type_name,
			ut.description,
			ut.created_at,
			ut.updated_at,
			ut.created_by,
			COUNT(DISTINCT utp.id) as permission_count,
			COUNT(DISTINCT u.id) as user_count,
			COALESCE(
				(SELECT true FROM auth.user_type_permissions WHERE user_type_id = ut.id AND resource_path = '*' LIMIT 1),
				false
			) as has_wildcard
		FROM auth.user_types ut
		LEFT JOIN auth.user_type_permissions utp ON ut.id = utp.user_type_id
		LEFT JOIN auth.users u ON ut.id = u.user_type_id
		GROUP BY ut.id, ut.type_name, ut.description, ut.created_at, ut.updated_at, ut.created_by
		ORDER BY ut.type_name
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list user types: %w", err)
	}
	defer rows.Close()

	var userTypes []models.UserTypeResponse
	for rows.Next() {
		var ut models.UserTypeResponse
		var permCount, userCount int

		err := rows.Scan(
			&ut.ID,
			&ut.TypeName,
			&ut.Description,
			&ut.CreatedAt,
			&ut.UpdatedAt,
			&ut.CreatedBy,
			&permCount,
			&userCount,
			&ut.HasWildcardPermission,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user type: %w", err)
		}

		ut.UserCount = userCount

		// Get permissions for this user type
		permissions, _ := r.GetPermissions(ctx, ut.ID)
		ut.Permissions = permissions

		userTypes = append(userTypes, ut)
	}

	return userTypes, nil
}

// GetByID returns a specific user type by ID
func (r *UserTypeRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.UserTypeResponse, error) {
	query := `
		SELECT id, type_name, description, created_at, updated_at, created_by
		FROM auth.user_types
		WHERE id = $1
	`

	var ut models.UserTypeResponse
	err := r.db.QueryRow(ctx, query, id).Scan(
		&ut.ID,
		&ut.TypeName,
		&ut.Description,
		&ut.CreatedAt,
		&ut.UpdatedAt,
		&ut.CreatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user type not found")
		}
		return nil, fmt.Errorf("failed to get user type: %w", err)
	}

	// Get permissions
	permissions, _ := r.GetPermissions(ctx, id)
	ut.Permissions = permissions

	// Get user count
	userCount, _ := r.GetUserCount(ctx, id)
	ut.UserCount = userCount

	// Check wildcard
	hasWildcard, _ := r.hasWildcard(ctx, id)
	ut.HasWildcardPermission = hasWildcard

	return &ut, nil
}

// Create creates a new user type
func (r *UserTypeRepository) Create(ctx context.Context, typeName string, description *string, createdBy string) (*models.UserTypeResponse, error) {
	// Check if type name already exists
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM auth.user_types WHERE type_name = $1)`, typeName).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user type: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("user type already exists")
	}

	query := `
		INSERT INTO auth.user_types (type_name, description, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, type_name, description, created_at, updated_at, created_by
	`

	var ut models.UserTypeResponse
	err = r.db.QueryRow(ctx, query, typeName, description, createdBy).Scan(
		&ut.ID,
		&ut.TypeName,
		&ut.Description,
		&ut.CreatedAt,
		&ut.UpdatedAt,
		&ut.CreatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user type: %w", err)
	}

	ut.Permissions = []string{}
	ut.UserCount = 0
	ut.HasWildcardPermission = false

	return &ut, nil
}

// Update updates an existing user type
func (r *UserTypeRepository) Update(ctx context.Context, id uuid.UUID, typeName string, description *string) (*models.UserTypeResponse, error) {
	// Check if new type name conflicts with another type
	var conflictID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT id FROM auth.user_types WHERE type_name = $1 AND id != $2`, typeName, id).Scan(&conflictID)
	if err == nil {
		return nil, fmt.Errorf("user type already exists")
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to check existing user type: %w", err)
	}

	query := `
		UPDATE auth.user_types
		SET type_name = $1, description = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING id, type_name, description, created_at, updated_at, created_by
	`

	var ut models.UserTypeResponse
	err = r.db.QueryRow(ctx, query, typeName, description, id).Scan(
		&ut.ID,
		&ut.TypeName,
		&ut.Description,
		&ut.CreatedAt,
		&ut.UpdatedAt,
		&ut.CreatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user type not found")
		}
		return nil, fmt.Errorf("failed to update user type: %w", err)
	}

	// Get permissions
	permissions, _ := r.GetPermissions(ctx, id)
	ut.Permissions = permissions

	// Get user count
	userCount, _ := r.GetUserCount(ctx, id)
	ut.UserCount = userCount

	// Check wildcard
	hasWildcard, _ := r.hasWildcard(ctx, id)
	ut.HasWildcardPermission = hasWildcard

	return &ut, nil
}

// Delete deletes a user type if it has no assigned users
func (r *UserTypeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Check if has wildcard permission
	hasWildcard, err := r.hasWildcard(ctx, id)
	if err != nil {
		return err
	}
	if hasWildcard {
		return fmt.Errorf("cannot delete wildcard user type")
	}

	// Check if has assigned users
	userCount, err := r.GetUserCount(ctx, id)
	if err != nil {
		return err
	}
	if userCount > 0 {
		return fmt.Errorf("cannot delete user type with assigned users")
	}

	// Delete permissions first (cascade)
	_, err = r.db.Exec(ctx, `DELETE FROM auth.user_type_permissions WHERE user_type_id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete permissions: %w", err)
	}

	// Delete user type
	result, err := r.db.Exec(ctx, `DELETE FROM auth.user_types WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete user type: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("user type not found")
	}

	return nil
}

// GetPermissions returns all permissions for a user type
func (r *UserTypeRepository) GetPermissions(ctx context.Context, userTypeID uuid.UUID) ([]string, error) {
	query := `
		SELECT resource_path
		FROM auth.user_type_permissions
		WHERE user_type_id = $1
		ORDER BY resource_path
	`

	rows, err := r.db.Query(ctx, query, userTypeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions: %w", err)
	}
	defer rows.Close()

	permissions := []string{}
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permissions = append(permissions, path)
	}

	return permissions, nil
}

// UpdatePermissions replaces all permissions for a user type
func (r *UserTypeRepository) UpdatePermissions(ctx context.Context, userTypeID uuid.UUID, resourcePaths []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete existing permissions
	_, err = tx.Exec(ctx, `DELETE FROM auth.user_type_permissions WHERE user_type_id = $1`, userTypeID)
	if err != nil {
		return fmt.Errorf("failed to delete existing permissions: %w", err)
	}

	// Insert new permissions
	for _, path := range resourcePaths {
		_, err = tx.Exec(ctx, `
			INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
			VALUES ($1, $2)
		`, userTypeID, path)
		if err != nil {
			return fmt.Errorf("failed to insert permission %s: %w", path, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetUserCount returns the number of users assigned to a user type
func (r *UserTypeRepository) GetUserCount(ctx context.Context, userTypeID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM auth.users WHERE user_type_id = $1`

	var count int
	err := r.db.QueryRow(ctx, query, userTypeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get user count: %w", err)
	}

	return count, nil
}

// hasWildcard checks if user type has wildcard permission
func (r *UserTypeRepository) hasWildcard(ctx context.Context, userTypeID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM auth.user_type_permissions
			WHERE user_type_id = $1 AND resource_path = '*'
		)
	`

	var hasWildcard bool
	err := r.db.QueryRow(ctx, query, userTypeID).Scan(&hasWildcard)
	if err != nil {
		return false, fmt.Errorf("failed to check wildcard: %w", err)
	}

	return hasWildcard, nil
}

