package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/services"
	"go.uber.org/zap"
)

// NumberHandler handles HTTP requests for number inventory operations
type NumberHandler struct {
	numberService *services.NumberService
	logger        *zap.Logger
}

// NewNumberHandler creates a new NumberHandler instance
func NewNumberHandler(numberService *services.NumberService, logger *zap.Logger) *NumberHandler {
	return &NumberHandler{
		numberService: numberService,
		logger:        logger,
	}
}

// SearchNumbers godoc
// @Summary Search available numbers
// @Description Search for available telephone numbers from SOA inventory (JIT)
// @Tags Numbers
// @Accept json
// @Produce json
// @Param npa query string false "Area code (e.g., 303)"
// @Param nxx query string false "Exchange (e.g., 555)"
// @Param state query string false "State code (e.g., CO)"
// @Param lata query string false "LATA number"
// @Param rate_center query string false "Rate center name"
// @Param page query int false "Page number" default(1)
// @Param size query int false "Page size" default(50)
// @Success 200 {object} models.APIResponse{data=models.NumberSearchResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/search [get]
func (h *NumberHandler) SearchNumbers(c *gin.Context) {
	// Build search request from query params
	req := &models.SearchNumbersRequest{
		NPA:        c.Query("npa"),
		NXX:        c.Query("nxx"),
		State:      c.Query("state"),
		LATA:       c.Query("lata"),
		RateCenter: c.Query("rate_center"),
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 50
	}
	req.Page = page - 1 // Convert to 0-indexed for SOA
	req.Size = size

	// Execute search
	result, err := h.numberService.SearchAvailableNumbers(c.Request.Context(), req)
	if err != nil {
		h.logger.Error("Number search failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("SEARCH_FAILED", "Failed to search available numbers"))
		return
	}

	// Adjust page back to 1-indexed for response
	result.Page = page

	c.JSON(http.StatusOK, models.NewSuccessResponse(result))
}

// ReserveNumbers godoc
// @Summary Reserve numbers
// @Description Temporarily reserve numbers for purchase (15 minute hold)
// @Tags Numbers
// @Accept json
// @Produce json
// @Param request body models.ReserveNumberRequest true "Numbers to reserve"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/reserve [post]
func (h *NumberHandler) ReserveNumbers(c *gin.Context) {
	var req models.ReserveNumberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get user email for reservation tracking
	userEmail, _ := c.Get("user_email")
	reservedBy := "unknown"
	if email, ok := userEmail.(string); ok {
		reservedBy = email
	}

	// Reserve numbers
	reserved, errors := h.numberService.ReserveNumbers(c.Request.Context(), req.Numbers, reservedBy)

	// Build response
	response := gin.H{
		"reserved": reserved,
		"count":    len(reserved),
	}

	if len(errors) > 0 {
		errorMsgs := make([]string, len(errors))
		for i, err := range errors {
			errorMsgs[i] = err.Error()
		}
		response["errors"] = errorMsgs
		response["partial"] = true
	}

	if len(reserved) == 0 && len(errors) > 0 {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("RESERVATION_FAILED", "Failed to reserve any numbers"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(response))
}

// PurchaseNumbers godoc
// @Summary Purchase numbers
// @Description Purchase reserved numbers and assign to customer account
// @Tags Numbers
// @Accept json
// @Produce json
// @Param request body models.PurchaseNumberRequest true "Numbers to purchase"
// @Success 201 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/purchase [post]
func (h *NumberHandler) PurchaseNumbers(c *gin.Context) {
	var req models.PurchaseNumberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get customer ID
	customerID, err := h.getCustomerID(c)
	if err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("CUSTOMER_ACCESS_ERROR", err.Error()))
		return
	}

	// Get user ID for audit
	createdBy, err := h.getUserID(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("INTERNAL_ERROR", "User ID not found"))
		return
	}

	// Purchase numbers
	purchased, errors := h.numberService.PurchaseNumbers(c.Request.Context(), &req, customerID, createdBy)

	// Build response
	response := gin.H{
		"numbers": purchased,
		"count":   len(purchased),
	}

	if len(errors) > 0 {
		errorMsgs := make([]string, len(errors))
		for i, err := range errors {
			errorMsgs[i] = err.Error()
		}
		response["errors"] = errorMsgs
		response["partial"] = true
	}

	if len(purchased) == 0 && len(errors) > 0 {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("PURCHASE_FAILED", "Failed to purchase any numbers"))
		return
	}

	h.logger.Info("Numbers purchased",
		zap.Int("count", len(purchased)),
		zap.String("customer_id", customerID.String()),
	)

	c.JSON(http.StatusCreated, models.NewSuccessResponse(response))
}

