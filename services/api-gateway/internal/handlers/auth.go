package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/auth"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	log "go.uber.org/zap"
)

type AuthHandler struct {
	oauthVerifier *auth.GoogleOAuthVerifier
	jwtService    *auth.JWTService
	userRepo      *repository.UserRepository
	logger        *log.Logger
}

func NewAuthHandler(
	oauthVerifier *auth.GoogleOAuthVerifier,
	jwtService *auth.JWTService,
	userRepo *repository.UserRepository,
	logger *log.Logger,
) *AuthHandler {
	return &AuthHandler{
		oauthVerifier: oauthVerifier,
		jwtService:    jwtService,
		userRepo:      userRepo,
		logger:        logger,
	}
}

// ExchangeGoogleToken godoc
// @Summary Exchange Google OAuth token for WARP JWT tokens
// @Description Verify Google ID token and issue WARP access and refresh tokens
// @Tags Authentication
// @Accept json
// @Produce json
// @Param request body models.GoogleTokenExchangeRequest true "Google ID token"
// @Success 200 {object} models.APIResponse{data=models.AuthTokens}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Router /auth/exchange [post]
func (h *AuthHandler) ExchangeGoogleToken(c *gin.Context) {
	var req models.GoogleTokenExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Verify Google ID token
	tokenInfo, err := h.oauthVerifier.VerifyIDToken(c.Request.Context(), req.IDToken)
	if err != nil {
		h.logger.Warn("Failed to verify Google token", log.Error(err))
		c.JSON(http.StatusUnauthorized, models.NewErrorResponse("INVALID_GOOGLE_TOKEN", "Failed to verify Google token"))
		return
	}

	// Look up user by Google ID
	user, err := h.userRepo.GetByGoogleID(c.Request.Context(), tokenInfo.Sub)
	if err != nil {
		h.logger.Error("Failed to lookup user", log.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LOOKUP_FAILED", "Failed to lookup user"))
		return
	}

	// If user doesn't exist, auto-create with viewer role (least privilege)
	if user == nil {
		h.logger.Info("Auto-creating new user from Google login",
			log.String("google_id", tokenInfo.Sub),
			log.String("email", tokenInfo.Email),
			log.String("name", tokenInfo.Name),
		)

		// Get default user type (viewer - can be upgraded by admin later)
		defaultUserTypeID, err := h.userRepo.GetUserTypeIDByName(c.Request.Context(), "viewer")
		if err != nil {
			h.logger.Error("Failed to get default user type", log.Error(err))
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("USER_TYPE_NOT_FOUND", "Failed to create user account"))
			return
		}

		// Create new user
		user, err = h.userRepo.Create(
			c.Request.Context(),
			tokenInfo.Sub,           // Google ID
			tokenInfo.Email,         // Email
			tokenInfo.Name,          // Display name
			defaultUserTypeID,       // Default to viewer
		)
		if err != nil {
			h.logger.Error("Failed to create user", log.Error(err))
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("USER_CREATION_FAILED", "Failed to create user account"))
			return
		}

		// Load user type info
		user.UserType = &models.UserType{TypeName: "viewer"}

		h.logger.Info("User auto-created successfully",
			log.String("user_id", user.ID.String()),
			log.String("email", user.Email),
		)
	}

	// Check if user is active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("USER_INACTIVE", "User account is inactive"))
		return
	}

	// Update last login
	if err := h.userRepo.UpdateLastLogin(c.Request.Context(), user.ID); err != nil {
		h.logger.Warn("Failed to update last login", log.Error(err))
	}

	// Generate access token
	accessToken, err := h.jwtService.GenerateAccessToken(
		user.ID,
		user.Email,
		user.UserTypeID,
		user.UserType.TypeName,
	)
	if err != nil {
		h.logger.Error("Failed to generate access token", log.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("TOKEN_GENERATION_FAILED", "Failed to generate token"))
		return
	}

	// Generate refresh token
	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID)
	if err != nil {
		h.logger.Error("Failed to generate refresh token", log.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("TOKEN_GENERATION_FAILED", "Failed to generate refresh token"))
		return
	}

	h.logger.Info("User logged in successfully",
		log.String("user_id", user.ID.String()),
		log.String("email", user.Email),
		log.String("user_type", user.UserType.TypeName),
	)

	// Return tokens
	c.JSON(http.StatusOK, models.NewSuccessResponse(&models.AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    24 * 3600, // 24 hours in seconds
	}))
}

// RefreshToken godoc
// @Summary Refresh access token
// @Description Exchange refresh token for new access token
// @Tags Authentication
// @Accept json
// @Produce json
// @Param request body models.RefreshTokenRequest true "Refresh token"
// @Success 200 {object} models.APIResponse{data=models.AuthTokens}
// @Failure 400 {object} models.APIResponse
// @Failure 401 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Router /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req models.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Validate refresh token
	userID, err := h.jwtService.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.NewErrorResponse("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token"))
		return
	}

	// Get user
	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, models.NewErrorResponse("USER_NOT_FOUND", "User not found"))
		return
	}

	// Check if user is still active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("USER_INACTIVE", "User account is inactive"))
		return
	}

	// Generate new access token
	accessToken, err := h.jwtService.GenerateAccessToken(
		user.ID,
		user.Email,
		user.UserTypeID,
		user.UserType.TypeName,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("TOKEN_GENERATION_FAILED", "Failed to generate token"))
		return
	}

	// Return new access token (refresh token remains the same)
	c.JSON(http.StatusOK, models.NewSuccessResponse(&models.AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: req.RefreshToken, // Same refresh token
		TokenType:    "Bearer",
		ExpiresIn:    24 * 3600,
	}))
}

// ValidateToken godoc
// @Summary Validate access token
// @Description Check if current access token is valid
// @Tags Authentication
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse{data=models.User}
// @Failure 401 {object} models.APIResponse
// @Security BearerAuth
// @Router /auth/validate [get]
func (h *AuthHandler) ValidateToken(c *gin.Context) {
	// User context was already set by JWT middleware
	userID := c.GetString("user_id")
	email := c.GetString("email")
	userType := c.GetString("user_type")

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"user_id":   userID,
		"email":     email,
		"user_type": userType,
		"valid":     true,
	}))
}
