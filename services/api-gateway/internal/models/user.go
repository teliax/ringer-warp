package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a platform user
type User struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	GoogleID    string     `json:"google_id" db:"google_id"` // Google OAuth subject ID
	Email       string     `json:"email" db:"email"`
	DisplayName *string    `json:"display_name,omitempty" db:"display_name"`
	PhotoURL    *string    `json:"photo_url,omitempty" db:"photo_url"`
	UserTypeID  uuid.UUID  `json:"user_type_id" db:"user_type_id"`
	IsActive    bool       `json:"is_active" db:"is_active"`
	LastLogin   *time.Time `json:"last_login,omitempty" db:"last_login"`
	LoginCount  int        `json:"login_count" db:"login_count"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`

	// Relationships
	UserType       *UserType        `json:"user_type,omitempty" db:"-"`
	CustomerAccess []CustomerAccess `json:"customer_access,omitempty" db:"-"`
}

// UserPermissions represents complete user permission information
type UserPermissions struct {
	UserID             uuid.UUID        `json:"user_id"`
	Email              string           `json:"email"`
	UserType           string           `json:"user_type"`
	HasWildcard        bool             `json:"has_wildcard_permission"`
	Permissions        []string         `json:"permissions"`
	CustomerAccess     []CustomerAccess `json:"customer_access"`
	AccessibleCustomers []uuid.UUID     `json:"-"` // Internal use for filtering
}

// CustomerAccess represents user's access to a customer
type CustomerAccess struct {
	CustomerID   uuid.UUID `json:"customer_id" db:"customer_id"`
	CustomerName string    `json:"customer_name,omitempty" db:"customer_name"`
	BAN          string    `json:"ban,omitempty" db:"ban"`
	Role         string    `json:"role" db:"role"`
}

// CreateUserRequest for creating new users
type CreateUserRequest struct {
	Email       string     `json:"email" binding:"required,email"`
	DisplayName string     `json:"display_name"`
	UserTypeID  uuid.UUID  `json:"user_type_id" binding:"required"`
	CustomerIDs []uuid.UUID `json:"customer_ids,omitempty"` // Customers to grant access to
}

// UpdateUserRequest for updating users
type UpdateUserRequest struct {
	DisplayName *string    `json:"display_name,omitempty"`
	UserTypeID  *uuid.UUID `json:"user_type_id,omitempty"`
	IsActive    *bool      `json:"is_active,omitempty"`
}

// GatekeeperCheckRequest for permission checks
type GatekeeperCheckRequest struct {
	ResourcePath string `json:"resourcePath" binding:"required"`
}

// GatekeeperCheckResponse for permission check results
type GatekeeperCheckResponse struct {
	Allowed               bool        `json:"allowed"`
	UserType              string      `json:"userType,omitempty"`
	AccessibleCustomerIDs []uuid.UUID `json:"accessibleCustomerIds,omitempty"`
	HasWildcardPermission bool        `json:"hasWildcardPermission"`
	Reason                string      `json:"reason,omitempty"`
}

// GatekeeperBatchCheckRequest for checking multiple permissions
type GatekeeperBatchCheckRequest struct {
	ResourcePaths []string `json:"resourcePaths" binding:"required"`
}
