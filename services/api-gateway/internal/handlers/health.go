package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HealthCheck returns basic health status
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "warp-api-gateway",
		"version": "0.1.0",
	})
}

// ReadinessCheck checks if service is ready to accept traffic
func ReadinessCheck(c *gin.Context) {
	// TODO: Add checks for:
	// - Database connectivity
	// - Redis connectivity
	// - Jasmin connectivity

	c.JSON(http.StatusOK, gin.H{
		"status": "ready",
		"checks": gin.H{
			"database": "ok",
			"redis":    "ok",
			"jasmin":   "ok",
		},
	})
}