// ListNumbers godoc
// @Summary List assigned numbers
// @Description Get list of numbers assigned to accessible customers
// @Tags Numbers
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param active_only query bool false "Only show active numbers" default(true)
// @Success 200 {object} models.APIResponse{data=models.NumberListResponse}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers [get]
func (h *NumberHandler) ListNumbers(c *gin.Context) {
	// Extract customer scoping from gatekeeper middleware
	customerFilter := h.getCustomerFilter(c)

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Active filter
	activeOnly := c.DefaultQuery("active_only", "true") == "true"

	// Query numbers
	result, err := h.numberService.ListNumbers(c.Request.Context(), customerFilter, page, perPage, activeOnly)
	if err != nil {
		h.logger.Error("Failed to list numbers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Failed to retrieve numbers"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(result))
}

// GetNumber godoc
// @Summary Get number by ID
// @Description Get detailed information about a specific assigned number
// @Tags Numbers
// @Accept json
// @Produce json
// @Param id path string true "Number ID (UUID)"
// @Success 200 {object} models.APIResponse{data=models.AssignedNumber}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/{id} [get]
func (h *NumberHandler) GetNumber(c *gin.Context) {
	// Parse ID
	numberID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid number ID format"))
		return
	}

	// Extract customer scoping
	customerFilter := h.getCustomerFilter(c)

	// Get number
	number, err := h.numberService.GetNumber(c.Request.Context(), numberID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this number"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Number not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(number))
}

// GetNumberByTN godoc
// @Summary Get number by telephone number
// @Description Get detailed information about a specific number by its E.164 value
// @Tags Numbers
// @Accept json
// @Produce json
// @Param tn path string true "Telephone number (E.164 format)"
// @Success 200 {object} models.APIResponse{data=models.AssignedNumber}
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/tn/{tn} [get]
func (h *NumberHandler) GetNumberByTN(c *gin.Context) {
	tn := c.Param("tn")
	if tn == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_TN", "Telephone number required"))
		return
	}

	// Extract customer scoping
	customerFilter := h.getCustomerFilter(c)

	// Get number
	number, err := h.numberService.GetNumberByTN(c.Request.Context(), tn, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this number"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Number not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(number))
}

// UpdateNumber godoc
// @Summary Update number configuration
// @Description Update routing, features, and other configuration for an assigned number
// @Tags Numbers
// @Accept json
// @Produce json
// @Param id path string true "Number ID (UUID)"
// @Param request body models.UpdateNumberRequest true "Number update"
// @Success 200 {object} models.APIResponse{data=models.AssignedNumber}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/{id} [patch]
func (h *NumberHandler) UpdateNumber(c *gin.Context) {
	// Parse ID
	numberID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid number ID format"))
		return
	}

	var req models.UpdateNumberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Extract customer scoping
	customerFilter := h.getCustomerFilter(c)

	// Get user ID for audit
	updatedBy, err := h.getUserID(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("INTERNAL_ERROR", "User ID not found"))
		return
	}

	// Update number
	updated, err := h.numberService.UpdateNumber(c.Request.Context(), numberID, &req, customerFilter, updatedBy)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this number"))
			return
		}
		if err.Error() == "number not found" {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Number not found"))
			return
		}
		h.logger.Error("Failed to update number", zap.Error(err), zap.String("number_id", numberID.String()))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_FAILED", "Failed to update number"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(updated))
}

// ReleaseNumber godoc
// @Summary Release a number
// @Description Release an assigned number back to the pool
// @Tags Numbers
// @Accept json
// @Produce json
// @Param id path string true "Number ID (UUID)"
// @Param request body models.ReleaseNumberRequest true "Release reason"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/{id}/release [post]
func (h *NumberHandler) ReleaseNumber(c *gin.Context) {
	// Parse ID
	numberID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid number ID format"))
		return
	}

	var req models.ReleaseNumberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Extract customer scoping
	customerFilter := h.getCustomerFilter(c)

	// Get user ID for audit
	releasedBy, err := h.getUserID(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("INTERNAL_ERROR", "User ID not found"))
		return
	}

	// Release number
	err = h.numberService.ReleaseNumber(c.Request.Context(), numberID, &req, customerFilter, releasedBy)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this number"))
			return
		}
		if err.Error() == "number not found" {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Number not found"))
			return
		}
		if err.Error() == "number already released" {
			c.JSON(http.StatusBadRequest, models.NewErrorResponse("ALREADY_RELEASED", "Number is already released"))
			return
		}
		h.logger.Error("Failed to release number", zap.Error(err), zap.String("number_id", numberID.String()))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("RELEASE_FAILED", "Failed to release number"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "Number released successfully",
		"reason":  req.Reason,
	}))
}

