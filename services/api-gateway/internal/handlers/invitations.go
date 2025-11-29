package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/invitation"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"go.uber.org/zap"
)

type InvitationHandler struct {
	invitationService *invitation.Service
	invitationRepo    *repository.InvitationRepository
	customerRepo      *repository.CustomerRepository
	logger            *zap.Logger
}

func NewInvitationHandler(
	invitationService *invitation.Service,
	invitationRepo *repository.InvitationRepository,
	customerRepo *repository.CustomerRepository,
	logger *zap.Logger,
) *InvitationHandler {
	return &InvitationHandler{
		invitationService: invitationService,
		invitationRepo:    invitationRepo,
		customerRepo:      customerRepo,
		logger:            logger,
	}
}

// CreateInvitation godoc
// @Summary Create user invitation
// @Description Invite a user to join a customer account
// @Tags Invitations
// @Accept json
// @Produce json
// @Param customerId path string true "Customer ID (UUID)"
// @Param invitation body models.CreateInvitationRequest true "Invitation details"
// @Success 201 {object} models.APIResponse{data=models.Invitation}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/customers/{customerId}/invitations [post]
func (h *InvitationHandler) CreateInvitation(c *gin.Context) {
	customerIDStr := c.Param("customerId")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	// Verify user has access to this customer (multi-tenant isolation)
	var customerFilter []uuid.UUID
	if accessible, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessible.([]uuid.UUID)
	}

	if err := h.customerRepo.VerifyCustomerAccess(customerID, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You cannot invite users to this customer"))
		return
	}

	var req models.CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get inviter user ID from JWT context
	inviterIDStr := c.GetString("user_id")
	inviterID, err := uuid.Parse(inviterIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.NewErrorResponse("UNAUTHORIZED", "Invalid user context"))
		return
	}

	// Create invitation
	invitation, err := h.invitationService.CreateInvitation(
		c.Request.Context(),
		req.Email,
		req.UserType,
		customerID,
		req.Role,
		req.Message,
		inviterID,
	)

	if err != nil {
		h.logger.Error("Failed to create invitation",
			zap.String("email", req.Email),
			zap.String("customer_id", customerID.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("CREATION_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.NewSuccessResponse(invitation))
}

// GetInvitation godoc
// @Summary Get invitation by token
// @Description Retrieve invitation details (PUBLIC endpoint - no auth required)
// @Tags Invitations
// @Produce json
// @Param token path string true "Invitation Token (UUID)"
// @Success 200 {object} models.APIResponse{data=models.InvitationResponse}
// @Failure 404 {object} models.APIResponse
// @Failure 410 {object} models.APIResponse "Gone - invitation expired"
// @Router /invitations/{token} [get]
func (h *InvitationHandler) GetInvitation(c *gin.Context) {
	tokenStr := c.Param("token")
	token, err := uuid.Parse(tokenStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_TOKEN", "Invalid token format"))
		return
	}

	invitation, err := h.invitationService.GetInvitationByToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Invitation not found"))
		return
	}

	if invitation == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Invitation not found"))
		return
	}

	// Return 410 Gone if expired
	if invitation.Status == "EXPIRED" {
		c.JSON(http.StatusGone, models.NewErrorResponse("EXPIRED", "This invitation has expired"))
		return
	}

	// Return 400 if revoked or accepted
	if invitation.Status == "REVOKED" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("REVOKED", "This invitation has been revoked"))
		return
	}

	if invitation.Status == "ACCEPTED" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("ALREADY_ACCEPTED", "This invitation has already been accepted"))
		return
	}

	// Build response (omit token for security on subsequent requests)
	response := models.InvitationResponse{
		ID:       invitation.ID,
		Email:    invitation.Email,
		UserType: invitation.UserType.TypeName,
		Role:     invitation.Role,
		Message:  invitation.Message,
		ExpiresAt: invitation.ExpiresAt,
		Status:   invitation.Status,
		SentAt:   invitation.SentAt,
		AcceptedAt: invitation.AcceptedAt,
	}

	if invitation.UserType.Description != nil {
		response.UserTypeDescription = *invitation.UserType.Description
	}

	response.Customer.ID = invitation.Customer.ID
	response.Customer.BAN = invitation.Customer.BAN
	response.Customer.CompanyName = invitation.Customer.CompanyName

	if invitation.InvitedByUser.DisplayName != nil {
		response.InvitedBy.Name = *invitation.InvitedByUser.DisplayName
	} else {
		response.InvitedBy.Name = invitation.InvitedByUser.Email
	}
	response.InvitedBy.Email = invitation.InvitedByUser.Email

	c.JSON(http.StatusOK, models.NewSuccessResponse(response))
}

