package models

import (
	"time"

	"github.com/google/uuid"
)

// UserType represents a user role/type in the system
type UserType struct {
	ID          uuid.UUID  `json:"id"`
	TypeName    string     `json:"type_name"`
	Description *string    `json:"description,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
	CreatedBy   *string    `json:"created_by,omitempty"`
}

// UserTypeResponse includes additional computed fields for API responses
type UserTypeResponse struct {
	ID                    uuid.UUID  `json:"id"`
	TypeName              string     `json:"type_name"`
	Description           *string    `json:"description,omitempty"`
	Permissions           []string   `json:"permissions"`
	UserCount             int        `json:"user_count"`
	HasWildcardPermission bool       `json:"has_wildcard_permission"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             *time.Time `json:"updated_at,omitempty"`
	CreatedBy             *string    `json:"created_by,omitempty"`
}

// CreateUserTypeRequest is the request body for creating a user type
type CreateUserTypeRequest struct {
	TypeName    string  `json:"type_name" binding:"required,min=2,max=50,alphanum_underscore"`
	Description *string `json:"description,omitempty"`
}

// UpdatePermissionsRequest is the request body for updating user type permissions
type UpdatePermissionsRequest struct {
	ResourcePaths []string `json:"resource_paths" binding:"required"`
}
