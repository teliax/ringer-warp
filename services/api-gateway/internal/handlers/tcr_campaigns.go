package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

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
	cnpID        string // Upstream CNP ID (e.g., Sinch) for campaign sharing
	logger       *zap.Logger
}

func NewTCRCampaignHandler(
	campaignRepo *repository.TCRCampaignRepository,
	brandRepo    *repository.TCRBrandRepository,
	tcrClient    *tcr.Client,
	cnpID string,
	logger *zap.Logger,
) *TCRCampaignHandler {
	return &TCRCampaignHandler{
		campaignRepo: campaignRepo,
		brandRepo:    brandRepo,
		tcrClient:    tcrClient,
		cnpID:        cnpID,
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

// UpdateCampaign godoc
// @Summary Update a 10DLC campaign
// @Description Update editable fields of a campaign. Only REJECTED or PENDING campaigns can be updated.
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Param campaign body models.UpdateCampaignRequest true "Campaign fields to update"
// @Success 200 {object} models.APIResponse{data=models.Campaign10DLC}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 502 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id} [patch]
func (h *TCRCampaignHandler) UpdateCampaign(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	var req models.UpdateCampaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Validate at least one field is provided
	if req.Description == nil && req.MessageFlow == nil && len(req.SampleMessages) == 0 &&
		req.OptinMessage == nil && req.OptoutMessage == nil && req.HelpMessage == nil &&
		req.PrivacyPolicyURL == nil && req.TermsURL == nil && req.AutoRenewal == nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("EMPTY_UPDATE", "At least one field must be provided for update"))
		return
	}

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Get campaign to verify access and check status
	campaign, err := h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	// Only allow updates to REJECTED or PENDING campaigns
	if campaign.Status != "REJECTED" && campaign.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(
			"INVALID_STATUS",
			"Only campaigns in REJECTED or PENDING status can be updated. Current status: "+campaign.Status,
		))
		return
	}

	// Check if campaign is registered with TCR
	if campaign.TCRCampaignID == nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("NOT_REGISTERED", "Campaign must be registered with TCR before updating"))
		return
	}

	// Get user ID for audit
	userIDVal, _ := c.Get("user_id")
	userIDStr, _ := userIDVal.(string)
	updatedBy, err := uuid.Parse(userIDStr)
	if err != nil {
		h.logger.Error("Invalid user ID format", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("AUTH_ERROR", "Invalid user ID"))
		return
	}

	// Build TCR update request
	tcrUpdates := buildTCRUpdateMap(&req)

	// Update TCR first
	h.logger.Info("Updating campaign in TCR",
		zap.String("campaign_id", campaignID.String()),
		zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
	)

	_, err = h.tcrClient.UpdateCampaign(c.Request.Context(), *campaign.TCRCampaignID, tcrUpdates)
	if err != nil {
		h.logger.Error("Failed to update campaign in TCR",
			zap.Error(err),
			zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
		)
		c.JSON(http.StatusBadGateway, models.NewErrorResponse("TCR_UPDATE_FAILED", "Failed to update campaign in TCR: "+err.Error()))
		return
	}

	// Update local database
	err = h.campaignRepo.Update(c.Request.Context(), campaignID, &req, updatedBy)
	if err != nil {
		h.logger.Error("Failed to update campaign in database after TCR success",
			zap.Error(err),
			zap.String("campaign_id", campaignID.String()),
		)
		// TCR was updated but local failed - log but don't fail the request
		h.logger.Warn("TCR updated but local database update failed - data may be out of sync")
	}

	// Fetch updated campaign for response
	updatedCampaign, _ := h.campaignRepo.GetByID(c.Request.Context(), campaignID, nil)
	if updatedCampaign == nil {
		updatedCampaign = campaign
	}

	h.logger.Info("Campaign updated successfully",
		zap.String("campaign_id", campaignID.String()),
		zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
	)

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"campaign": updatedCampaign,
		"message":  "Campaign updated successfully. You can now resubmit for carrier review.",
	}))
}

