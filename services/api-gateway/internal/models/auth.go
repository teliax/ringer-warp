package models

// AuthTokens represents access and refresh tokens
type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"` // "Bearer"
	ExpiresIn    int    `json:"expires_in"` // seconds
}

// GoogleTokenExchangeRequest for /auth/exchange endpoint
type GoogleTokenExchangeRequest struct {
	IDToken string `json:"id_token" binding:"required"` // Google ID token
}

// RefreshTokenRequest for /auth/refresh endpoint
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}
