package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/gatekeeper"
	"github.com/ringer-warp/api-gateway/internal/models"
	log "go.uber.org/zap"
)

// GatekeeperMiddleware enforces permission-based access control
type GatekeeperMiddleware struct {
	gatekeeper *gatekeeper.Gatekeeper
	logger     *log.Logger
}

// NewGatekeeperMiddleware creates a new gatekeeper middleware
func NewGatekeeperMiddleware(gk *gatekeeper.Gatekeeper, logger *log.Logger) *GatekeeperMiddleware {
	return &GatekeeperMiddleware{
		gatekeeper: gk,
		logger:     logger,
	}
}

// CheckPermission validates that the user has permission to access the requested resource
func (m *GatekeeperMiddleware) CheckPermission() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user context (set by JWT auth middleware)
		userIDStr, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, models.NewErrorResponse("UNAUTHORIZED", "User context not found"))
			c.Abort()
			return
		}

		userTypeIDUUID, exists := c.Get("user_type_id_uuid")
		if !exists {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("FORBIDDEN", "User type not found"))
			c.Abort()
			return
		}

		userIDUUID, exists := c.Get("user_id_uuid")
		if !exists {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("FORBIDDEN", "User ID not found"))
			c.Abort()
			return
		}

		// Get requested resource path
		resourcePath := c.Request.URL.Path

		// Check permission
		result, err := m.gatekeeper.CheckAccess(
			c.Request.Context(),
			userIDUUID.(uuid.UUID),
			userTypeIDUUID.(uuid.UUID),
			resourcePath,
		)

		if err != nil {
			m.logger.Error("Permission check failed",
				log.String("user_id", userIDStr.(string)),
				log.String("resource", resourcePath),
				log.Error(err),
			)
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("PERMISSION_CHECK_FAILED", "Failed to check permissions"))
			c.Abort()
			return
		}

		if !result.Allowed {
			m.logger.Info("Access denied",
				log.String("user_id", userIDStr.(string)),
				log.String("user_type", result.UserType),
				log.String("resource", resourcePath),
				log.String("reason", result.Reason),
			)

			c.JSON(http.StatusForbidden, models.NewErrorResponse(
				"FORBIDDEN",
				fmt.Sprintf("Insufficient permissions to access %s", resourcePath),
			))
			c.Abort()
			return
		}

		// Set permission context for downstream handlers
		c.Set("accessible_customer_ids", result.AccessibleCustomers)
		c.Set("has_wildcard", result.HasWildcard)
		c.Set("user_type_name", result.UserType)

		// Log successful access
		m.logger.Debug("Access granted",
			log.String("user_id", userIDStr.(string)),
			log.String("user_type", result.UserType),
			log.String("resource", resourcePath),
			log.Bool("has_wildcard", result.HasWildcard),
		)

		c.Next()
	}
}
