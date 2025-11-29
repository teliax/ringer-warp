package models

// AuthTokens represents access and refresh tokens
type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"` // "Bearer"
	ExpiresIn    int    `json:"expires_in"` // seconds
	Email        string `json:"email"`
	UserID       string `json:"user_id"`
	UserType     string `json:"user_type"`
}

// GoogleTokenExchangeRequest for /auth/exchange endpoint
// Simplified pattern matching ringer-soa
type GoogleTokenExchangeRequest struct {
	GoogleID string `json:"google_id" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name"`
}

// RefreshTokenRequest for /auth/refresh endpoint
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}
