package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
)

type VendorHandler struct {
	vendorRepo *repository.VendorRepository
}

func NewVendorHandler(vendorRepo *repository.VendorRepository) *VendorHandler {
	return &VendorHandler{
		vendorRepo: vendorRepo,
	}
}

// CreateVoiceVendor godoc
// @Summary Create a voice vendor
// @Description Add a new upstream voice vendor for call routing
// @Tags Voice Vendors
// @Accept json
// @Produce json
// @Param vendor body models.CreateVoiceVendorRequest true "Voice vendor configuration"
// @Success 201 {object} models.APIResponse{data=models.VoiceVendor}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/voice-vendors [post]
func (h *VendorHandler) CreateVoiceVendor(c *gin.Context) {
	var req models.CreateVoiceVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	vendor, err := h.vendorRepo.CreateVoiceVendor(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.NewSuccessResponse(vendor))
}

// ListVoiceVendors godoc
// @Summary List voice vendors
// @Description Get all configured voice vendors
// @Tags Voice Vendors
// @Accept json
// @Produce json
// @Param active_only query boolean false "Only return active vendors"
// @Success 200 {object} models.APIResponse{data=[]models.VoiceVendor}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/voice-vendors [get]
func (h *VendorHandler) ListVoiceVendors(c *gin.Context) {
	activeOnly := c.Query("active_only") == "true"

	vendors, err := h.vendorRepo.ListVoiceVendors(c.Request.Context(), activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LIST_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(vendors))
}

// CreateSMSVendor godoc
// @Summary Create an SMS vendor
// @Description Add a new SMPP vendor for SMS routing
// @Tags SMS Vendors
// @Accept json
// @Produce json
// @Param vendor body models.CreateSMSVendorRequest true "SMS vendor configuration"
// @Success 201 {object} models.APIResponse{data=models.SMSVendor}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/sms-vendors [post]
func (h *VendorHandler) CreateSMSVendor(c *gin.Context) {
	var req models.CreateSMSVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	vendor, err := h.vendorRepo.CreateSMSVendor(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.NewSuccessResponse(vendor))
}

// ListSMSVendors godoc
// @Summary List SMS vendors
// @Description Get all configured SMS vendors
// @Tags SMS Vendors
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]models.SMSVendor}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /admin/sms-vendors [get]
func (h *VendorHandler) ListSMSVendors(c *gin.Context) {
	vendors, err := h.vendorRepo.ListSMSVendors(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LIST_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(vendors))
}
