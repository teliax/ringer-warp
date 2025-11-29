package handlers

import (
	"net/http"
	"strings"

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
// @Summary Exchange Google OAuth info for WARP JWT tokens
// @Description Accept Google OAuth info (from frontend) and issue WARP tokens
// @Tags Authentication
// @Accept json
// @Produce json
// @Param request body models.GoogleTokenExchangeRequest true "Google OAuth info"
// @Success 200 {object} models.APIResponse{data=models.AuthTokens}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Router /auth/exchange [post]
func (h *AuthHandler) ExchangeGoogleToken(c *gin.Context) {
	var req models.GoogleTokenExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Verify email domain (only @ringer.tel allowed)
	if !strings.HasSuffix(req.Email, "@ringer.tel") {
		h.logger.Warn("Rejected login from non-Ringer email", 
			log.String("email", req.Email))
		c.JSON(http.StatusForbidden, models.NewErrorResponse("UNAUTHORIZED_DOMAIN", "Only @ringer.tel email addresses are allowed"))
		return
	}

	// Look up user by email (simplified pattern like ringer-soa)
	user, err := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		h.logger.Error("Failed to lookup user", log.Error(err))
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LOOKUP_FAILED", "Failed to lookup user"))
		return
	}

	// If user doesn't exist, auto-create with viewer role
	if user == nil {
		h.logger.Info("Auto-creating new user",
			log.String("google_id", req.GoogleID),
			log.String("email", req.Email),
			log.String("name", req.Name),
		)

		// Get viewer user type
		viewerTypeID, err := h.userRepo.GetUserTypeIDByName(c.Request.Context(), "viewer")
		if err != nil {
			h.logger.Error("Failed to get viewer user type", log.Error(err))
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("USER_TYPE_NOT_FOUND", "Failed to create user"))
			return
		}

		// Create user
		displayName := req.Name
		if displayName == "" {
			displayName = req.Email
		}
		
		user, err = h.userRepo.Create(c.Request.Context(), req.GoogleID, req.Email, displayName, viewerTypeID)
		if err != nil {
			h.logger.Error("Failed to create user", log.Error(err))
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("USER_CREATION_FAILED", "Failed to create user"))
			return
		}

		user.UserType = &models.UserType{TypeName: "viewer"}
		h.logger.Info("User auto-created", log.String("user_id", user.ID.String()))
	}

	// If user exists but google_id is empty or PENDING, update it
	if user.GoogleID == "" || user.GoogleID == "PENDING_GOOGLE_LOGIN" || user.GoogleID != req.GoogleID {
		h.logger.Info("Updating Google ID",
			log.String("user_id", user.ID.String()),
			log.String("old_google_id", user.GoogleID),
			log.String("new_google_id", req.GoogleID),
		)

		err = h.userRepo.UpdateGoogleID(c.Request.Context(), user.ID, req.GoogleID)
		if err != nil {
			h.logger.Error("Failed to update Google ID", log.Error(err))
			// Don't fail - continue with login
		}
		user.GoogleID = req.GoogleID
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