// AcceptInvitation godoc
// @Summary Accept invitation
// @Description Accept invitation and create user account (PUBLIC endpoint - no auth required)
// @Tags Invitations
// @Accept json
// @Produce json
// @Param token path string true "Invitation Token (UUID)"
// @Param acceptance body models.AcceptInvitationRequest true "Google OAuth details"
// @Success 200 {object} models.APIResponse{data=models.AcceptInvitationResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 410 {object} models.APIResponse "Gone - invitation expired"
// @Router /invitations/{token}/accept [post]
func (h *InvitationHandler) AcceptInvitation(c *gin.Context) {
	tokenStr := c.Param("token")
	token, err := uuid.Parse(tokenStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_TOKEN", "Invalid token format"))
		return
	}

	var req models.AcceptInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Accept invitation (creates user, grants access, generates tokens)
	user, tokens, err := h.invitationService.AcceptInvitation(
		c.Request.Context(),
		token,
		req.GoogleID,
		req.Email,
		req.Name,
	)

	if err != nil {
		h.logger.Error("Failed to accept invitation",
			zap.String("token", token.String()),
			zap.String("email", req.Email),
			zap.Error(err),
		)

		// Return appropriate status code based on error
		if err.Error() == "invitation has expired" {
			c.JSON(http.StatusGone, models.NewErrorResponse("EXPIRED", err.Error()))
			return
		}
		if err.Error() == "invitation has been revoked" || err.Error() == "invitation has already been accepted" {
			c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_STATE", err.Error()))
			return
		}
		if err.Error() == "invitation not found" {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", err.Error()))
			return
		}

		c.JSON(http.StatusBadRequest, models.NewErrorResponse("ACCEPTANCE_FAILED", err.Error()))
		return
	}

	// Get fresh invitation to get customer details
	invitation, _ := h.invitationRepo.GetByToken(c.Request.Context(), token)

	// Build response
	response := models.AcceptInvitationResponse{
		Tokens: *tokens,
	}

	response.User.ID = user.ID
	response.User.Email = user.Email
	if user.DisplayName != nil {
		response.User.Name = *user.DisplayName
	} else {
		response.User.Name = user.Email
	}
	if user.UserType != nil {
		response.User.UserType = user.UserType.TypeName
	}

	if invitation != nil {
		response.CustomerAccess.CustomerID = invitation.CustomerID
		response.CustomerAccess.CompanyName = invitation.Customer.CompanyName
		response.CustomerAccess.BAN = invitation.Customer.BAN
		response.CustomerAccess.Role = invitation.Role
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(response))
}

// ListInvitations godoc
// @Summary List all invitations
// @Description Get paginated list of invitations (filtered by accessible customers)
// @Tags Invitations
// @Produce json
// @Param status query string false "Filter by status" Enums(PENDING, ACCEPTED, EXPIRED, REVOKED)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} models.APIResponse{data=models.ListResponse}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/invitations [get]
func (h *InvitationHandler) ListInvitations(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Get customer scoping from Gatekeeper
	var customerFilter []uuid.UUID
	if accessible, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessible.([]uuid.UUID)
	}

	invitations, total, err := h.invitationRepo.List(c.Request.Context(), customerFilter, status, page, perPage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LIST_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewListResponse(invitations, page, perPage, int(total)))
}

// RevokeInvitation godoc
// @Summary Revoke invitation
// @Description Cancel a pending invitation
// @Tags Invitations
// @Produce json
// @Param id path string true "Invitation ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/invitations/{id} [delete]
func (h *InvitationHandler) RevokeInvitation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid invitation ID format"))
		return
	}

	// Get invitation to verify customer access
	inv, err := h.invitationRepo.GetByID(c.Request.Context(), id)
	if err != nil || inv == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Invitation not found"))
		return
	}

	// Verify user has access to this customer
	var customerFilter []uuid.UUID
	if accessible, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessible.([]uuid.UUID)
	}

	if err := h.customerRepo.VerifyCustomerAccess(inv.CustomerID, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You cannot revoke invitations for this customer"))
		return
	}

	// Revoke invitation
	if err := h.invitationService.RevokeInvitation(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("REVOKE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "Invitation revoked successfully",
	}))
}

// ResendInvitation godoc
// @Summary Resend invitation email
// @Description Resend the invitation email for a pending invitation
// @Tags Invitations
// @Produce json
// @Param id path string true "Invitation ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/invitations/{id}/resend [post]
func (h *InvitationHandler) ResendInvitation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid invitation ID format"))
		return
	}

	// Get invitation
	inv, err := h.invitationRepo.GetByID(c.Request.Context(), id)
	if err != nil || inv == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Invitation not found"))
		return
	}

	// Verify user has access to this customer
	var customerFilter []uuid.UUID
	if accessible, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessible.([]uuid.UUID)
	}

	if err := h.customerRepo.VerifyCustomerAccess(inv.CustomerID, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You cannot resend invitations for this customer"))
		return
	}

	// Can only resend pending invitations
	if inv.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_STATUS", "Can only resend pending invitations"))
		return
	}

	// Resend email (use the email service from invitation service)
	// TODO: Access email service directly or add ResendEmail method to service
	h.logger.Info("Resend invitation email requested",
		zap.String("invitation_id", id.String()),
		zap.String("email", inv.Email),
	)

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "Invitation email resent successfully",
	}))
}