// ResubmitCampaign godoc
// @Summary Resubmit a campaign for MNO review
// @Description Resubmit a REJECTED campaign to carriers for re-review after making updates
// @Tags TCR/Campaigns
// @Accept json
// @Produce json
// @Param id path string true "Campaign ID (UUID)"
// @Param request body models.ResubmitCampaignRequest false "Optional MNO IDs to resubmit to"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 502 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/campaigns/{id}/resubmit [put]
func (h *TCRCampaignHandler) ResubmitCampaign(c *gin.Context) {
	// Parse ID
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid campaign ID format"))
		return
	}

	// Parse optional request body
	var req models.ResubmitCampaignRequest
	// Ignore binding errors - body is optional
	_ = c.ShouldBindJSON(&req)

	// Extract customer scoping
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Get campaign to verify access and check status
	campaign, err := h.campaignRepo.GetByID(c.Request.Context(), campaignID, customerFilter)
	if err != nil {
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this campaign"))
			return
		}
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Campaign not found"))
		return
	}

	// Only allow resubmission of REJECTED campaigns (or PENDING for backfill)
	if campaign.Status != "REJECTED" && campaign.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(
			"INVALID_STATUS",
			"Only campaigns in REJECTED or PENDING status can be resubmitted. Current status: "+campaign.Status,
		))
		return
	}

	// Check if campaign is registered with TCR
	if campaign.TCRCampaignID == nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("NOT_REGISTERED", "Campaign must be registered with TCR before resubmitting"))
		return
	}

	// Smart resubmit: detect if rejection was from CNP or carrier
	isCNPRejection := campaign.RejectedBy != nil && isCNPRejecter(*campaign.RejectedBy)

	if isCNPRejection {
		// CNP rejection - nudge CNP to review (intent based on current status)
		// APPEAL_REJECTION: For campaigns in REJECTED status
		// REVIEW: For campaigns in PENDING status
		nudgeIntent := "REVIEW"
		if campaign.Status == "REJECTED" {
			nudgeIntent = "APPEAL_REJECTION"
		}

		h.logger.Info("Nudging CNP to review campaign",
			zap.String("campaign_id", campaignID.String()),
			zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
			zap.String("rejected_by", *campaign.RejectedBy),
			zap.String("nudge_intent", nudgeIntent),
			zap.String("status", campaign.Status),
		)

		// Build nudge description from rejection codes
		nudgeDesc := "Campaign updated to address compliance issues"
		if campaign.RejectionCode != nil && *campaign.RejectionCode != "" {
			nudgeDesc = fmt.Sprintf("Campaign updated to fix rejection codes: %s", *campaign.RejectionCode)
		}

		// Nudge CNP to review
		err := h.tcrClient.NudgeCampaign(c.Request.Context(), *campaign.TCRCampaignID, nudgeIntent, nudgeDesc)
		if err != nil {
			h.logger.Error("Failed to nudge CNP for appeal review",
				zap.Error(err),
				zap.String("rejected_by", *campaign.RejectedBy),
			)
			c.JSON(http.StatusBadGateway, models.NewErrorResponse("CNP_NUDGE_FAILED", "Failed to nudge CNP for appeal review: "+err.Error()))
			return
		}

		// Keep status as PENDING (awaiting CNP appeal review)
		err = h.campaignRepo.UpdateStatus(c.Request.Context(), campaignID, "PENDING")
		if err != nil {
			h.logger.Warn("Failed to update campaign status", zap.Error(err))
		}

		h.logger.Info("CNP nudged successfully",
			zap.String("campaign_id", campaignID.String()),
			zap.String("rejected_by", *campaign.RejectedBy),
			zap.String("nudge_intent", nudgeIntent),
		)

		c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
			"campaign_id":     campaignID,
			"tcr_campaign_id": *campaign.TCRCampaignID,
			"rejected_by":     *campaign.RejectedBy,
			"nudge_intent":    nudgeIntent,
			"message":         fmt.Sprintf("%s has been notified to review your updated campaign. You'll receive a webhook when they approve or reject.", *campaign.RejectedBy),
		}))
		return
	}

	// Carrier rejection - resubmit to MNOs
	mnoIDs := req.MNOIDs
	if len(mnoIDs) == 0 {
		// Submit to all major US carriers
		mnoIDs = []int64{10017, 10035, 10038} // AT&T, T-Mobile, Verizon
	}

	// Resubmit to carriers
	h.logger.Info("Resubmitting campaign to carriers",
		zap.String("campaign_id", campaignID.String()),
		zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
		zap.Any("mno_ids", mnoIDs),
	)

	result, err := h.tcrClient.ResubmitCampaign(c.Request.Context(), *campaign.TCRCampaignID, mnoIDs)
	if err != nil {
		h.logger.Error("Failed to resubmit campaign to carriers",
			zap.Error(err),
			zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
		)
		c.JSON(http.StatusBadGateway, models.NewErrorResponse("TCR_RESUBMIT_FAILED", "Failed to resubmit campaign to carriers: "+err.Error()))
		return
	}

	// Update local status to PENDING (awaiting carrier review)
	err = h.campaignRepo.UpdateStatus(c.Request.Context(), campaignID, "PENDING")
	if err != nil {
		h.logger.Warn("Failed to update local campaign status after resubmit",
			zap.Error(err),
			zap.String("campaign_id", campaignID.String()),
		)
		// Don't fail - TCR resubmit succeeded
	}

	// Clear rejection reasons for the MNOs being resubmitted
	go func() {
		ctx := context.Background()
		h.syncMNOStatus(ctx, campaignID, *campaign.TCRCampaignID)
	}()

	h.logger.Info("Campaign resubmitted successfully",
		zap.String("campaign_id", campaignID.String()),
		zap.String("tcr_campaign_id", *campaign.TCRCampaignID),
	)

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"campaign_id":     campaignID,
		"tcr_campaign_id": result.CampaignID,
		"mno_metadata":    result.MNOMetadata,
		"message":         "Campaign resubmitted for carrier review. Check MNO status for approval updates.",
	}))
}

