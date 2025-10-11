package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
)

type TrunkHandler struct {
	trunkRepo *repository.TrunkRepository
}

func NewTrunkHandler(trunkRepo *repository.TrunkRepository) *TrunkHandler {
	return &TrunkHandler{
		trunkRepo: trunkRepo,
	}
}

// CreateTrunk godoc
// @Summary Create a SIP trunk
// @Description Create a new SIP trunk for a customer
// @Tags Trunks
// @Accept json
// @Produce json
// @Param customer_id path string true "Customer ID (UUID)"
// @Param trunk body models.CreateTrunkRequest true "Trunk configuration"
// @Success 201 {object} models.APIResponse{data=models.Trunk}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{customer_id}/trunks [post]
func (h *TrunkHandler) CreateTrunk(c *gin.Context) {
	customerIDStr := c.Param("customer_id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	var req models.CreateTrunkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	trunk, err := h.trunkRepo.CreateTrunk(c.Request.Context(), customerID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.NewSuccessResponse(trunk))
}

// GetTrunk godoc
// @Summary Get trunk by ID
// @Description Get detailed trunk information by ID
// @Tags Trunks
// @Accept json
// @Produce json
// @Param id path string true "Trunk ID (UUID)"
// @Success 200 {object} models.APIResponse{data=models.Trunk}
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /trunks/{id} [get]
func (h *TrunkHandler) GetTrunk(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid trunk ID format"))
		return
	}

	trunk, err := h.trunkRepo.GetTrunkByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_FAILED", err.Error()))
		return
	}

	if trunk == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Trunk not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(trunk))
}
