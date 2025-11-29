package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/hubspot"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"go.uber.org/zap"
)

type HubSpotSyncHandler struct {
	syncService   *hubspot.SyncService
	hubspotClient *hubspot.Client
	customerRepo  *repository.CustomerRepository
	logger        *zap.Logger
}

func NewHubSpotSyncHandler(
	syncService *hubspot.SyncService,
	hubspotClient *hubspot.Client,
	customerRepo *repository.CustomerRepository,
	logger *zap.Logger,
) *HubSpotSyncHandler {
	return &HubSpotSyncHandler{
		syncService:   syncService,
		hubspotClient: hubspotClient,
		customerRepo:  customerRepo,
		logger:        logger,
	}
}

// SyncCustomerToHubSpot godoc
// @Summary Manually sync customer to HubSpot
// @Description Trigger immediate sync of customer data to HubSpot CRM
// @Tags HubSpot Sync
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /sync/customers/{id}/to-hubspot [post]
func (h *HubSpotSyncHandler) SyncCustomerToHubSpot(c *gin.Context) {
	idStr := c.Param("id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID"))
		return
	}

	// Get customer
	customer, err := h.customerRepo.GetByID(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_FAILED", err.Error()))
		return
	}
	if customer == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Customer not found"))
		return
	}

	// Perform sync
	syncResult, err := h.syncService.SyncCustomerToHubSpot(c.Request.Context(), customer)
	if err != nil {
		h.logger.Error("Failed to sync customer to HubSpot",
			zap.String("customer_id", customerID.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("SYNC_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message":     "Customer synced to HubSpot successfully",
		"customer_id": customerID.String(),
		"ban":         customer.BAN,
		"sync_result": syncResult,
	}))
}

// QueueCustomerSync godoc
// @Summary Queue customer for async sync
// @Description Add customer to sync queue for background processing
// @Tags HubSpot Sync
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Param request body QueueSyncRequest true "Sync parameters"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /sync/customers/{id}/queue [post]
func (h *HubSpotSyncHandler) QueueCustomerSync(c *gin.Context) {
	idStr := c.Param("id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID"))
		return
	}

	var req struct {
		Direction string `json:"direction" binding:"required,oneof=WARP_TO_HUBSPOT HUBSPOT_TO_WARP"`
		Priority  int    `json:"priority"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	direction := hubspot.SyncDirection(req.Direction)
	priority := req.Priority
	if priority == 0 {
		priority = 5 // Default priority
	}

	if err := h.syncService.QueueCustomerSync(c.Request.Context(), customerID, direction, priority); err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUEUE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "Customer queued for sync",
		"customer_id": customerID.String(),
		"direction": direction,
		"priority": priority,
	}))
}

// ProcessSyncQueue godoc
// @Summary Process sync queue
// @Description Process pending sync queue items (background job endpoint)
// @Tags HubSpot Sync
// @Accept json
// @Produce json
// @Param batch_size query int false "Batch size" default(10)
// @Success 200 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /sync/process-queue [post]
func (h *HubSpotSyncHandler) ProcessSyncQueue(c *gin.Context) {
	batchSize := 10
	if bs := c.Query("batch_size"); bs != "" {
		fmt.Sscanf(bs, "%d", &batchSize)
	}

	if batchSize > 100 {
		batchSize = 100
	}

	if err := h.syncService.ProcessSyncQueue(c.Request.Context(), batchSize); err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("PROCESS_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "Queue processed successfully",
		"batch_size": batchSize,
	}))
}

type QueueSyncRequest struct {
	Direction string `json:"direction"`
	Priority  int    `json:"priority"`
}

// SearchHubSpotCompanies godoc
// @Summary Search HubSpot companies by name
// @Description Search for companies in HubSpot CRM (for autocomplete/typeahead)
// @Tags HubSpot Sync
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /sync/hubspot/companies/search [get]
func (h *HubSpotSyncHandler) SearchHubSpotCompanies(c *gin.Context) {
	query := c.Query("q")
	if query == "" || len(query) < 2 {
		c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
			"companies": []interface{}{},
		}))
		return
	}

	h.logger.Info("Searching HubSpot companies",
		zap.String("query", query),
	)

	// Search HubSpot
	companies, err := h.hubspotClient.SearchCompaniesForAutocomplete(c.Request.Context(), query)
	if err != nil {
		h.logger.Error("HubSpot search failed",
			zap.String("query", query),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("SEARCH_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"companies": companies,
		"count":     len(companies),
	}))
}

// GetCompanyContacts godoc
// @Summary Get HubSpot contacts for a company
// @Description Retrieve contacts associated with a HubSpot company
// @Tags HubSpot Sync
// @Accept json
// @Produce json
// @Param id path string true "HubSpot Company ID"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /sync/hubspot/companies/{id}/contacts [get]
func (h *HubSpotSyncHandler) GetCompanyContacts(c *gin.Context) {
	companyID := c.Param("id")
	if companyID == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("MISSING_ID", "Company ID is required"))
		return
	}

	h.logger.Info("Fetching HubSpot company contacts",
		zap.String("company_id", companyID),
	)

	contacts, err := h.hubspotClient.GetCompanyContacts(c.Request.Context(), companyID)
	if err != nil {
		h.logger.Error("Failed to get company contacts",
			zap.String("company_id", companyID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FETCH_FAILED", err.Error()))
		return
	}

	// Simplify contact data for frontend
	simplifiedContacts := make([]map[string]interface{}, len(contacts))
	for i, contact := range contacts {
		firstName := getString(contact.Properties, "firstname")
		lastName := getString(contact.Properties, "lastname")
		fullName := firstName
		if lastName != "" {
			if fullName != "" {
				fullName += " " + lastName
			} else {
				fullName = lastName
			}
		}

		simplifiedContacts[i] = map[string]interface{}{
			"id":       contact.ID,
			"name":     fullName,
			"email":    getString(contact.Properties, "email"),
			"phone":    getString(contact.Properties, "phone"),
			"jobtitle": getString(contact.Properties, "jobtitle"),
		}
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"contacts": simplifiedContacts,
		"count":    len(simplifiedContacts),
	}))
}

func getString(props map[string]interface{}, key string) string {
	if val, ok := props[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}
