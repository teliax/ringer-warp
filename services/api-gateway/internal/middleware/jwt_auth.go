package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/auth"
	"github.com/ringer-warp/api-gateway/internal/models"
)

// JWTAuthMiddleware validates our custom JWT tokens
type JWTAuthMiddleware struct {
	jwtService *auth.JWTService
}

// NewJWTAuthMiddleware creates a new JWT authentication middleware
func NewJWTAuthMiddleware(jwtService *auth.JWTService) *JWTAuthMiddleware {
	return &JWTAuthMiddleware{
		jwtService: jwtService,
	}
}

// Authenticate validates JWT token and sets user context
func (m *JWTAuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.NewErrorResponse("UNAUTHORIZED", "Authorization header required"))
			c.Abort()
			return
		}

		// Extract Bearer token
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.NewErrorResponse("INVALID_TOKEN", "Invalid authorization format. Expected: Bearer {token}"))
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate JWT token
		claims, err := m.jwtService.ValidateAccessToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.NewErrorResponse("INVALID_TOKEN", "Invalid or expired token"))
			c.Abort()
			return
		}

		// Set user context for downstream handlers and middleware
		c.Set("user_id", claims.UserID.String())
		c.Set("user_id_uuid", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("user_type_id", claims.UserTypeID.String())
		c.Set("user_type_id_uuid", claims.UserTypeID)
		c.Set("user_type", claims.UserType)

		c.Next()
	}
}

// OptionalAuth is like Authenticate but doesn't require a token
// Useful for endpoints that can work with or without authentication
func (m *JWTAuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// No token provided, continue without user context
			c.Next()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			tokenString := parts[1]

			// Try to validate token
			claims, err := m.jwtService.ValidateAccessToken(tokenString)
			if err == nil {
				// Valid token - set user context
				c.Set("user_id", claims.UserID.String())
				c.Set("user_id_uuid", claims.UserID)
				c.Set("email", claims.Email)
				c.Set("user_type_id", claims.UserTypeID.String())
				c.Set("user_type_id_uuid", claims.UserTypeID)
				c.Set("user_type", claims.UserType)
			}
		}

		c.Next()
	}
}
