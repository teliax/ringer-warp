package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/tcr"
	"go.uber.org/zap"
)

type TCREnumerationHandler struct {
	tcrClient *tcr.Client
	logger    *zap.Logger
}

func NewTCREnumerationHandler(
	tcrClient *tcr.Client,
	logger *zap.Logger,
) *TCREnumerationHandler {
	return &TCREnumerationHandler{
		tcrClient: tcrClient,
		logger:    logger,
	}
}

// GetUseCases godoc
// @Summary Get campaign use cases
// @Description Get list of available campaign use cases from TCR
// @Tags TCR/Enumerations
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]models.UseCaseInfo}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/use-cases [get]
func (h *TCREnumerationHandler) GetUseCases(c *gin.Context) {
	// Try to get from TCR API
	useCases, err := h.tcrClient.GetUseCases(c.Request.Context())
	if err != nil {
		h.logger.Warn("Failed to get use cases from TCR, using static list", zap.Error(err))
		// Fallback to static list
		staticUseCases := tcr.GetStaticUseCases()
		useCaseInfos := make([]models.UseCaseInfo, len(staticUseCases))
		for i, uc := range staticUseCases {
			useCaseInfos[i] = models.UseCaseInfo{
				Code:        uc.Code,
				DisplayName: uc.DisplayName,
				Description: uc.Description,
				Difficulty:  getDifficultyForUseCase(uc.Code),
				MinSamples:  getMinSamplesForUseCase(uc.Code),
			}
		}
		c.JSON(http.StatusOK, models.NewSuccessResponse(useCaseInfos))
		return
	}

	// Convert TCR response to our model
	useCaseInfos := make([]models.UseCaseInfo, len(useCases))
	for i, uc := range useCases {
		useCaseInfos[i] = models.UseCaseInfo{
			Code:        uc.Code,
			DisplayName: uc.DisplayName,
			Description: uc.Description,
			Difficulty:  getDifficultyForUseCase(uc.Code),
			MinSamples:  getMinSamplesForUseCase(uc.Code),
		}
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(useCaseInfos))
}

// GetEntityTypes godoc
// @Summary Get brand entity types
// @Description Get list of valid entity types for brand registration
// @Tags TCR/Enumerations
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]models.EntityTypeInfo}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/entity-types [get]
func (h *TCREnumerationHandler) GetEntityTypes(c *gin.Context) {
	// Try to get from TCR API
	entityTypes, err := h.tcrClient.GetEntityTypes(c.Request.Context())
	if err != nil {
		h.logger.Warn("Failed to get entity types from TCR, using static list", zap.Error(err))
		// Fallback to static list
		staticTypes := tcr.GetStaticEntityTypes()
		typeInfos := make([]models.EntityTypeInfo, len(staticTypes))
		for i, et := range staticTypes {
			typeInfos[i] = models.EntityTypeInfo{
				Code:        et.Code,
				DisplayName: et.DisplayName,
				Description: et.Description,
			}
		}
		c.JSON(http.StatusOK, models.NewSuccessResponse(typeInfos))
		return
	}

	// Convert TCR response to our model
	typeInfos := make([]models.EntityTypeInfo, len(entityTypes))
	for i, et := range entityTypes {
		typeInfos[i] = models.EntityTypeInfo{
			Code:        et.Code,
			DisplayName: et.DisplayName,
			Description: et.Description,
		}
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(typeInfos))
}

// GetVerticals godoc
// @Summary Get industry verticals
// @Description Get list of industry verticals for brand registration
// @Tags TCR/Enumerations
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]models.VerticalInfo}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/verticals [get]
func (h *TCREnumerationHandler) GetVerticals(c *gin.Context) {
	// Try to get from TCR API
	verticals, err := h.tcrClient.GetVerticals(c.Request.Context())
	if err != nil {
		h.logger.Warn("Failed to get verticals from TCR, using static list", zap.Error(err))
		// Fallback to static list
		staticVerticals := tcr.GetStaticVerticals()
		verticalInfos := make([]models.VerticalInfo, len(staticVerticals))
		for i, v := range staticVerticals {
			verticalInfos[i] = models.VerticalInfo{
				Code:        v.Code,
				DisplayName: v.DisplayName,
			}
		}
		c.JSON(http.StatusOK, models.NewSuccessResponse(verticalInfos))
		return
	}

	// Convert TCR response to our model
	verticalInfos := make([]models.VerticalInfo, len(verticals))
	for i, v := range verticals {
		verticalInfos[i] = models.VerticalInfo{
			Code:        v.Code,
			DisplayName: v.DisplayName,
		}
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(verticalInfos))
}

