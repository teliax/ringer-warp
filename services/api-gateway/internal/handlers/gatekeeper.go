package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/gatekeeper"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
)

type GatekeeperHandler struct {
	gatekeeper *gatekeeper.Gatekeeper
	userRepo   *repository.UserRepository
}

func NewGatekeeperHandler(gk *gatekeeper.Gatekeeper, userRepo *repository.UserRepository) *GatekeeperHandler {
	return &GatekeeperHandler{
		gatekeeper: gk,
		userRepo:   userRepo,
	}
}

// CheckAccess godoc
// @Summary Check resource access
// @Description Check if current user has permission to access a specific resource
// @Tags Gatekeeper
// @Accept json
// @Produce json
// @Param request body models.GatekeeperCheckRequest true "Resource path to check"
// @Success 200 {object} models.APIResponse{data=models.GatekeeperCheckResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /gatekeeper/check-access [post]
func (h *GatekeeperHandler) CheckAccess(c *gin.Context) {
	var req models.GatekeeperCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	userIDUUID := c.MustGet("user_id_uuid").(uuid.UUID)
	userTypeIDUUID := c.MustGet("user_type_id_uuid").(uuid.UUID)

	result, err := h.gatekeeper.CheckAccess(
		c.Request.Context(),
		userIDUUID,
		userTypeIDUUID,
		req.ResourcePath,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CHECK_FAILED", err.Error()))
		return
	}

	response := &models.GatekeeperCheckResponse{
		Allowed:               result.Allowed,
		UserType:              result.UserType,
		AccessibleCustomerIDs: result.AccessibleCustomers,
		HasWildcardPermission: result.HasWildcard,
		Reason:                result.Reason,
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(response))
}

// GetMyPermissions godoc
// @Summary Get current user permissions
// @Description Get complete permission information for the authenticated user
// @Tags Gatekeeper
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=models.UserPermissions}
// @Failure 401 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /gatekeeper/my-permissions [get]
func (h *GatekeeperHandler) GetMyPermissions(c *gin.Context) {
	userIDUUID := c.MustGet("user_id_uuid").(uuid.UUID)
	userTypeIDUUID := c.MustGet("user_type_id_uuid").(uuid.UUID)
	email := c.GetString("email")

	// Get complete permission info
	permInfo, err := h.gatekeeper.GetUserPermissions(c.Request.Context(), userIDUUID, userTypeIDUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	// Get customer access details
	customerAccess, err := h.userRepo.GetUserCustomerAccess(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", "Failed to get customer access"))
		return
	}

	response := &models.UserPermissions{
		UserID:             userIDUUID,
		Email:              email,
		UserType:           permInfo.UserType,
		HasWildcard:        permInfo.HasWildcard,
		Permissions:        permInfo.Permissions,
		CustomerAccess:     customerAccess,
		AccessibleCustomers: permInfo.AccessibleCustomers,
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(response))
}

// CheckAccessBatch godoc
// @Summary Check multiple resource permissions
// @Description Check access to multiple resources in one request
// @Tags Gatekeeper
// @Accept json
// @Produce json
// @Param request body models.GatekeeperBatchCheckRequest true "List of resource paths"
// @Success 200 {object} models.APIResponse{data=map[string]bool}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /gatekeeper/check-access-batch [post]
func (h *GatekeeperHandler) CheckAccessBatch(c *gin.Context) {
	var req models.GatekeeperBatchCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	userIDUUID := c.MustGet("user_id_uuid").(uuid.UUID)
	userTypeIDUUID := c.MustGet("user_type_id_uuid").(uuid.UUID)

	results, err := h.gatekeeper.CheckAccessBatch(
		c.Request.Context(),
		userIDUUID,
		userTypeIDUUID,
		req.ResourcePaths,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CHECK_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(results))
}

// GetAvailablePermissions godoc
// @Summary Get all available permissions
// @Description Get all available permissions with metadata (for role management UI)
// @Tags Gatekeeper
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]gatekeeper.PermissionMetadata}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /gatekeeper/available-permissions [get]
func (h *GatekeeperHandler) GetAvailablePermissions(c *gin.Context) {
	metadata, err := h.gatekeeper.PermRepo.GetAllPermissionMetadata(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(metadata))
}
