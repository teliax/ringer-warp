package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/tcr"
	"go.uber.org/zap"
)

type TCRBrandHandler struct {
	brandRepo *repository.TCRBrandRepository
	tcrClient *tcr.Client
	logger    *zap.Logger
}

func NewTCRBrandHandler(
	brandRepo *repository.TCRBrandRepository,
	tcrClient *tcr.Client,
	logger *zap.Logger,
) *TCRBrandHandler {
	return &TCRBrandHandler{
		brandRepo: brandRepo,
		tcrClient: tcrClient,
		logger:    logger,
	}
}

// ListBrands godoc
// @Summary List 10DLC brands
// @Description Get list of registered 10DLC brands for accessible customers
// @Tags TCR/Brands
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} models.APIResponse{data=models.ListResponse}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/brands [get]
func (h *TCRBrandHandler) ListBrands(c *gin.Context) {
	// Extract customer scoping from gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Query brands
	brands, total, err := h.brandRepo.List(c.Request.Context(), customerFilter, page, perPage)
	if err != nil {
		h.logger.Error("Failed to list brands", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Failed to retrieve brands"))
		return
	}

	c.JSON(http.StatusOK, models.NewListResponse(brands, page, perPage, int(total)))
}

// GetBrand godoc
// @Summary Get brand by ID
// @Description Get detailed information about a specific 10DLC brand
// @Tags TCR/Brands
// @Accept json
// @Produce json
// @Param id path string true "Brand ID (UUID)"
// @Success 200 {object} models.APIResponse{data=models.Brand10DLC}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/brands/{id} [get]
func (h *TCRBrandHandler) GetBrand(c *gin.Context) {
	// Parse ID
	brandID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid brand ID format"))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Get brand
	brand, err := h.brandRepo.GetByID(c.Request.Context(), brandID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this brand"))
			return
		}
		h.logger.Error("Failed to get brand", zap.Error(err), zap.String("brand_id", brandID.String()))
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Brand not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(brand))
}

