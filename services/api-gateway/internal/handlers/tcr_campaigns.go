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

	// Auth+ Validation for PUBLIC_PROFIT brands
	if brand.EntityType == "PUBLIC_PROFIT" {
		// Check identity status
		if brand.IdentityStatus == nil ||
			!(*brand.IdentityStatus == "VERIFIED" || *brand.IdentityStatus == "VETTED_VERIFIED") {
			c.JSON(http.StatusForbidden, models.NewErrorResponse(
				"IDENTITY_NOT_VERIFIED",
				"Brand must be in VERIFIED or VETTED_VERIFIED status to create campaigns",
			))
			return
		}

		// Check Auth+ vetting status
		if brand.VettingStatus == nil || *brand.VettingStatus != "ACTIVE" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse(
				"AUTHPLUS_REQUIRED",
				"Auth+ verification required for PUBLIC_PROFIT brands. Please complete Auth+ verification before creating campaigns.",
			))
			return
		}
	}

	// Get user ID for audit
	userIDVal, _ := c.Get("user_id")
	userIDStr, _ := userIDVal.(string)
	createdBy, err := uuid.Parse(userIDStr)
	if err != nil {
		h.logger.Error("Invalid user ID format", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("AUTH_ERROR", "Invalid user ID"))
		return
	}

	// Step 1: Submit to TCR API FIRST (before saving locally)
	// This ensures we don't create orphaned local campaigns if TCR rejects
	h.logger.Info("Submitting campaign to TCR",
		zap.String("brand_id", brand.ID.String()),
		zap.String("tcr_brand_id", *brand.TCRBrandID),
		zap.String("use_case", req.UseCase),
	)

	// Build TCR request
	tcrReq := tcr.CampaignRequest{
		BrandID:                *brand.TCRBrandID,
		ResellerID:             getResellerID(h.tcrClient.ResellerID()), // "R000000" = No Reseller
		UseCase:                req.UseCase,
		Description:            req.Description,
		MessageFlow:            req.MessageFlow,
		Sample1:                req.SampleMessages[0],
		Sample2:                getOrEmpty(req.SampleMessages, 1),
		Sample3:                getOrEmpty(req.SampleMessages, 2),
		Sample4:                getOrEmpty(req.SampleMessages, 3),
		Sample5:                getOrEmpty(req.SampleMessages, 4),
		SubscriberOptin:        req.SubscriberOptin,
		SubscriberOptout:       req.SubscriberOptout,
		SubscriberHelp:         req.SubscriberHelp,
		OptinKeywords:          strOrEmpty(req.OptinKeywords),
		OptinMessage:           strOrEmpty(req.OptinMessage),
		OptoutKeywords:         req.OptoutKeywords,
		OptoutMessage:          strOrEmpty(req.OptoutMessage),
		HelpKeywords:           req.HelpKeywords,
		HelpMessage:            strOrEmpty(req.HelpMessage),
		EmbeddedLink:           req.EmbeddedLink,
		EmbeddedPhone:          req.EmbeddedPhone,
		NumberPool:             req.NumberPool,
		AgeGated:               req.AgeGated,
		DirectLending:          req.DirectLending,
		PrivacyPolicyLink:      strOrEmpty(req.PrivacyPolicyURL),
		TermsAndConditions:     true, // Always true - indicates acceptance of TCR T&C
		TermsAndConditionsLink: strOrEmpty(req.TermsURL),
		AutoRenewal:            req.AutoRenewal,
		SubUseCases:            req.SubUseCases,
	}

	// Submit to TCR - wait for response
	tcrCampaign, err := h.tcrClient.CreateCampaign(c.Request.Context(), tcrReq)
	if err != nil {
		h.logger.Error("Failed to submit campaign to TCR",
			zap.Error(err),
			zap.String("brand_id", brand.ID.String()),
			zap.String("use_case", req.UseCase),
		)
		// Don't create local campaign - TCR rejected it
		c.JSON(http.StatusBadGateway, models.NewErrorResponse("TCR_SUBMISSION_FAILED", "Campaign rejected by TCR: "+err.Error()))
		return
	}

	h.logger.Info("Campaign registered with TCR successfully",
		zap.String("tcr_campaign_id", tcrCampaign.CampaignID),
		zap.String("tcr_status", tcrCampaign.Status),
	)

	// Step 2: TCR accepted - now save to local database
	campaign, err := h.campaignRepo.Create(c.Request.Context(), &req, brand.CustomerID, createdBy)
	if err != nil {
		h.logger.Error("Failed to create campaign in database after TCR success",
			zap.Error(err),
			zap.String("tcr_campaign_id", tcrCampaign.CampaignID),
		)
		// This is a problem - TCR accepted but we failed to save locally
		// Return success since TCR has it, but log the error
		c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
			"tcr_campaign_id": tcrCampaign.CampaignID,
			"tcr_status":      tcrCampaign.Status,
			"message":         "Campaign registered with TCR but failed to save locally. Please contact support.",
			"warning":         "Local database save failed - campaign exists in TCR only",
		}))
		return
	}

	// Update local campaign with TCR info
	// Normalize status - TCR sometimes returns empty on initial creation
	normalizedStatus := normalizeTCRStatus(tcrCampaign.Status)
	err = h.campaignRepo.UpdateTCRInfo(
		c.Request.Context(),
		campaign.ID,
		tcrCampaign.CampaignID,
		normalizedStatus,
		&tcrCampaign.ThroughputLimit,
		&tcrCampaign.DailyLimit,
	)
	if err != nil {
		h.logger.Error("Failed to update campaign with TCR info",
			zap.Error(err),
			zap.String("campaign_id", campaign.ID.String()),
		)
		// Don't fail the request - we have the campaign, just missing some TCR metadata
	}

	// Refresh campaign with updated TCR info for response
	updatedCampaign, _ := h.campaignRepo.GetByID(c.Request.Context(), campaign.ID, nil)
	if updatedCampaign != nil {
		campaign = updatedCampaign
	}

	// Poll for MNO status updates (async - this doesn't affect the user response)
	go func() {
		ctx := context.Background()
		h.pollMNOStatus(ctx, campaign.ID, tcrCampaign.CampaignID)
	}()

	// Return success
	c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
		"campaign":        campaign,
		"tcr_campaign_id": tcrCampaign.CampaignID,
		"tcr_status":      tcrCampaign.Status,
		"message":         "Campaign successfully registered with TCR. Carrier approvals are in progress.",
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
	userIDVal, _ := c.Get("user_id")
	userIDStr, _ := userIDVal.(string)
	assignedBy, err := uuid.Parse(userIDStr)
	if err != nil {
		h.logger.Error("Invalid user ID format", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("AUTH_ERROR", "Invalid user ID"))
		return
	}

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
	userIDVal, _ := c.Get("user_id")
	userIDStr, _ := userIDVal.(string)
	removedBy, err := uuid.Parse(userIDStr)
	if err != nil {
		h.logger.Error("Invalid user ID format", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("AUTH_ERROR", "Invalid user ID"))
		return
	}

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

// NoResellerID is the TCR value indicating no reseller is involved
// Per TCR documentation: "If set to a valid reseller, can only be changed to R000000 to indicate No Reseller"
const NoResellerID = "R000000"

// getResellerID returns the configured reseller ID or "R000000" for "No Reseller"
func getResellerID(configuredID string) string {
	if configuredID == "" {
		return NoResellerID
	}
	return configuredID
}

// normalizeTCRStatus ensures the status is a valid database value
// TCR sometimes returns empty status on initial creation
// Valid values: PENDING, ACTIVE, REJECTED, SUSPENDED, EXPIRED
func normalizeTCRStatus(tcrStatus string) string {
	switch tcrStatus {
	case "ACTIVE", "REJECTED", "SUSPENDED", "EXPIRED":
		return tcrStatus
	default:
		// TCR returns empty or unknown status on initial submission
		// Default to PENDING until webhook confirms actual status
		return "PENDING"
	}
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