// GetCarriers godoc
// @Summary Get mobile carriers
// @Description Get list of participating mobile network operators (MNOs)
// @Tags TCR/Enumerations
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=[]models.MNOInfo}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/carriers [get]
func (h *TCREnumerationHandler) GetCarriers(c *gin.Context) {
	// Try to get from TCR API
	mnos, err := h.tcrClient.GetMNOs(c.Request.Context())
	if err != nil {
		h.logger.Warn("Failed to get MNOs from TCR, using static list", zap.Error(err))
		// Fallback to static list
		staticMNOs := tcr.GetStaticMNOs()
		mnoInfos := make([]models.MNOInfo, len(staticMNOs))
		for i, m := range staticMNOs {
			mnoInfos[i] = models.MNOInfo{
				MNOID: m.MNOID,
				Name:  m.Name,
			}
		}
		c.JSON(http.StatusOK, models.NewSuccessResponse(mnoInfos))
		return
	}

	// Convert TCR response to our model
	mnoInfos := make([]models.MNOInfo, len(mnos))
	for i, m := range mnos {
		mnoInfos[i] = models.MNOInfo{
			MNOID: m.MNOID,
			Name:  m.Name,
		}
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(mnoInfos))
}

// GetUseCaseRequirements godoc
// @Summary Get use case requirements
// @Description Get detailed requirements for a specific campaign use case
// @Tags TCR/Enumerations
// @Accept json
// @Produce json
// @Param use_case query string true "Use case code"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/use-case-requirements [get]
func (h *TCREnumerationHandler) GetUseCaseRequirements(c *gin.Context) {
	useCase := c.Query("use_case")
	if useCase == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("MISSING_PARAM", "use_case parameter is required"))
		return
	}

	// Validate use case
	if !tcr.ValidateUseCase(useCase) {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_USE_CASE", "Invalid use case code"))
		return
	}

	// Get requirements
	requirements := tcr.GetUseCaseRequirements(useCase)

	c.JSON(http.StatusOK, models.NewSuccessResponse(requirements))
}

// GetThroughputEstimate godoc
// @Summary Get throughput estimate
// @Description Estimate throughput limits based on brand trust score
// @Tags TCR/Enumerations
// @Accept json
// @Produce json
// @Param trust_score query int true "Brand trust score (0-100)"
// @Param vetted query bool false "Is brand externally vetted"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Security BearerAuth
// @Router /messaging/throughput-estimate [get]
func (h *TCREnumerationHandler) GetThroughputEstimate(c *gin.Context) {
	trustScoreStr := c.Query("trust_score")
	vettedStr := c.DefaultQuery("vetted", "false")

	if trustScoreStr == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("MISSING_PARAM", "trust_score parameter is required"))
		return
	}

	var trustScore int
	if _, err := fmt.Sscanf(trustScoreStr, "%d", &trustScore); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_PARAM", "trust_score must be an integer"))
		return
	}

	vetted := vettedStr == "true"

	// Get throughput limits
	limits := tcr.GetThroughputLimits(trustScore, vetted)

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"trust_score":         trustScore,
		"vetted":              vetted,
		"messages_per_second": limits["messagesPerSecond"],
		"daily_cap":           limits["dailyCap"],
		"recommendation":      getThroughputRecommendation(trustScore, vetted),
	}))
}

// Helper functions

func getDifficultyForUseCase(useCase string) string {
	switch useCase {
	case "2FA", "ACCOUNT_NOTIFICATION", "CUSTOMER_CARE", "DELIVERY_NOTIFICATION",
		"FRAUD_ALERT", "SECURITY_ALERT", "PUBLIC_SERVICE_ANNOUNCEMENT":
		return "EASY"
	case "MARKETING", "POLLING_VOTING", "CHARITY":
		return "MEDIUM"
	case "POLITICAL", "SWEEPSTAKE":
		return "HARD"
	default:
		return "EASY"
	}
}

func getMinSamplesForUseCase(useCase string) int {
	switch useCase {
	case "2FA", "DELIVERY_NOTIFICATION", "FRAUD_ALERT", "SECURITY_ALERT", "PUBLIC_SERVICE_ANNOUNCEMENT":
		return 2
	case "ACCOUNT_NOTIFICATION", "CUSTOMER_CARE", "POLLING_VOTING":
		return 3
	case "MARKETING", "CHARITY", "POLITICAL", "SWEEPSTAKE":
		return 5
	default:
		return 3
	}
}

func getThroughputRecommendation(trustScore int, vetted bool) string {
	if vetted {
		return "Excellent throughput - suitable for high-volume messaging (200,000+ msg/day)"
	}
	if trustScore >= 75 {
		return "Good throughput - suitable for medium-volume messaging (40,000 msg/day)"
	}
	if trustScore >= 50 {
		return "Limited throughput - suitable for low-volume messaging (6,000 msg/day)"
	}
	return "Very limited throughput - consider external vetting to increase limits (2,000-3,000 msg/day)"
}
