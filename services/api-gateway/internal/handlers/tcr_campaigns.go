package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/tcr"
	"go.uber.org/zap"
)

type TCRCampaignHandler struct {
	campaignRepo *repository.TCRCampaignRepository
	brandRepo    *repository.TCRBrandRepository
	tcrClient    *tcr.Client
	logger       *zap.Logger
}

func NewTCRCampaignHandler(
	campaignRepo *repository.TCRCampaignRepository,
	brandRepo    *repository.TCRBrandRepository,
	tcrClient    *tcr.Client,
	logger *zap.Logger,
) *TCRCampaignHandler {
	return &TCRCampaignHandler{
		campaignRepo: campaignRepo,
		brandRepo:    brandRepo,
		tcrClient:    tcrClient,
		logger:       logger,
	}
}

// ListCampaigns godoc
// @Summary List 10DLC campaigns
// @Description Get list of registered 10DLC campaigns for accessible customers
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param brand_id query string false "Filter by brand ID"
// @Param status query string false "Filter by status"
// @Success 200 {object} models.APIResponse{data=models.ListResponse}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns [get]
func (h *TCRCampaignHandler) ListCampaigns(c *gin.Context) {
	// Extract customer scoping
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

	// Filters
	var brandID *uuid.UUID
	if brandIDStr := c.Query("brand_id"); brandIDStr != "" {
		if parsed, err := uuid.Parse(brandIDStr); err == nil {
			brandID = &parsed
		}
	}
	status := c.Query("status")

	// Query campaigns
	campaigns, total, err := h.campaignRepo.List(c.Request.Context(), customerFilter, brandID, status, page, perPage)
	if err != nil {
		h.logger.Error("Failed to list campaigns", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Failed to retrieve campaigns"))
		return
	}

	c.JSON(http.StatusOK, models.NewListResponse(campaigns, page, perPage, int(total)))
}

// GetCampaign godoc
// @Summary Get campaign by ID
// @Description Get detailed information about a specific 10DLC campaign
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Success 200 {object} models.APIResponse{data=models.Campaign10DLC}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id} [get]
func (h *TCRCampaignHandler) GetCampaign(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Get campaign
	campaign, err := h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		h.logger.Error("Failed to get campaign", zap.Error(err), zap.String("campaign_id", campaignID.String()))
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(campaign))
}