// GetInventorySummary godoc
// @Summary Get inventory summary
// @Description Get aggregate statistics for a customer's number inventory
// @Tags Numbers
// @Accept json
// @Produce json
// @Param customer_id query string false "Customer ID (SuperAdmin only)"
// @Success 200 {object} models.APIResponse{data=models.NumberInventorySummary}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/summary [get]
func (h *NumberHandler) GetInventorySummary(c *gin.Context) {
	// Get customer ID
	customerID, err := h.getCustomerID(c)
	if err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("CUSTOMER_ACCESS_ERROR", err.Error()))
		return
	}

	// Get summary
	summary, err := h.numberService.GetInventorySummary(c.Request.Context(), customerID)
	if err != nil {
		h.logger.Error("Failed to get inventory summary", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Failed to retrieve inventory summary"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(summary))
}

// SyncNumber godoc
// @Summary Sync number from SOA
// @Description Sync number status and metadata from upstream SOA
// @Tags Numbers
// @Accept json
// @Produce json
// @Param id path string true "Number ID (UUID)"
// @Success 200 {object} models.APIResponse{data=models.AssignedNumber}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /numbers/{id}/sync [post]
func (h *NumberHandler) SyncNumber(c *gin.Context) {
	// Parse ID
	numberID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid number ID format"))
		return
	}

	// Extract customer scoping
	customerFilter := h.getCustomerFilter(c)

	// Sync from SOA
	number, err := h.numberService.SyncFromSOA(c.Request.Context(), numberID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this number"))
			return
		}
		if err.Error() == "number not found in SOA" {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_IN_SOA", "Number not found in upstream SOA"))
			return
		}
		h.logger.Error("Failed to sync number", zap.Error(err), zap.String("number_id", numberID.String()))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("SYNC_FAILED", "Failed to sync number from SOA"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"number":  number,
		"message": "Number synced from SOA successfully",
	}))
}

// Helper methods

// getCustomerFilter extracts accessible customer IDs from gatekeeper middleware
func (h *NumberHandler) getCustomerFilter(c *gin.Context) []uuid.UUID {
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		return accessibleCustomers.([]uuid.UUID)
	}
	return nil
}

// getCustomerID gets the target customer ID for operations
// SuperAdmin: Reads from X-Customer-ID header
// Regular users: Uses first accessible customer
func (h *NumberHandler) getCustomerID(c *gin.Context) (uuid.UUID, error) {
	// Check if user has wildcard permission (SuperAdmin)
	hasWildcard, _ := c.Get("has_wildcard")
	if hw, ok := hasWildcard.(bool); ok && hw {
		// SuperAdmin: Read customer ID from X-Customer-ID header
		customerIDHeader := c.GetHeader("X-Customer-ID")
		if customerIDHeader == "" {
			return uuid.Nil, fmt.Errorf("X-Customer-ID header required for SuperAdmin")
		}
		return uuid.Parse(customerIDHeader)
	}

	// Regular user: Use accessible customers from gatekeeper
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter := accessibleCustomers.([]uuid.UUID)
		if len(customerFilter) == 0 {
			return uuid.Nil, fmt.Errorf("no customer access configured")
		}
		// Use first accessible customer
		return customerFilter[0], nil
	}

	return uuid.Nil, fmt.Errorf("customer access not found")
}

// getUserID extracts user UUID from context
func (h *NumberHandler) getUserID(c *gin.Context) (uuid.UUID, error) {
	if userIDUUID, exists := c.Get("user_id_uuid"); exists {
		return userIDUUID.(uuid.UUID), nil
	}

	// Try string format
	if userID, exists := c.Get("user_id"); exists {
		switch v := userID.(type) {
		case uuid.UUID:
			return v, nil
		case string:
			return uuid.Parse(v)
		}
	}

	return uuid.Nil, fmt.Errorf("user ID not found in context")
}

