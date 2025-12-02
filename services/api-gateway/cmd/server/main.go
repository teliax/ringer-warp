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
	"github.com/redis/go-redis/v9"
	"github.com/ringer-warp/api-gateway/internal/auth"
	"github.com/ringer-warp/api-gateway/internal/database"
	"github.com/ringer-warp/api-gateway/internal/email"
	"github.com/ringer-warp/api-gateway/internal/gatekeeper"
	"github.com/ringer-warp/api-gateway/internal/handlers"
	"github.com/ringer-warp/api-gateway/internal/hubspot"
	"github.com/ringer-warp/api-gateway/internal/invitation"
	"github.com/ringer-warp/api-gateway/internal/middleware"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/tcr"
	"github.com/ringer-warp/api-gateway/internal/tincomply"
	"github.com/ringer-warp/api-gateway/internal/trunk"
	"go.uber.org/zap"
)

func main() {
	ctx := context.Background()

	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	// Initialize database connection (REQUIRED for auth)
	db, err := database.NewPostgresPool(ctx)
	if err != nil {
		log.Fatalf("❌ FATAL: Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("✅ Connected to PostgreSQL database")

	// Initialize Redis connection (for Kamailio permissions sync)
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "redis-service.messaging.svc.cluster.local"
	}
	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
		DB:   0, // Use DB 0 for Kamailio permissions
	})

	// Test Redis connection
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("❌ FATAL: Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("✅ Connected to Redis")

	// Load auth configuration
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	if googleClientID == "" {
		log.Fatal("❌ FATAL: GOOGLE_CLIENT_ID environment variable not set")
	}
	
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("❌ FATAL: JWT_SECRET environment variable not set")
	}

	// Initialize auth components
	oauthVerifier := auth.NewGoogleOAuthVerifier(googleClientID)
	jwtService := auth.NewJWTService(jwtSecret, 24, 168) // 24h access, 7d refresh
	
	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	userTypeRepo := repository.NewUserTypeRepository(db)
	permRepo := gatekeeper.NewPermissionRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	hubspotSyncRepo := repository.NewHubSpotSyncRepository(db)
	invitationRepo := repository.NewInvitationRepository(db)
	trunkRepo := repository.NewTrunkRepository(db)

	// Initialize gatekeeper
	gk := gatekeeper.NewGatekeeper(permRepo, logger)

	// Initialize HubSpot client (optional - only if API key is set)
	hubspotAPIKey := os.Getenv("HUBSPOT_API_KEY")
	hubspotWebhookSecret := os.Getenv("HUBSPOT_WEBHOOK_SECRET")

	var hubspotSyncHandler *handlers.HubSpotSyncHandler
	var hubspotWebhookHandler *handlers.HubSpotWebhookHandler
	var fieldMapper *hubspot.FieldMapper

	if hubspotAPIKey != "" {
		hubspotClient := hubspot.NewClient(hubspotAPIKey, logger)
		syncService, err := hubspot.NewSyncService(hubspotClient, hubspotSyncRepo, customerRepo, logger)
		if err != nil {
			log.Printf("⚠️  Warning: Failed to initialize HubSpot sync service: %v", err)
		} else {
			hubspotSyncHandler = handlers.NewHubSpotSyncHandler(syncService, hubspotClient, customerRepo, logger)

			// Get field mapper from sync service for webhook processor
			config, _ := hubspotSyncRepo.GetSyncConfig(ctx)
			if config != nil {
				fieldMapper = hubspot.NewFieldMapper(config)
			}

			log.Println("✅ HubSpot sync service initialized")
		}

		// Initialize webhook handler if webhook secret is set
		if hubspotWebhookSecret != "" && fieldMapper != nil {
			webhookProcessor := hubspot.NewWebhookProcessor(syncService, hubspotSyncRepo, customerRepo, fieldMapper, logger)
			hubspotWebhookHandler = handlers.NewHubSpotWebhookHandler(hubspotWebhookSecret, webhookProcessor, hubspotSyncRepo, logger)
			log.Println("✅ HubSpot webhook handler initialized")
		} else {
			log.Println("⚠️  HubSpot webhook handler disabled (HUBSPOT_WEBHOOK_SECRET not set)")
		}
	} else {
		log.Println("⚠️  HubSpot sync disabled (HUBSPOT_API_KEY not set)")
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(oauthVerifier, jwtService, userRepo, logger)
	gatekeeperHandler := handlers.NewGatekeeperHandler(gk, userRepo)
	userTypeHandler := handlers.NewUserTypeHandler(userTypeRepo, userRepo)
	dashboardHandler := handlers.NewDashboardHandler(db) // Pass db pool for customer scoping
	smppProxyHandler := handlers.NewSMPPProxyHandler()

	// Initialize customer handler with optional sync service
	var syncServiceForHandler *hubspot.SyncService
	if hubspotSyncHandler != nil {
		// Reinitialize sync service to pass to customer handler
		hubspotClient := hubspot.NewClient(hubspotAPIKey, logger)
		syncServiceForHandler, _ = hubspot.NewSyncService(hubspotClient, hubspotSyncRepo, customerRepo, logger)

		// Start background queue processor
		go func() {
			ticker := time.NewTicker(1 * time.Minute)
			defer ticker.Stop()

			log.Println("✅ HubSpot sync queue processor started (runs every 1 minute)")

			for range ticker.C {
				if err := syncServiceForHandler.ProcessSyncQueue(context.Background(), 10); err != nil {
					log.Printf("⚠️  Queue processing error: %v", err)
				}
			}
		}()
	}

	// Initialize invitation system BEFORE customer handler (needed for auto-assignment)
	sendGridAPIKey := os.Getenv("SENDGRID_API_KEY") // Optional - will log if not set
	emailService := invitation.NewEmailService(
		"noreply@ringer.tel",         // from email
		"WARP Platform",              // from name
		"https://admin.rns.ringer.tel", // base URL for invitation links
		sendGridAPIKey,
		logger,
	)
	invitationService := invitation.NewService(invitationRepo, userRepo, emailService, jwtService, logger)

	// Now create customer handler with invitation service
	customerHandler := handlers.NewCustomerHandler(customerRepo, syncServiceForHandler, invitationService, userRepo, logger)

	// Create invitation handler
	invitationHandler := handlers.NewInvitationHandler(invitationService, invitationRepo, customerRepo, logger)

	log.Println("✅ Invitation system initialized")

	// Initialize trunk management system
	trunkService := trunk.NewService(trunkRepo, customerRepo, redisClient)
	trunkHandler := handlers.NewTrunkHandler(trunkService, customerRepo)

	log.Println("✅ Trunk management system initialized")

	// Initialize centralized email service for TCR notifications
	tcrEmailService, err := email.NewService(email.Config{
		FromEmail:      "noreply@ringer.tel",
		FromName:       "WARP Platform",
		DashboardURL:   "https://admin.rns.ringer.tel",
		SendGridAPIKey: sendGridAPIKey, // Already loaded above for invitations
	}, logger)
	if err != nil {
		log.Fatalf("Failed to initialize email service: %v", err)
	}
	log.Println("✅ Email service initialized for TCR notifications")

	// Initialize TCR (The Campaign Registry) client for 10DLC compliance
	tcrAPIKey := os.Getenv("TCR_API_KEY")
	tcrAPISecret := os.Getenv("TCR_API_SECRET")
	tcrSandbox := os.Getenv("TCR_SANDBOX") == "true"

	var tcrBrandHandler *handlers.TCRBrandHandler
	var tcrCampaignHandler *handlers.TCRCampaignHandler
	var tcrEnumHandler *handlers.TCREnumerationHandler
	var tcrWebhookHandler *handlers.TCRWebhookHandler

	if tcrAPIKey != "" && tcrAPISecret != "" {
		tcrClient := tcr.NewClient(tcr.Config{
			APIKey:    tcrAPIKey,
			APISecret: tcrAPISecret,
			Sandbox:   tcrSandbox,
		})

		// Initialize TCR repositories
		tcrBrandRepo := repository.NewTCRBrandRepository(db)
		tcrCampaignRepo := repository.NewTCRCampaignRepository(db)
		tcrWebhookRepo := repository.NewTCRWebhookEventRepository(db)

		// Initialize TCR webhook processor with email service
		tcrWebhookProcessor := tcr.NewWebhookProcessor(db, tcrEmailService, logger)

		// Initialize TCR webhook handler
		tcrWebhookHandler = handlers.NewTCRWebhookHandler(tcrWebhookRepo, tcrWebhookProcessor, logger)

		// Initialize TCR handlers
		tcrBrandHandler = handlers.NewTCRBrandHandler(tcrBrandRepo, tcrClient, logger)
		tcrCampaignHandler = handlers.NewTCRCampaignHandler(tcrCampaignRepo, tcrBrandRepo, tcrClient, logger)
		tcrEnumHandler = handlers.NewTCREnumerationHandler(tcrClient, logger)

		// Initialize TCR webhook subscription manager
		webhookManager := tcr.NewWebhookSubscriptionManager(tcrClient, logger)

		// Subscribe to TCR webhooks on startup
		webhookBaseURL := os.Getenv("WEBHOOK_BASE_URL")
		if webhookBaseURL == "" {
			webhookBaseURL = "https://api.rns.ringer.tel" // Default production URL
		}

		go func() {
			// Wait 5 seconds for server to be ready
			time.Sleep(5 * time.Second)

			if err := webhookManager.SubscribeAllEvents(context.Background(), webhookBaseURL); err != nil {
				logger.Error("Failed to subscribe to TCR webhooks",
					zap.Error(err),
				)
			} else {
				logger.Info("✅ Subscribed to all TCR webhooks",
					zap.String("base_url", webhookBaseURL),
				)
			}
		}()

		if tcrSandbox {
			log.Println("✅ TCR client initialized (SANDBOX MODE)")
		} else {
			log.Println("✅ TCR client initialized (PRODUCTION)")
		}
	} else {
		log.Println("⚠️  TCR client disabled (TCR_API_KEY or TCR_API_SECRET not set)")
	}

	// Initialize TinComply client for EIN/Tax ID verification
	tincomplyAPIKey := os.Getenv("TINCOMPLY_API_KEY")

	var tincomplyHandler *handlers.TinComplyHandler

	if tincomplyAPIKey != "" {
		tincomplyClient := tincomply.NewClient(tincomply.Config{
			APIKey: tincomplyAPIKey,
		})

		tincomplyHandler = handlers.NewTinComplyHandler(tincomplyClient, logger)
		log.Println("✅ TinComply client initialized")
	} else {
		log.Println("⚠️  TinComply client disabled (TINCOMPLY_API_KEY not set)")
	}

	// Initialize JWT and Gatekeeper middleware
	jwtMiddleware := middleware.NewJWTAuthMiddleware(jwtService)
	gatekeeperMiddleware := middleware.NewGatekeeperMiddleware(gk, logger)

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

	// Health check endpoints (public, no auth)
	router.GET("/health", handlers.HealthCheck)
	router.GET("/ready", handlers.ReadinessCheck)

	// Auth endpoints (public, no auth required)
	authGroup := router.Group("/auth")
	{
		authGroup.POST("/exchange", authHandler.ExchangeGoogleToken)
		authGroup.POST("/refresh", authHandler.RefreshToken)
		authGroup.GET("/validate", jwtMiddleware.Authenticate(), authHandler.ValidateToken)
	}

	// Webhook endpoints (public, no auth - signature validated in handler)
	webhooks := router.Group("/webhooks")
	{
		// HubSpot webhooks (if enabled)
		if hubspotWebhookHandler != nil {
			webhooks.POST("/hubspot/company", hubspotWebhookHandler.HandleCompanyWebhook)
		}

		// TCR webhooks (if enabled)
		if tcrWebhookHandler != nil {
			webhooks.POST("/tcr/brands", tcrWebhookHandler.HandleBrandWebhook)
			webhooks.POST("/tcr/campaigns", tcrWebhookHandler.HandleCampaignWebhook)
			webhooks.POST("/tcr/vetting", tcrWebhookHandler.HandleVettingWebhook)
		}
	}

	// Invitation endpoints (public, no auth - token is the security)
	invitations := router.Group("/invitations")
	{
		invitations.GET("/:token", invitationHandler.GetInvitation)
		invitations.POST("/:token/accept", invitationHandler.AcceptInvitation)
	}

	// API v1 routes (protected with JWT + Gatekeeper)
	v1 := router.Group("/v1")
	v1.Use(jwtMiddleware.Authenticate())         // Validate JWT token
	v1.Use(gatekeeperMiddleware.CheckPermission()) // Check permissions
	{
		// Gatekeeper endpoints (for frontend permission checks)
		gatekeeper := v1.Group("/gatekeeper")
		{
			gatekeeper.POST("/check-access", gatekeeperHandler.CheckAccess)
			gatekeeper.GET("/my-permissions", gatekeeperHandler.GetMyPermissions)
			gatekeeper.POST("/check-access-batch", gatekeeperHandler.CheckAccessBatch)
			gatekeeper.GET("/available-permissions", gatekeeperHandler.GetAvailablePermissions)
		}

		// Dashboard endpoints
		dashboard := v1.Group("/dashboard")
		{
			dashboard.GET("/stats", dashboardHandler.GetStats)
			dashboard.GET("/me", dashboardHandler.GetCurrentUser)
		}

		// SMPP Vendor Management (proxied to smpp-gateway)
		smpp := v1.Group("/smpp")
		{
			smpp.GET("/vendors", smppProxyHandler.ListVendors)
			smpp.POST("/vendors/:id/reconnect", smppProxyHandler.ReconnectVendor)
			smpp.POST("/vendors/:id/disconnect", smppProxyHandler.DisconnectVendor)
			smpp.GET("/stats", smppProxyHandler.GetStats)
		}

		// Customer Management
		customers := v1.Group("/customers")
		{
			customers.GET("", customerHandler.ListCustomers)
			customers.POST("", customerHandler.CreateCustomer)
			customers.GET("/:id", customerHandler.GetCustomer)
			customers.PUT("/:id", customerHandler.UpdateCustomer)
			customers.GET("/by-ban/:ban", customerHandler.GetCustomerByBAN)
			customers.GET("/:id/trunks", customerHandler.GetCustomerTrunks)
			customers.GET("/:id/dids", customerHandler.GetCustomerDIDs)

			// User Management
			customers.GET("/:id/users", customerHandler.GetCustomerUsers)
			customers.DELETE("/:id/users/:userId", customerHandler.RemoveCustomerUser)
			customers.PUT("/:id/users/:userId/role", customerHandler.UpdateCustomerUserRole)
		}

		// Admin Invitation Management (protected)
		admin := v1.Group("/admin")
		{
			admin.POST("/customers/:customerId/invitations", invitationHandler.CreateInvitation)
			admin.GET("/invitations", invitationHandler.ListInvitations)
			admin.DELETE("/invitations/:id", invitationHandler.RevokeInvitation)
			admin.POST("/invitations/:id/resend", invitationHandler.ResendInvitation)

			// User Type Management
			admin.GET("/user-types", userTypeHandler.ListUserTypes)
			admin.GET("/user-types/:id", userTypeHandler.GetUserType)
			admin.POST("/user-types", userTypeHandler.CreateUserType)
			admin.PUT("/user-types/:id", userTypeHandler.UpdateUserType)
			admin.DELETE("/user-types/:id", userTypeHandler.DeleteUserType)
			admin.GET("/user-types/:id/permissions", userTypeHandler.GetUserTypePermissions)
			admin.PUT("/user-types/:id/permissions", userTypeHandler.UpdateUserTypePermissions)
			admin.GET("/user-types/:id/users", userTypeHandler.GetUsersByType)

			// Trunk Management (admin-scoped by customer ID or BAN)
			admin.POST("/customers/:customerId/trunks", trunkHandler.CreateTrunkGroup)
			admin.GET("/customers/:customerId/trunks", trunkHandler.ListTrunkGroups)
			admin.GET("/customers/:customerId/trunks/:trunk_id", trunkHandler.GetTrunkGroup)
			admin.PUT("/customers/:customerId/trunks/:trunk_id", trunkHandler.UpdateTrunkGroup)
			admin.DELETE("/customers/:customerId/trunks/:trunk_id", trunkHandler.DeleteTrunkGroup)

			// Trunk IP Management (admin-scoped)
			admin.POST("/customers/:customerId/trunks/:trunk_id/ips", trunkHandler.AddTrunkIP)
			admin.GET("/customers/:customerId/trunks/:trunk_id/ips", trunkHandler.ListTrunkIPs)
			admin.PUT("/customers/:customerId/trunks/:trunk_id/ips/:ip_id", trunkHandler.UpdateTrunkIP)
			admin.DELETE("/customers/:customerId/trunks/:trunk_id/ips/:ip_id", trunkHandler.DeleteTrunkIP)

			// Utility endpoints
			admin.POST("/trunks/sync-redis", trunkHandler.SyncAllTrunkIPs)
		}

		// HubSpot Sync (if enabled)
		if hubspotSyncHandler != nil {
			sync := v1.Group("/sync")
			{
				sync.POST("/customers/:id/to-hubspot", hubspotSyncHandler.SyncCustomerToHubSpot)
				sync.POST("/customers/:id/queue", hubspotSyncHandler.QueueCustomerSync)
				sync.POST("/process-queue", hubspotSyncHandler.ProcessSyncQueue)
				sync.GET("/hubspot/companies/search", hubspotSyncHandler.SearchHubSpotCompanies)
				sync.GET("/hubspot/companies/:id/contacts", hubspotSyncHandler.GetCompanyContacts)
			}
		}

		// Customer-scoped Trunk Management (self-service)
		customerTrunks := v1.Group("/customers/trunks")
		{
			customerTrunks.GET("", trunkHandler.CustomerListTrunks)
			customerTrunks.POST("", trunkHandler.CustomerCreateTrunk)
			customerTrunks.GET("/:trunk_id", trunkHandler.CustomerGetTrunk)
			customerTrunks.POST("/:trunk_id/ips", trunkHandler.CustomerAddTrunkIP)
			customerTrunks.DELETE("/:trunk_id/ips/:ip_id", trunkHandler.CustomerDeleteTrunkIP)
		}

		// Network Information (public utility endpoints for customer configuration)
		network := v1.Group("/network")
		{
			network.GET("/vendor-ips", trunkHandler.GetVendorOriginationIPs)
			network.GET("/ingress-ips", trunkHandler.GetCustomerIngressIPs)
		}

		// TCR (The Campaign Registry) 10DLC Management (if enabled)
		if tcrBrandHandler != nil && tcrCampaignHandler != nil && tcrEnumHandler != nil {
			messaging := v1.Group("/messaging")
			{
				// Brand Management
				messaging.GET("/brands", tcrBrandHandler.ListBrands)
				messaging.POST("/brands", tcrBrandHandler.CreateBrand)
				messaging.GET("/brands/:id", tcrBrandHandler.GetBrand)
				messaging.PATCH("/brands/:id", tcrBrandHandler.UpdateBrand)
				messaging.POST("/brands/:id/vetting", tcrBrandHandler.RequestVetting)
				messaging.GET("/brands/:id/vetting", tcrBrandHandler.GetVettingStatus)

				// Campaign Management
				messaging.GET("/campaigns", tcrCampaignHandler.ListCampaigns)
				messaging.POST("/campaigns", tcrCampaignHandler.CreateCampaign)
				messaging.GET("/campaigns/:id", tcrCampaignHandler.GetCampaign)
				messaging.GET("/campaigns/:id/mno-status", tcrCampaignHandler.GetMNOStatus)
				messaging.POST("/campaigns/:id/numbers", tcrCampaignHandler.AssignPhoneNumbers)
				messaging.DELETE("/campaigns/:id/numbers", tcrCampaignHandler.RemovePhoneNumbers)
				messaging.GET("/campaigns/:id/numbers", tcrCampaignHandler.GetCampaignNumbers)

				// Enumeration/Helper Endpoints
				messaging.GET("/use-cases", tcrEnumHandler.GetUseCases)
				messaging.GET("/entity-types", tcrEnumHandler.GetEntityTypes)
				messaging.GET("/verticals", tcrEnumHandler.GetVerticals)
				messaging.GET("/carriers", tcrEnumHandler.GetCarriers)
				messaging.GET("/use-case-requirements", tcrEnumHandler.GetUseCaseRequirements)
				messaging.GET("/throughput-estimate", tcrEnumHandler.GetThroughputEstimate)
			}
		}

		// TinComply EIN/Tax ID Verification (if enabled)
		if tincomplyHandler != nil {
			tincomply := v1.Group("/tincomply")
			{
				tincomply.GET("/lookup-ein", tincomplyHandler.LookupEIN)
				tincomply.POST("/verify-tin-name", tincomplyHandler.VerifyTINName)
				tincomply.POST("/lookup-company-details", tincomplyHandler.LookupCompanyDetails)
				tincomply.GET("/validate-ein-format", tincomplyHandler.ValidateEINFormat)
			}
		}
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