// buildTCRUpdateMap converts UpdateCampaignRequest to map for TCR API
func buildTCRUpdateMap(req *models.UpdateCampaignRequest) map[string]interface{} {
	updates := make(map[string]interface{})

	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.MessageFlow != nil {
		updates["messageFlow"] = *req.MessageFlow
	}
	if len(req.SampleMessages) > 0 {
		if len(req.SampleMessages) >= 1 {
			updates["sample1"] = req.SampleMessages[0]
		}
		if len(req.SampleMessages) >= 2 {
			updates["sample2"] = req.SampleMessages[1]
		}
		if len(req.SampleMessages) >= 3 {
			updates["sample3"] = req.SampleMessages[2]
		}
		if len(req.SampleMessages) >= 4 {
			updates["sample4"] = req.SampleMessages[3]
		}
		if len(req.SampleMessages) >= 5 {
			updates["sample5"] = req.SampleMessages[4]
		}
	}
	if req.OptinMessage != nil {
		updates["optinMessage"] = *req.OptinMessage
	}
	if req.OptoutMessage != nil {
		updates["optoutMessage"] = *req.OptoutMessage
	}
	if req.HelpMessage != nil {
		updates["helpMessage"] = *req.HelpMessage
	}
	if req.PrivacyPolicyURL != nil {
		updates["privacyPolicyLink"] = *req.PrivacyPolicyURL
	}
	if req.TermsURL != nil {
		updates["termsAndConditionsLink"] = *req.TermsURL
	}
	if req.AutoRenewal != nil {
		updates["autoRenewal"] = *req.AutoRenewal
	}

	return updates
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

// isCNPRejecter determines if the rejection came from a CNP/DCA vs a direct carrier
// CNPs/DCAs include: Sinch, Bandwidth, Telnyx, Twilio, etc.
// Direct carriers are: AT&T, T-Mobile, Verizon
func isCNPRejecter(rejectedBy string) bool {
	// Common CNP/DCA names
	cnpNames := []string{
		"Sinch",
		"Teliax, Inc.", // Our CSP name in TCR
		"Teliax",
		"Bandwidth",
		"Telnyx",
		"Twilio",
		"Vonage",
		"Plivo",
	}

	for _, cnp := range cnpNames {
		if strings.Contains(rejectedBy, cnp) {
			return true
		}
	}

	// If contains carrier names, it's NOT a CNP rejection
	carrierNames := []string{"AT&T", "T-Mobile", "Verizon", "US Cellular"}
	for _, carrier := range carrierNames {
		if strings.Contains(rejectedBy, carrier) {
			return false
		}
	}

	// Default: if unclear, treat as CNP rejection (safer - won't spam carriers)
	return true
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