// CreateBrand godoc
// @Summary Register new 10DLC brand
// @Description Register a new brand with The Campaign Registry
// @Tags TCR/Brands
// @Accept json
// @Produce json
// @Param brand body models.CreateBrandRequest true "Brand registration info"
// @Success 201 {object} models.APIResponse{data=models.Brand10DLC}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/brands [post]
func (h *TCRBrandHandler) CreateBrand(c *gin.Context) {
	var req models.CreateBrandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get customer ID from X-Customer-ID header (for SuperAdmin) or accessible customers
	var customerID uuid.UUID
	var customerFilter []uuid.UUID

	// Check if user has wildcard permission (SuperAdmin)
	hasWildcard, _ := c.Get("has_wildcard")
	if hasWildcard.(bool) {
		// SuperAdmin: Read customer ID from X-Customer-ID header
		customerIDHeader := c.GetHeader("X-Customer-ID")
		if customerIDHeader == "" {
			c.JSON(http.StatusBadRequest, models.NewErrorResponse("CUSTOMER_ID_REQUIRED", "X-Customer-ID header required for SuperAdmin"))
			return
		}

		var err error
		customerID, err = uuid.Parse(customerIDHeader)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_CUSTOMER_ID", "Invalid X-Customer-ID format"))
			return
		}

		// SuperAdmin has access to all customers (nil filter)
		customerFilter = nil
	} else {
		// Regular user: Use accessible customers from gatekeeper
		if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
			customerFilter = accessibleCustomers.([]uuid.UUID)
			if len(customerFilter) == 0 {
				c.JSON(http.StatusForbidden, models.NewErrorResponse("NO_CUSTOMER_ACCESS", "No customer access configured"))
				return
			}
			// Use first accessible customer
			customerID = customerFilter[0]
		} else {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("NO_CUSTOMER_ACCESS", "Customer access not found"))
			return
		}
	}

	// Get user ID for audit
	userIDUUID, exists := c.Get("user_id_uuid")
	if !exists {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("INTERNAL_ERROR", "User ID not found in context"))
		return
	}
	createdBy := userIDUUID.(uuid.UUID)

	// Step 1: Create brand in local database first (status: PENDING)
	brand, err := h.brandRepo.Create(c.Request.Context(), &req, customerID, createdBy)
	if err != nil {
		h.logger.Error("Failed to create brand in database", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", "Failed to create brand"))
		return
	}

	h.logger.Info("Brand created in database, submitting to TCR",
		zap.String("brand_id", brand.ID.String()),
		zap.String("customer_id", customerID.String()),
	)

	// Step 2: Submit to TCR API (async - don't block response)
	go func() {
		// Use background context (request context gets cancelled after response sent)
		ctx := context.Background()

		// Build TCR request
		tcrReq := tcr.BrandRequest{
			BrandRelationship: "DIRECT_CUSTOMER",
			Country:           req.Country,
			DisplayName:       req.DisplayName,
			Email:             req.Email,
			EntityType:        req.EntityType,
			Phone:             req.Phone,
			CompanyName:       strOrEmpty(req.CompanyName),
			EIN:               strOrEmpty(req.TaxID),
			EINIssuingCountry: "US",
			Website:           strOrEmpty(req.Website),
			Vertical:          strOrEmpty(req.Vertical),
			Street:            strOrEmpty(req.Street),
			City:              strOrEmpty(req.City),
			State:             strOrEmpty(req.State),
			PostalCode:        strOrEmpty(req.PostalCode),
			StockExchange:     strOrEmpty(req.StockExchange),
			StockSymbol:       strOrEmpty(req.StockSymbol),
			AltBusinessID:     strOrEmpty(req.AltBusinessID),
			AltBusinessIDType: strOrEmpty(req.AltBusinessIDType),
			ReferenceID:       brand.ID.String(), // Use our UUID as reference
		}

		// Submit to TCR
		tcrBrand, err := h.tcrClient.CreateBrand(ctx, tcrReq)
		if err != nil {
			h.logger.Error("Failed to submit brand to TCR",
				zap.Error(err),
				zap.String("brand_id", brand.ID.String()),
			)
			// Update status to FAILED in database
			_ = h.brandRepo.UpdateTCRInfo(ctx, brand.ID, "", "FAILED", nil, "")
			return
		}

		// Update database with TCR response
		h.logger.Info("Brand registered with TCR successfully",
			zap.String("brand_id", brand.ID.String()),
			zap.String("tcr_brand_id", tcrBrand.BrandID),
			zap.Int("trust_score", tcrBrand.TrustScore),
		)

		status := "REGISTERED"
		if tcrBrand.IdentityStatus != "" {
			status = tcrBrand.IdentityStatus
		}

		err = h.brandRepo.UpdateTCRInfo(
			ctx,
			brand.ID,
			tcrBrand.BrandID,
			status,
			&tcrBrand.TrustScore,
			tcrBrand.IdentityStatus,
		)
		if err != nil {
			h.logger.Error("Failed to update brand with TCR info",
				zap.Error(err),
				zap.String("brand_id", brand.ID.String()),
			)
		}
	}()

	// Return immediate response (brand will be updated async)
	c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
		"brand":   brand,
		"message": "Brand submitted to TCR for registration. Status will be updated once processed.",
	}))
}

// UpdateBrand godoc
// @Summary Update brand information
// @Description Update brand details (only non-TCR fields can be updated)
// @Tags TCR/Brands
// @Accept json
// @Produce json
// @Param id path string true "Brand ID (UUID)"
// @Param brand body models.UpdateBrandRequest true "Brand update info"
// @Success 200 {object} models.APIResponse{data=models.Brand10DLC}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/brands/{id} [patch]
func (h *TCRBrandHandler) UpdateBrand(c *gin.Context) {
	// Parse ID
	brandID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid brand ID format"))
		return
	}

	var req models.UpdateBrandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify brand exists and user has access
	brand, err := h.brandRepo.GetByID(c.Request.Context(), brandID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this brand"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Brand not found"))
		return
	}

	// Get user ID for audit
	userID, _ := c.Get("user_id")
	updatedBy := userID.(uuid.UUID)

	// Update brand
	err = h.brandRepo.Update(c.Request.Context(), brandID, &req, updatedBy)
	if err != nil {
		h.logger.Error("Failed to update brand", zap.Error(err), zap.String("brand_id", brandID.String()))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_FAILED", "Failed to update brand"))
		return
	}

	// Get updated brand
	updatedBrand, err := h.brandRepo.GetByID(c.Request.Context(), brandID, customerFilter)
	if err != nil {
		h.logger.Error("Failed to get updated brand", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Brand updated but failed to retrieve"))
		return
	}

	// If brand is already registered with TCR, sync changes
	if brand.TCRBrandID != nil {
		go func() {
			// Use background context (request context gets cancelled after response sent)
			ctx := context.Background()

			// Build update map
			updates := make(map[string]interface{})
			if req.DisplayName != nil {
				updates["displayName"] = *req.DisplayName
			}
			if req.Website != nil {
				updates["website"] = *req.Website
			}
			// Add other updatable fields...

			if len(updates) > 0 {
				_, err := h.tcrClient.UpdateBrand(ctx, *brand.TCRBrandID, updates)
				if err != nil {
					h.logger.Error("Failed to sync brand update to TCR",
						zap.Error(err),
						zap.String("tcr_brand_id", *brand.TCRBrandID),
					)
				}
			}
		}()
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(updatedBrand))
}