// CreateCampaign godoc
// @Summary Register new 10DLC campaign
// @Description Register a new campaign with The Campaign Registry
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param campaign body models.CreateCampaignRequest true "Campaign registration info"
// @Success 201 {object} models.APIResponse{data=models.Campaign10DLC}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns [post]
func (h *TCRCampaignHandler) CreateCampaign(c *gin.Context) {
	var req models.CreateCampaignRequest
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
	brand, err := h.brandRepo.GetByID(c.Request.Context(), req.BrandID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("BRAND_ACCESS_DENIED", "You don't have access to this brand"))
			return
		}
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("BRAND_NOT_FOUND", "Brand not found"))
		return
	}

	// Check if brand is registered with TCR
	if brand.TCRBrandID == nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("BRAND_NOT_REGISTERED", "Brand must be registered with TCR before creating campaigns"))
		return
	}

	// Get user ID for audit
	userID, _ := c.Get("user_id")
	createdBy := userID.(uuid.UUID)

	// Step 1: Create campaign in local database first (status: PENDING)
	campaign, err := h.campaignRepo.Create(c.Request.Context(), &req, brand.CustomerID, createdBy)
	if err != nil {
		h.logger.Error("Failed to create campaign in database", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", "Failed to create campaign"))
		return
	}

	h.logger.Info("Campaign created in database, submitting to TCR",
		zap.String("campaign_id", campaign.ID.String()),
		zap.String("brand_id", brand.ID.String()),
		zap.String("use_case", campaign.UseCase),
	)

	// Step 2: Submit to TCR API (async - don't block response)
	go func() {
		// Use background context (request context gets cancelled after response sent)
		ctx := context.Background()

		// Build TCR request
		tcrReq := tcr.CampaignRequest{
			BrandID:              *brand.TCRBrandID,
			UseCase:              req.UseCase,
			Description:          req.Description,
			MessageFlow:          req.MessageFlow,
			Sample1:              req.SampleMessages[0],
			Sample2:              getOrEmpty(req.SampleMessages, 1),
			Sample3:              getOrEmpty(req.SampleMessages, 2),
			Sample4:              getOrEmpty(req.SampleMessages, 3),
			Sample5:              getOrEmpty(req.SampleMessages, 4),
			SubscriberOptin:      req.SubscriberOptin,
			SubscriberOptout:     req.SubscriberOptout,
			SubscriberHelp:       req.SubscriberHelp,
			OptinKeywords:        strOrEmpty(req.OptinKeywords),
			OptinMessage:         strOrEmpty(req.OptinMessage),
			OptoutKeywords:       req.OptoutKeywords,
			OptoutMessage:        strOrEmpty(req.OptoutMessage),
			HelpKeywords:         req.HelpKeywords,
			HelpMessage:          strOrEmpty(req.HelpMessage),
			EmbeddedLink:         req.EmbeddedLink,
			EmbeddedPhone:        req.EmbeddedPhone,
			NumberPool:           req.NumberPool,
			AgeGated:             req.AgeGated,
			DirectLending:        req.DirectLending,
			PrivacyPolicyLink:    strOrEmpty(req.PrivacyPolicyURL),
			TermsAndConditions:   strOrEmpty(req.TermsURL),
			AutoRenewal:          req.AutoRenewal,
			ReferenceID:          campaign.ID.String(),
			SubUseCases:          req.SubUseCases,
		}

		// Submit to TCR
		tcrCampaign, err := h.tcrClient.CreateCampaign(ctx, tcrReq)
		if err != nil {
			h.logger.Error("Failed to submit campaign to TCR",
				zap.Error(err),
				zap.String("campaign_id", campaign.ID.String()),
			)
			// Update status to FAILED in database
			_ = h.campaignRepo.UpdateTCRInfo(ctx, campaign.ID, "", "FAILED", nil, nil)
			return
		}

		// Update database with TCR response
		h.logger.Info("Campaign registered with TCR successfully",
			zap.String("campaign_id", campaign.ID.String()),
			zap.String("tcr_campaign_id", tcrCampaign.CampaignID),
		)

		err = h.campaignRepo.UpdateTCRInfo(
			ctx,
			campaign.ID,
			tcrCampaign.CampaignID,
			tcrCampaign.Status,
			&tcrCampaign.ThroughputLimit,
			&tcrCampaign.DailyLimit,
		)
		if err != nil {
			h.logger.Error("Failed to update campaign with TCR info",
				zap.Error(err),
				zap.String("campaign_id", campaign.ID.String()),
			)
		}

		// Poll for MNO status updates (TCR assigns to carriers)
		go h.pollMNOStatus(ctx, campaign.ID, tcrCampaign.CampaignID)
	}()

	// Return immediate response (campaign will be updated async)
	c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
		"campaign": campaign,
		"message":  "Campaign submitted to TCR for registration. Status will be updated once processed.",
	}))
}

// GetMNOStatus godoc
// @Summary Get campaign MNO status
// @Description Get per-carrier approval status for a campaign
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id}/mno-status [get]
func (h *TCRCampaignHandler) GetMNOStatus(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify campaign exists and user has access
	campaign, err := h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	// Get MNO status from database
	mnoStatuses, err := h.campaignRepo.GetMNOStatus(c.Request.Context(), campaignID)
	if err != nil {
		h.logger.Error("Failed to get MNO status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Failed to retrieve MNO status"))
		return
	}

	// If TCR campaign ID exists, poll TCR for latest status
	if campaign.TCRCampaignID != nil {
		go func() {
			// Use background context (request context gets cancelled after response sent)
			ctx := context.Background()
			h.syncMNOStatus(ctx, campaignID, *campaign.TCRCampaignID)
		}()
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"campaign_id":  campaignID,
		"mno_statuses": mnoStatuses,
	}))
}

