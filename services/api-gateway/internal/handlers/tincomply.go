package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/tincomply"
	"go.uber.org/zap"
)

type TinComplyHandler struct {
	client *tincomply.Client
	logger *zap.Logger
}

func NewTinComplyHandler(client *tincomply.Client, logger *zap.Logger) *TinComplyHandler {
	return &TinComplyHandler{
		client: client,
		logger: logger,
	}
}

// LookupEIN godoc
// @Summary Lookup company by EIN
// @Description Retrieve company information from TinComply using EIN/Tax ID
// @Tags TinComply
// @Accept json
// @Produce json
// @Param ein query string true "EIN/Tax ID (9 digits, with or without hyphen)"
// @Success 200 {object} models.APIResponse{data=tincomply.EINLookupResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /tincomply/lookup-ein [get]
func (h *TinComplyHandler) LookupEIN(c *gin.Context) {
	ein := c.Query("ein")
	if ein == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("EIN_REQUIRED", "EIN parameter is required"))
		return
	}

	// Clean and validate EIN format
	ein = strings.ReplaceAll(ein, "-", "")
	ein = strings.TrimSpace(ein)

	if !tincomply.ValidateEIN(ein) {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_EIN", "EIN must be 9 digits"))
		return
	}

	// Call TinComply API
	h.logger.Info("Looking up EIN", zap.String("ein", tincomply.FormatEIN(ein)))
	result, err := h.client.LookupCompanyByEIN(c.Request.Context(), ein)
	if err != nil {
		h.logger.Error("Failed to lookup EIN", zap.Error(err), zap.String("ein", ein))

		// Check if it's an API error
		if apiErr, ok := err.(*tincomply.APIError); ok {
			c.JSON(apiErr.StatusCode, models.NewErrorResponse("TINCOMPLY_ERROR", apiErr.Message))
			return
		}

		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LOOKUP_FAILED", "Failed to lookup EIN"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(result))
}

// VerifyTINName godoc
// @Summary Verify TIN and company name match
// @Description Verify that a TIN matches the provided company name using IRS TIN-Name matching
// @Tags TinComply
// @Accept json
// @Produce json
// @Param request body tincomply.TINNameMatchRequest true "TIN and company name"
// @Success 200 {object} models.APIResponse{data=tincomply.TINNameMatchResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /tincomply/verify-tin-name [post]
func (h *TinComplyHandler) VerifyTINName(c *gin.Context) {
	var req tincomply.TINNameMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Clean and validate TIN
	req.TIN = strings.ReplaceAll(req.TIN, "-", "")
	req.TIN = strings.TrimSpace(req.TIN)

	if !tincomply.ValidateEIN(req.TIN) {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_TIN", "TIN must be 9 digits"))
		return
	}

	if strings.TrimSpace(req.CompanyName) == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("COMPANY_NAME_REQUIRED", "Company name is required"))
		return
	}

	// Call TinComply API
	h.logger.Info("Verifying TIN and name",
		zap.String("tin", tincomply.FormatEIN(req.TIN)),
		zap.String("company_name", req.CompanyName))

	result, err := h.client.VerifyTINAndName(c.Request.Context(), req.TIN, req.CompanyName)
	if err != nil {
		h.logger.Error("Failed to verify TIN and name", zap.Error(err))

		if apiErr, ok := err.(*tincomply.APIError); ok {
			c.JSON(apiErr.StatusCode, models.NewErrorResponse("TINCOMPLY_ERROR", apiErr.Message))
			return
		}

		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("VERIFICATION_FAILED", "Failed to verify TIN and name"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(result))
}

// LookupCompanyDetails godoc
// @Summary Lookup company details by name and address
// @Description Retrieve detailed company information using company name and optional address
// @Tags TinComply
// @Accept json
// @Produce json
// @Param request body tincomply.CompanyDetailsRequest true "Company name and address"
// @Success 200 {object} models.APIResponse{data=tincomply.CompanyDetailsResponse}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /tincomply/lookup-company-details [post]
func (h *TinComplyHandler) LookupCompanyDetails(c *gin.Context) {
	var req tincomply.CompanyDetailsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	if strings.TrimSpace(req.CompanyName) == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("COMPANY_NAME_REQUIRED", "Company name is required"))
		return
	}

	// Call TinComply API
	h.logger.Info("Looking up company details", zap.String("company_name", req.CompanyName))
	result, err := h.client.LookupCompanyDetails(c.Request.Context(), &req)
	if err != nil {
		h.logger.Error("Failed to lookup company details", zap.Error(err))

		if apiErr, ok := err.(*tincomply.APIError); ok {
			c.JSON(apiErr.StatusCode, models.NewErrorResponse("TINCOMPLY_ERROR", apiErr.Message))
			return
		}

		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LOOKUP_FAILED", "Failed to lookup company details"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(result))
}

// ValidateEINFormat godoc
// @Summary Validate EIN format
// @Description Check if an EIN is in valid format (9 digits) without calling external API
// @Tags TinComply
// @Accept json
// @Produce json
// @Param ein query string true "EIN to validate"
// @Success 200 {object} models.APIResponse{data=map[string]interface{}}
// @Failure 400 {object} models.APIResponse
// @Security BearerAuth
// @Router /tincomply/validate-ein-format [get]
func (h *TinComplyHandler) ValidateEINFormat(c *gin.Context) {
	ein := c.Query("ein")
	if ein == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("EIN_REQUIRED", "EIN parameter is required"))
		return
	}

	isValid := tincomply.ValidateEIN(ein)
	formatted := ""
	if isValid {
		formatted = tincomply.FormatEIN(ein)
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"valid":     isValid,
		"formatted": formatted,
		"message":   func() string {
			if isValid {
				return "EIN format is valid"
			}
			return "EIN must be exactly 9 digits"
		}(),
	}))
}
