package models

import (
	"time"

	"github.com/google/uuid"
)

// Invitation represents a user invitation
type Invitation struct {
	ID        uuid.UUID  `json:"id"`
	Token     uuid.UUID  `json:"token"`
	Email     string     `json:"email"`
	UserTypeID uuid.UUID `json:"user_type_id"`
	UserType  *UserType  `json:"user_type,omitempty"`

	CustomerID uuid.UUID  `json:"customer_id"`
	Customer   *Customer  `json:"customer,omitempty"`
	Role       string     `json:"role"` // USER, ADMIN, OWNER

	InvitedBy     uuid.UUID `json:"invited_by"`
	InvitedByUser *User     `json:"invited_by_user,omitempty"`
	Message       *string   `json:"message,omitempty"`
	ExpiresAt     time.Time `json:"expires_at"`

	Status       string     `json:"status"` // PENDING, ACCEPTED, EXPIRED, REVOKED
	SentAt       time.Time  `json:"sent_at"`
	AcceptedAt   *time.Time `json:"accepted_at,omitempty"`
	AcceptedByUserID *uuid.UUID `json:"accepted_by_user_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateInvitationRequest for creating a new invitation
type CreateInvitationRequest struct {
	Email    string  `json:"email" binding:"required,email"`
	UserType string  `json:"user_type" binding:"required"` // customer_admin, developer, billing, viewer
	Role     string  `json:"role" binding:"required,oneof=USER ADMIN OWNER"`
	Message  *string `json:"message"` // Optional custom message
}

// AcceptInvitationRequest for accepting an invitation
type AcceptInvitationRequest struct {
	GoogleID string `json:"google_id" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name" binding:"required"`
}

// InvitationResponse with embedded customer and user type details
type InvitationResponse struct {
	ID               uuid.UUID `json:"id"`
	Token            uuid.UUID `json:"token,omitempty"` // Omit token after creation for security
	Email            string    `json:"email"`
	UserType         string    `json:"user_type"`
	UserTypeDescription string `json:"user_type_description,omitempty"`

	Customer         struct {
		ID          uuid.UUID `json:"id"`
		BAN         string    `json:"ban"`
		CompanyName string    `json:"company_name"`
	} `json:"customer"`

	Role       string     `json:"role"`
	InvitedBy  struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"invited_by"`

	Message    *string    `json:"message,omitempty"`
	ExpiresAt  time.Time  `json:"expires_at"`
	Status     string     `json:"status"`
	SentAt     time.Time  `json:"sent_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
}

// AcceptInvitationResponse includes user account and customer access
type AcceptInvitationResponse struct {
	User struct {
		ID       uuid.UUID `json:"id"`
		Email    string    `json:"email"`
		Name     string    `json:"name"`
		UserType string    `json:"user_type"`
	} `json:"user"`

	CustomerAccess struct {
		CustomerID  uuid.UUID `json:"customer_id"`
		CompanyName string    `json:"company_name"`
		BAN         string    `json:"ban"`
		Role        string    `json:"role"`
	} `json:"customer_access"`

	Tokens AuthTokens `json:"tokens"`
}