// RequestVetting godoc
// @Summary Request external vetting for brand
// @Description Submit brand for third-party vetting to increase trust score
// @Tags TCR/Brands
// @Accept json
// @Produce json
// @Param id path string true "Brand ID (UUID)"
// @Param vetting body models.RequestVettingRequest true "Vetting request"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/brands/{id}/vetting [post]
func (h *TCRBrandHandler) RequestVetting(c *gin.Context) {
	// Parse ID
	brandID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid brand ID format"))
		return
	}

	var req models.RequestVettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify brand exists and user has access
	brand, err := h.brandRepo.GetByID(c.Request.Context(), brandID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this brand"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Brand not found"))
		return
	}

	// Check if brand is registered with TCR
	if brand.TCRBrandID == nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("NOT_REGISTERED", "Brand must be registered with TCR before requesting vetting"))
		return
	}

	// Update local status first
	err = h.brandRepo.UpdateVettingInfo(c.Request.Context(), brandID, req.Provider, req.VettingClass, "PENDING")
	if err != nil {
		h.logger.Error("Failed to update vetting status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_FAILED", "Failed to update vetting status"))
		return
	}

	// Submit vetting request to TCR (async)
	go func() {
		// Use background context (request context gets cancelled after response sent)
		ctx := context.Background()

		tcrReq := tcr.VettingRequest{
			EVPID:        req.Provider,
			VettingClass: req.VettingClass,
			VettingToken: "", // Would need to be obtained from vetting provider first
		}

		err := h.tcrClient.RequestExternalVetting(ctx, *brand.TCRBrandID, tcrReq)
		if err != nil {
			h.logger.Error("Failed to request vetting from TCR",
				zap.Error(err),
				zap.String("tcr_brand_id", *brand.TCRBrandID),
			)
			// Update status to failed
			_ = h.brandRepo.UpdateVettingInfo(ctx, brandID, req.Provider, req.VettingClass, "FAILED")
			return
		}

		h.logger.Info("Vetting request submitted to TCR",
			zap.String("brand_id", brandID.String()),
			zap.String("provider", req.Provider),
		)
	}()

	estimatedCost := tcr.EstimateVettingCost(req.VettingClass)

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message":        "Vetting request submitted. You will be contacted by the vetting provider.",
		"provider":       req.Provider,
		"vetting_class":  req.VettingClass,
		"estimated_cost": fmt.Sprintf("$%d USD", estimatedCost),
	}))
}

// GetVettingStatus godoc
// @Summary Get brand vetting status
// @Description Get current vetting status and details for a brand
// @Tags TCR/Brands
// @Accept json
// @Produce json
// @Param id path string true "Brand ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/brands/{id}/vetting [get]
func (h *TCRBrandHandler) GetVettingStatus(c *gin.Context) {
	// Parse ID
	brandID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid brand ID format"))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Get brand
	brand, err := h.brandRepo.GetByID(c.Request.Context(), brandID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this brand"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Brand not found"))
		return
	}

	vettingInfo := gin.H{
		"status":        strOrEmpty(brand.VettingStatus),
		"provider":      strOrEmpty(brand.VettingProvider),
		"vetting_class": strOrEmpty(brand.VettingClass),
		"vetting_date":  brand.VettingDate,
		"trust_score":   brand.TrustScore,
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(vettingInfo))
}

// Helper function
func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
