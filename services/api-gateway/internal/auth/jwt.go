package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JWTClaims represents our custom JWT claims
type JWTClaims struct {
	UserID     uuid.UUID `json:"user_id"`
	Email      string    `json:"email"`
	UserTypeID uuid.UUID `json:"user_type_id"`
	UserType   string    `json:"user_type"`
	jwt.RegisteredClaims
}

// JWTService handles JWT token generation and validation
type JWTService struct {
	secretKey       []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

// NewJWTService creates a new JWT service
func NewJWTService(secretKey string, accessTokenHours, refreshTokenHours int) *JWTService {
	return &JWTService{
		secretKey:       []byte(secretKey),
		accessTokenTTL:  time.Duration(accessTokenHours) * time.Hour,
		refreshTokenTTL: time.Duration(refreshTokenHours) * time.Hour,
	}
}

// GenerateAccessToken generates an access token (short-lived)
func (j *JWTService) GenerateAccessToken(userID uuid.UUID, email string, userTypeID uuid.UUID, userType string) (string, error) {
	claims := JWTClaims{
		UserID:     userID,
		Email:      email,
		UserTypeID: userTypeID,
		UserType:   userType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(j.accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "warp-api-gateway",
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(j.secretKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signedToken, nil
}

// GenerateRefreshToken generates a refresh token (long-lived)
func (j *JWTService) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	claims := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(j.refreshTokenTTL)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "warp-api-gateway",
		Subject:   userID.String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(j.secretKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return signedToken, nil
}

// ValidateAccessToken validates an access token and returns claims
func (j *JWTService) ValidateAccessToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.secretKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("token is invalid")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("failed to parse claims")
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token
func (j *JWTService) ValidateRefreshToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.secretKey, nil
	})

	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to parse refresh token: %w", err)
	}

	if !token.Valid {
		return uuid.Nil, fmt.Errorf("refresh token is invalid")
	}

	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok {
		return uuid.Nil, fmt.Errorf("failed to parse refresh token claims")
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user ID in token: %w", err)
	}

	return userID, nil
}
