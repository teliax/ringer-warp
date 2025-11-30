package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
)

type UserTypeHandler struct {
	userTypeRepo *repository.UserTypeRepository
	userRepo     *repository.UserRepository
}

func NewUserTypeHandler(userTypeRepo *repository.UserTypeRepository, userRepo *repository.UserRepository) *UserTypeHandler {
	return &UserTypeHandler{
		userTypeRepo: userTypeRepo,
		userRepo:     userRepo,
	}
}

// ListUserTypes godoc
// @Summary List all user types
// @Description Get all user types with permission counts and user counts
// @Tags User Types
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]models.UserTypeResponse}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types [get]
func (h *UserTypeHandler) ListUserTypes(c *gin.Context) {
	userTypes, err := h.userTypeRepo.ListAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(userTypes))
}

// GetUserType godoc
// @Summary Get user type by ID
// @Description Get detailed user type information including permissions
// @Tags User Types
// @Produce json
// @Param id path string true "User Type ID"
// @Success 200 {object} models.APIResponse{data=models.UserTypeResponse}
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types/{id} [get]
func (h *UserTypeHandler) GetUserType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid user type ID"))
		return
	}

	userType, err := h.userTypeRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "User type not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(userType))
}

// CreateUserType godoc
// @Summary Create new user type
// @Description Create a new user type with specified name and description
// @Tags User Types
// @Accept json
// @Produce json
// @Param request body models.CreateUserTypeRequest true "User type details"
// @Success 201 {object} models.APIResponse{data=models.UserTypeResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 409 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types [post]
func (h *UserTypeHandler) CreateUserType(c *gin.Context) {
	var req models.CreateUserTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get current user from context for created_by
	email := c.GetString("email")

	userType, err := h.userTypeRepo.Create(c.Request.Context(), req.TypeName, req.Description, email)
	if err != nil {
		if err.Error() == "user type already exists" {
			c.JSON(http.StatusConflict, models.NewErrorResponse("ALREADY_EXISTS", "User type with this name already exists"))
			return
		}
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.NewSuccessResponse(userType))
}

// UpdateUserType godoc
// @Summary Update user type
// @Description Update user type name and/or description
// @Tags User Types
// @Accept json
// @Produce json
// @Param id path string true "User Type ID"
// @Param request body models.CreateUserTypeRequest true "Updated details"
// @Success 200 {object} models.APIResponse{data=models.UserTypeResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 409 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types/{id} [put]
func (h *UserTypeHandler) UpdateUserType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid user type ID"))
		return
	}

	var req models.CreateUserTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	userType, err := h.userTypeRepo.Update(c.Request.Context(), id, req.TypeName, req.Description)
	if err != nil {
		if err.Error() == "user type not found" {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "User type not found"))
			return
		}
		if err.Error() == "user type already exists" {
			c.JSON(http.StatusConflict, models.NewErrorResponse("ALREADY_EXISTS", "User type with this name already exists"))
			return
		}
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(userType))
}

// DeleteUserType godoc
// @Summary Delete user type
// @Description Delete a user type (only if no users are assigned and not wildcard type)
// @Tags User Types
// @Produce json
// @Param id path string true "User Type ID"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 409 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types/{id} [delete]
func (h *UserTypeHandler) DeleteUserType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid user type ID"))
		return
	}

	err = h.userTypeRepo.Delete(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "user type not found" {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "User type not found"))
			return
		}
		if err.Error() == "cannot delete user type with assigned users" {
			c.JSON(http.StatusConflict, models.NewErrorResponse("HAS_USERS", "Cannot delete user type with assigned users"))
			return
		}
		if err.Error() == "cannot delete wildcard user type" {
			c.JSON(http.StatusConflict, models.NewErrorResponse("WILDCARD_TYPE", "Cannot delete user type with wildcard permission"))
			return
		}
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(map[string]string{
		"message": "User type deleted successfully",
	}))
}

// GetUserTypePermissions godoc
// @Summary Get permissions for a user type
// @Description Get all permissions assigned to a user type
// @Tags User Types
// @Produce json
// @Param id path string true "User Type ID"
// @Success 200 {object} models.APIResponse{data=[]string}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types/{id}/permissions [get]
func (h *UserTypeHandler) GetUserTypePermissions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid user type ID"))
		return
	}

	permissions, err := h.userTypeRepo.GetPermissions(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(permissions))
}

// UpdateUserTypePermissions godoc
// @Summary Update permissions for a user type
// @Description Replace all permissions for a user type with new set
// @Tags User Types
// @Accept json
// @Produce json
// @Param id path string true "User Type ID"
// @Param request body models.UpdatePermissionsRequest true "Permission paths"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types/{id}/permissions [put]
func (h *UserTypeHandler) UpdateUserTypePermissions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid user type ID"))
		return
	}

	var req models.UpdatePermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	err = h.userTypeRepo.UpdatePermissions(c.Request.Context(), id, req.ResourcePaths)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(map[string]string{
		"message": "Permissions updated successfully",
	}))
}

// GetUsersByType godoc
// @Summary Get users assigned to a user type
// @Description Get all users that have this user type
// @Tags User Types
// @Produce json
// @Param id path string true "User Type ID"
// @Success 200 {object} models.APIResponse{data=[]models.User}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/user-types/{id}/users [get]
func (h *UserTypeHandler) GetUsersByType(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid user type ID"))
		return
	}

	users, err := h.userRepo.GetByUserType(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(users))
}
