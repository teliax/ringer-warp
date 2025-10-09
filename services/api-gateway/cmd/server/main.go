package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/database"
	"github.com/ringer-warp/api-gateway/internal/handlers"
	"github.com/ringer-warp/api-gateway/internal/middleware"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/services"
)

func main() {
	ctx := context.Background()

	// Initialize database connection (optional for now)
	db, err := database.NewPostgresPool(ctx)
	if err != nil {
		log.Printf("⚠️  WARNING: Failed to connect to database: %v", err)
		log.Println("⚠️  API will run without database persistence (Jasmin-only mode)")
		db = nil // Continue without database
	} else {
		defer db.Close()
		log.Println("✅ Connected to PostgreSQL database")
	}

	// Load configuration from environment
	jasminHost := os.Getenv("JASMIN_JCLI_HOST")
	if jasminHost == "" {
		jasminHost = "jasmin-http-service.messaging.svc.cluster.local"
	}

	jasminPort := 8990
	jasminPassword := os.Getenv("JASMIN_ADMIN_PASSWORD")
	if jasminPassword == "" {
		log.Println("WARNING: JASMIN_ADMIN_PASSWORD not set, using default")
		jasminPassword = "jcliadmin"
	}

	// Initialize dependencies
	vendorRepo := repository.NewVendorRepository(db)
	vendorService := services.NewVendorService(vendorRepo, jasminHost, jasminPort, jasminPassword)
	vendorHandler := handlers.NewVendorHandler(vendorService)

	// Set Gin mode
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Global middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS())

	// Health check endpoint
	router.GET("/health", handlers.HealthCheck)
	router.GET("/ready", handlers.ReadinessCheck)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Vendor management (Phase 1 - Priority)
		vendors := v1.Group("/admin/smpp-vendors")
		{
			vendors.POST("", vendorHandler.CreateSMPPVendor)
			vendors.GET("", vendorHandler.ListSMPPVendors)
			vendors.GET("/:id", vendorHandler.GetSMPPVendor)
			vendors.PUT("/:id", vendorHandler.UpdateSMPPVendor)
			vendors.DELETE("/:id", vendorHandler.DeleteSMPPVendor)
			vendors.POST("/:id/bind", vendorHandler.BindSMPPVendor)
			vendors.GET("/:id/status", vendorHandler.GetSMPPVendorStatus)
		}

		// Future endpoints (scaffolded)
		// campaigns := v1.Group("/admin/campaigns")
		// messages := v1.Group("/messages")
		// trunks := v1.Group("/trunks")
	}

	// Server configuration
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting API server on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped gracefully")
}
