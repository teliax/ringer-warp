package models

import (
	"time"

	"github.com/google/uuid"
)

// CustomerUser represents a user with access to a customer
type CustomerUser struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Email       string     `json:"email" db:"email"`
	DisplayName string     `json:"display_name" db:"display_name"`
	PhotoURL    *string    `json:"photo_url,omitempty" db:"photo_url"`
	UserType    string     `json:"user_type" db:"user_type"`
	IsActive    bool       `json:"is_active" db:"is_active"`
	Role        string     `json:"role" db:"role"`           // Role in relation to this customer (ADMIN, USER, VIEWER)
	GrantedAt   time.Time  `json:"granted_at" db:"granted_at"` // When access was granted
	GrantedBy   *string    `json:"granted_by,omitempty" db:"granted_by"`
	LastLogin   *time.Time `json:"last_login,omitempty" db:"last_login"`
}