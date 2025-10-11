package gatekeeper

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PermissionRepository handles permission database queries
type PermissionRepository struct {
	db *pgxpool.Pool
}

// NewPermissionRepository creates a new permission repository
func NewPermissionRepository(db *pgxpool.Pool) *PermissionRepository {
	return &PermissionRepository{db: db}
}

// GetUserTypePermissions returns all resource paths a user type can access
func (r *PermissionRepository) GetUserTypePermissions(ctx context.Context, userTypeID uuid.UUID) ([]string, error) {
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

// CheckHasWildcardPermission checks if user type has '*' permission (SuperAdmin)
func (r *PermissionRepository) CheckHasWildcardPermission(ctx context.Context, userTypeID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM auth.user_type_permissions
			WHERE user_type_id = $1 AND resource_path = '*'
		)
	`

	var hasWildcard bool
	err := r.db.QueryRow(ctx, query, userTypeID).Scan(&hasWildcard)
	if err != nil {
		return false, fmt.Errorf("failed to check wildcard permission: %w", err)
	}

	return hasWildcard, nil
}

// GetUserAccessibleCustomers returns customer IDs user can access
// Returns nil (not empty slice) if user has wildcard permission (sees all customers)
func (r *PermissionRepository) GetUserAccessibleCustomers(ctx context.Context, userID uuid.UUID, userTypeID uuid.UUID) ([]uuid.UUID, error) {
	// First check if user has wildcard permission (SuperAdmin)
	hasWildcard, err := r.CheckHasWildcardPermission(ctx, userTypeID)
	if err != nil {
		return nil, err
	}

	if hasWildcard {
		return nil, nil // nil means "all customers"
	}

	// Get user's assigned customers
	query := `
		SELECT customer_id
		FROM auth.user_customer_access
		WHERE user_id = $1
		ORDER BY customer_id
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer access: %w", err)
	}
	defer rows.Close()

	customerIDs := []uuid.UUID{}
	for rows.Next() {
		var customerID uuid.UUID
		if err := rows.Scan(&customerID); err != nil {
			return nil, fmt.Errorf("failed to scan customer ID: %w", err)
		}
		customerIDs = append(customerIDs, customerID)
	}

	return customerIDs, nil
}

// GetUserTypeName returns the name of a user type
func (r *PermissionRepository) GetUserTypeName(ctx context.Context, userTypeID uuid.UUID) (string, error) {
	query := `SELECT type_name FROM auth.user_types WHERE id = $1`

	var typeName string
	err := r.db.QueryRow(ctx, query, userTypeID).Scan(&typeName)
	if err != nil {
		return "", fmt.Errorf("failed to get user type name: %w", err)
	}

	return typeName, nil
}

// GetAllPermissionMetadata returns all permission metadata for UI
func (r *PermissionRepository) GetAllPermissionMetadata(ctx context.Context) ([]PermissionMetadata, error) {
	query := `
		SELECT resource_path, category, display_name, description,
		       display_order, is_deprecated, requires_wildcard, icon
		FROM auth.permission_metadata
		ORDER BY category, display_order, resource_path
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get permission metadata: %w", err)
	}
	defer rows.Close()

	metadata := []PermissionMetadata{}
	for rows.Next() {
		var pm PermissionMetadata
		err := rows.Scan(
			&pm.ResourcePath,
			&pm.Category,
			&pm.DisplayName,
			&pm.Description,
			&pm.DisplayOrder,
			&pm.IsDeprecated,
			&pm.RequiresWildcard,
			&pm.Icon,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan metadata: %w", err)
		}
		metadata = append(metadata, pm)
	}

	return metadata, nil
}

// PermissionMetadata represents permission metadata for UI
type PermissionMetadata struct {
	ResourcePath     string  `json:"resource_path"`
	Category         *string `json:"category,omitempty"`
	DisplayName      *string `json:"display_name,omitempty"`
	Description      *string `json:"description,omitempty"`
	DisplayOrder     int     `json:"display_order"`
	IsDeprecated     bool    `json:"is_deprecated"`
	RequiresWildcard bool    `json:"requires_wildcard"`
	Icon             *string `json:"icon,omitempty"`
}