// AssignPhoneNumbers godoc
// @Summary Assign phone numbers to campaign
// @Description Assign phone numbers to a 10DLC campaign
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Param numbers body models.AssignNumbersRequest true "Phone numbers to assign"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id}/numbers [post]
func (h *TCRCampaignHandler) AssignPhoneNumbers(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	var req models.AssignNumbersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify campaign exists and user has access
	_, err = h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	// Get user ID for audit
	userID, _ := c.Get("user_id")
	assignedBy := userID.(uuid.UUID)

	// Assign numbers
	err = h.campaignRepo.AssignPhoneNumbers(c.Request.Context(), campaignID, req.PhoneNumbers, assignedBy)
	if err != nil {
		h.logger.Error("Failed to assign phone numbers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("ASSIGN_FAILED", "Failed to assign phone numbers"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message":       "Phone numbers assigned successfully",
		"count":         len(req.PhoneNumbers),
		"phone_numbers": req.PhoneNumbers,
	}))
}

// RemovePhoneNumbers godoc
// @Summary Remove phone numbers from campaign
// @Description Remove phone numbers from a 10DLC campaign
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Param numbers body models.AssignNumbersRequest true "Phone numbers to remove"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id}/numbers [delete]
func (h *TCRCampaignHandler) RemovePhoneNumbers(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	var req models.AssignNumbersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify campaign exists and user has access
	_, err = h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	// Get user ID for audit
	userID, _ := c.Get("user_id")
	removedBy := userID.(uuid.UUID)

	// Remove numbers
	err = h.campaignRepo.RemovePhoneNumbers(c.Request.Context(), campaignID, req.PhoneNumbers, removedBy)
	if err != nil {
		h.logger.Error("Failed to remove phone numbers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("REMOVE_FAILED", "Failed to remove phone numbers"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "Phone numbers removed successfully",
		"count":   len(req.PhoneNumbers),
	}))
}

// GetCampaignNumbers godoc
// @Summary Get campaign phone numbers
// @Description Get list of phone numbers assigned to a campaign
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id}/numbers [get]
func (h *TCRCampaignHandler) GetCampaignNumbers(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify campaign exists and user has access
	_, err = h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	// Get phone numbers
	numbers, err := h.campaignRepo.GetCampaignPhoneNumbers(c.Request.Context(), campaignID)
	if err != nil {
		h.logger.Error("Failed to get campaign numbers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("QUERY_FAILED", "Failed to retrieve phone numbers"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"campaign_id":   campaignID,
		"phone_numbers": numbers,
		"count":         len(numbers),
	}))
}

// Helper functions

func getOrEmpty(arr []string, index int) string {
	if index < len(arr) {
		return arr[index]
	}
	return ""
}

// pollMNOStatus polls TCR for MNO status updates
func (h *TCRCampaignHandler) pollMNOStatus(ctx context.Context, campaignID uuid.UUID, tcrCampaignID string) {
	h.syncMNOStatus(ctx, campaignID, tcrCampaignID)
}

// syncMNOStatus fetches and syncs MNO status from TCR
func (h *TCRCampaignHandler) syncMNOStatus(ctx context.Context, campaignID uuid.UUID, tcrCampaignID string) {
	// Get MNO status from TCR
	mnoStatus, err := h.tcrClient.GetCampaignOperationStatus(ctx, tcrCampaignID)
	if err != nil {
		h.logger.Error("Failed to get MNO status from TCR",
			zap.Error(err),
			zap.String("tcr_campaign_id", tcrCampaignID),
		)
		return
	}

	// Update database with MNO statuses
	for mnoID, status := range mnoStatus {
		mnoName := tcr.ParseMNOStatus(mnoID)
		err := h.campaignRepo.UpsertMNOStatus(ctx, campaignID, mnoID, mnoName, status, nil, nil)
		if err != nil {
			h.logger.Error("Failed to update MNO status",
				zap.Error(err),
				zap.String("mno_id", mnoID),
			)
		}
	}
}
