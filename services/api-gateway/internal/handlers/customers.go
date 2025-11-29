package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/hubspot"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"go.uber.org/zap"
)

type CustomerHandler struct {
	customerRepo       *repository.CustomerRepository
	syncService        *hubspot.SyncService // Optional - for auto-sync
	invitationService  interface{}          // Forward declaration for invitation.Service
	userRepo          *repository.UserRepository
	logger            *zap.Logger
}

func NewCustomerHandler(
	customerRepo *repository.CustomerRepository,
	syncService *hubspot.SyncService,
	invitationService interface{},
	userRepo *repository.UserRepository,
	logger *zap.Logger,
) *CustomerHandler {
	return &CustomerHandler{
		customerRepo:      customerRepo,
		syncService:       syncService,
		invitationService: invitationService,
		userRepo:         userRepo,
		logger:           logger,
	}
}

// CreateCustomer godoc
// @Summary Create a new customer
// @Description Create a new customer account with billing information
// @Tags Customers
// @Accept json
// @Produce json
// @Param customer body models.CreateCustomerRequest true "Customer information"
// @Success 201 {object} models.APIResponse{data=models.Customer}
// @Failure 400 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers [post]
func (h *CustomerHandler) CreateCustomer(c *gin.Context) {
	var req models.CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get user email from JWT context (set by auth middleware)
	createdBy := c.GetString("email")
	if createdBy == "" {
		createdBy = "system"
	}

	// Use transaction if HubSpot sync is enabled (synchronous create)
	if h.syncService != nil {
		customer, tx, err := h.customerRepo.CreateWithTransaction(c.Request.Context(), &req, createdBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", err.Error()))
			return
		}

		// Sync to HubSpot synchronously
		h.logger.Info("Creating customer with synchronous HubSpot sync",
			zap.String("customer_id", customer.ID.String()),
			zap.String("ban", customer.BAN),
		)

		syncResult, err := h.syncService.SyncCustomerToHubSpot(c.Request.Context(), customer)
		if err != nil {
			// Rollback database transaction
			tx.Rollback(c.Request.Context())

			h.logger.Error("HubSpot sync failed, rolling back customer creation",
				zap.String("customer_id", customer.ID.String()),
				zap.Error(err),
			)

			// Return detailed error
			if syncErr, ok := err.(*hubspot.SyncError); ok {
				fieldErrors := make([]string, len(syncErr.FailedFields))
				for i, f := range syncErr.FailedFields {
					fieldErrors[i] = fmt.Sprintf("%s: %s", f.FieldName, f.ErrorMessage)
				}

				c.JSON(http.StatusServiceUnavailable, models.NewErrorResponse(
					"HUBSPOT_SYNC_FAILED",
					fmt.Sprintf("Customer creation rolled back due to HubSpot sync failure: %s. Failed fields: %v",
						syncErr.Message, fieldErrors),
				))
			} else {
				c.JSON(http.StatusServiceUnavailable, models.NewErrorResponse(
					"HUBSPOT_SYNC_FAILED",
					fmt.Sprintf("Customer creation rolled back: %s", err.Error()),
				))
			}
			return
		}

		// Update customer with HubSpot company ID
		if err := h.customerRepo.UpdateHubSpotID(c.Request.Context(), tx, customer.ID, syncResult.HubSpotCompanyID); err != nil {
			tx.Rollback(c.Request.Context())
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_HUBSPOT_ID_FAILED", err.Error()))
			return
		}

		// Commit transaction
		if err := tx.Commit(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("COMMIT_FAILED", err.Error()))
			return
		}

		h.logger.Info("Customer created and synced to HubSpot successfully",
			zap.String("customer_id", customer.ID.String()),
			zap.String("hubspot_company_id", syncResult.HubSpotCompanyID),
			zap.Strings("fields_synced", syncResult.FieldsSynced),
		)

		// Auto-assign or invite contact user
		if invitationResult := h.handleContactUserAssignment(c.Request.Context(), customer, createdBy); invitationResult != nil {
			c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
				"customer": customer,
				"hubspot_sync": syncResult,
				"user_assignment": invitationResult,
			}))
		} else {
			c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
				"customer": customer,
				"hubspot_sync": syncResult,
			}))
		}
	} else {
		// No HubSpot sync - use regular create
		customer, err := h.customerRepo.Create(c.Request.Context(), &req, createdBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", err.Error()))
			return
		}

		// Auto-assign or invite contact user
		if invitationResult := h.handleContactUserAssignment(c.Request.Context(), customer, createdBy); invitationResult != nil {
			c.JSON(http.StatusCreated, models.NewSuccessResponse(gin.H{
				"customer": customer,
				"user_assignment": invitationResult,
			}))
		} else {
			c.JSON(http.StatusCreated, models.NewSuccessResponse(customer))
		}
	}
}

// ListCustomers godoc
// @Summary List all customers
// @Description Get a paginated list of customers with optional filtering
// @Tags Customers
// @Accept json
// @Produce json
// @Param search query string false "Search by company name or BAN"
// @Param status query string false "Filter by status" Enums(ACTIVE, SUSPENDED, TRIAL, CLOSED)
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} models.APIResponse{data=models.ListResponse}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers [get]
func (h *CustomerHandler) ListCustomers(c *gin.Context) {
	search := c.Query("search")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID) // nil for SuperAdmin, []uuid for scoped users
	}
	// If not set (shouldn't happen), default to nil (allow all - backward compatible)

	customers, total, err := h.customerRepo.List(c.Request.Context(), customerFilter, search, status, page, perPage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LIST_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewListResponse(customers, page, perPage, int(total)))
}

// GetCustomer godoc
// @Summary Get customer by ID
// @Description Get detailed customer information by ID
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Success 200 {object} models.APIResponse{data=models.Customer}
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id} [get]
func (h *CustomerHandler) GetCustomer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify user has access to this customer
	if err := h.customerRepo.VerifyCustomerAccess(id, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
		return
	}

	customer, err := h.customerRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_FAILED", err.Error()))
		return
	}

	if customer == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Customer not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(customer))
}

// GetCustomerByBAN godoc
// @Summary Get customer by BAN
// @Description Get customer information by Billing Account Number
// @Tags Customers
// @Accept json
// @Produce json
// @Param ban path string true "Billing Account Number"
// @Success 200 {object} models.APIResponse{data=models.Customer}
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/by-ban/{ban} [get]
func (h *CustomerHandler) GetCustomerByBAN(c *gin.Context) {
	ban := c.Param("ban")

	customer, err := h.customerRepo.GetByBAN(c.Request.Context(), ban)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_FAILED", err.Error()))
		return
	}

	if customer == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Customer not found"))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(customer))
}

// UpdateCustomer godoc
// @Summary Update customer
// @Description Update customer information (partial updates supported)
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Param customer body models.UpdateCustomerRequest true "Customer updates"
// @Success 200 {object} models.APIResponse{data=models.Customer}
// @Failure 400 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id} [put]
func (h *CustomerHandler) UpdateCustomer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify user has access to this customer
	if err := h.customerRepo.VerifyCustomerAccess(id, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
		return
	}

	var req models.UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get user email from JWT context (set by auth middleware)
	updatedBy := c.GetString("email")
	if updatedBy == "" {
		updatedBy = "system"
	}

	customer, err := h.customerRepo.Update(c.Request.Context(), id, &req, updatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_FAILED", err.Error()))
		return
	}

	if customer == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Customer not found"))
		return
	}

	// Auto-sync to HubSpot (async, non-blocking)
	if h.syncService != nil {
		go func() {
			if err := h.syncService.QueueCustomerSync(c.Request.Context(), customer.ID, hubspot.SyncDirectionWarpToHubSpot, 5); err != nil {
				h.logger.Warn("Failed to queue customer for HubSpot sync",
					zap.String("customer_id", customer.ID.String()),
					zap.Error(err),
				)
			} else {
				h.logger.Info("Customer queued for HubSpot sync after update",
					zap.String("customer_id", customer.ID.String()),
					zap.String("ban", customer.BAN),
				)
			}
		}()
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(customer))
}

// GetCustomerTrunks godoc
// @Summary Get customer trunks
// @Description Get all SIP trunks for a customer
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/trunks [get]
func (h *CustomerHandler) GetCustomerTrunks(c *gin.Context) {
	idStr := c.Param("id")
	_, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	// TODO: Implement GetCustomerTrunks in repository
	// For now, return empty array
	c.JSON(http.StatusOK, models.NewSuccessResponse([]interface{}{}))
}

// GetCustomerDIDs godoc
// @Summary Get customer DIDs
// @Description Get all phone numbers (DIDs) for a customer
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/dids [get]
func (h *CustomerHandler) GetCustomerDIDs(c *gin.Context) {
	idStr := c.Param("id")
	_, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	// TODO: Implement GetCustomerDIDs in repository
	// For now, return empty array
	c.JSON(http.StatusOK, models.NewSuccessResponse([]interface{}{}))
}

// GetCustomerUsers godoc
// @Summary Get users for a customer
// @Description Get all users who have access to a specific customer
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Success 200 {object} models.APIResponse{data=[]models.CustomerUser}
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/users [get]
func (h *CustomerHandler) GetCustomerUsers(c *gin.Context) {
	idStr := c.Param("id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify user has access to this customer
	if err := h.customerRepo.VerifyCustomerAccess(customerID, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
		return
	}

	// Get all users with access to this customer
	users, err := h.userRepo.GetCustomerUsers(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_USERS_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(users))
}

// RemoveCustomerUser godoc
// @Summary Remove user access from customer
// @Description Remove a user's access to a specific customer
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Param userId path string true "User ID (UUID)"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/users/{userId} [delete]
func (h *CustomerHandler) RemoveCustomerUser(c *gin.Context) {
	idStr := c.Param("id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_USER_ID", "Invalid user ID format"))
		return
	}

	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify user has access to this customer
	if err := h.customerRepo.VerifyCustomerAccess(customerID, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
		return
	}

	// Check if this is the last admin for the customer
	users, err := h.userRepo.GetCustomerUsers(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CHECK_USERS_FAILED", err.Error()))
		return
	}

	adminCount := 0
	for _, user := range users {
		if user.Role == "ADMIN" {
			adminCount++
		}
	}

	// Find the user being removed
	var removingUser *models.CustomerUser
	for _, user := range users {
		if user.ID == userID {
			removingUser = &user
			break
		}
	}

	if removingUser == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("USER_NOT_FOUND", "User not found for this customer"))
		return
	}

	// Prevent removing the last admin
	if removingUser.Role == "ADMIN" && adminCount <= 1 {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("LAST_ADMIN", "Cannot remove the last admin user"))
		return
	}

	// Remove user access
	err = h.userRepo.RemoveCustomerAccess(c.Request.Context(), userID, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("REMOVE_ACCESS_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "User access removed successfully",
	}))
}

// UpdateCustomerUserRole godoc
// @Summary Update user role for customer
// @Description Update a user's role for a specific customer
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Param userId path string true "User ID (UUID)"
// @Param body body models.UpdateUserRoleRequest true "Role update"
// @Success 200 {object} models.APIResponse
// @Failure 400 {object} models.APIResponse
// @Failure 403 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/users/{userId}/role [put]
func (h *CustomerHandler) UpdateCustomerUserRole(c *gin.Context) {
	idStr := c.Param("id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_USER_ID", "Invalid user ID format"))
		return
	}

	var req struct {
		Role string `json:"role" binding:"required,oneof=ADMIN USER VIEWER"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	// Verify user has access to this customer
	if err := h.customerRepo.VerifyCustomerAccess(customerID, customerFilter); err != nil {
		c.JSON(http.StatusForbidden, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
		return
	}

	// Check if changing from ADMIN role would leave no admins
	if req.Role != "ADMIN" {
		users, err := h.userRepo.GetCustomerUsers(c.Request.Context(), customerID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CHECK_USERS_FAILED", err.Error()))
			return
		}

		adminCount := 0
		var targetUser *models.CustomerUser
		for _, user := range users {
			if user.Role == "ADMIN" {
				adminCount++
			}
			if user.ID == userID {
				targetUser = &user
			}
		}

		if targetUser == nil {
			c.JSON(http.StatusNotFound, models.NewErrorResponse("USER_NOT_FOUND", "User not found for this customer"))
			return
		}

		// Prevent removing the last admin
		if targetUser.Role == "ADMIN" && adminCount <= 1 {
			c.JSON(http.StatusBadRequest, models.NewErrorResponse("LAST_ADMIN", "Cannot change role of the last admin user"))
			return
		}
	}

	// Update user role
	updatedBy := c.GetString("email")
	err = h.userRepo.UpdateCustomerRole(c.Request.Context(), userID, customerID, req.Role, updatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_ROLE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"message": "User role updated successfully",
		"role": req.Role,
	}))
}

// handleContactUserAssignment handles auto-assignment or invitation of contact user when creating customer
func (h *CustomerHandler) handleContactUserAssignment(ctx context.Context, customer *models.Customer, createdBy string) interface{} {
	// Extract contact email from customer's contact JSONB field
	if customer.Contact == nil {
		return nil
	}

	contactEmail, ok := customer.Contact["email"].(string)
	if !ok || contactEmail == "" {
		h.logger.Info("No contact email found in customer data",
			zap.String("customer_id", customer.ID.String()))
		return nil
	}

	// Get the user ID of the creator for invited_by field
	creatorUser, err := h.userRepo.GetByEmail(ctx, createdBy)
	if err != nil || creatorUser == nil {
		h.logger.Warn("Could not find creator user for invitation",
			zap.String("email", createdBy),
			zap.Error(err))
		return nil
	}

	// Check if contact email exists as a user
	existingUser, err := h.userRepo.GetByEmail(ctx, contactEmail)
	if err != nil {
		h.logger.Error("Failed to check if contact user exists",
			zap.String("email", contactEmail),
			zap.Error(err))
		return nil
	}

	if existingUser != nil {
		// User exists - grant them access to this customer
		err = h.userRepo.GrantCustomerAccess(ctx, existingUser.ID, customer.ID, "ADMIN", createdBy)
		if err != nil {
			h.logger.Error("Failed to grant customer access to existing user",
				zap.String("user_id", existingUser.ID.String()),
				zap.String("customer_id", customer.ID.String()),
				zap.Error(err))
			return nil
		}

		h.logger.Info("Granted customer access to existing user",
			zap.String("user_email", contactEmail),
			zap.String("customer_id", customer.ID.String()))

		return gin.H{
			"action": "customer_access_granted",
			"user_id": existingUser.ID,
			"email": contactEmail,
		}
	}

	// User doesn't exist - create invitation
	// We need to use type assertion to call the invitation service methods
	type InvitationService interface {
		CreateInvitation(ctx context.Context, email string, userTypeName string, customerID uuid.UUID, role string, message *string, invitedBy uuid.UUID) (*models.Invitation, error)
	}

	invService, ok := h.invitationService.(InvitationService)
	if !ok || invService == nil {
		h.logger.Warn("Invitation service not available")
		return nil
	}

	// Extract contact name for the invitation
	contactName, _ := customer.Contact["name"].(string)
	welcomeMessage := fmt.Sprintf("Welcome to WARP! You've been added as the primary administrator for %s. Please accept this invitation to manage your account.", customer.CompanyName)

	invitation, err := invService.CreateInvitation(
		ctx,
		contactEmail,
		"customer_admin", // Give them customer_admin role
		customer.ID,
		"ADMIN",
		&welcomeMessage,
		creatorUser.ID,
	)

	if err != nil {
		h.logger.Error("Failed to create invitation for contact user",
			zap.String("email", contactEmail),
			zap.String("customer_id", customer.ID.String()),
			zap.Error(err))
		return nil
	}

	h.logger.Info("Created invitation for contact user",
		zap.String("email", contactEmail),
		zap.String("customer_id", customer.ID.String()),
		zap.String("invitation_id", invitation.ID.String()))

	return gin.H{
		"action": "invitation_sent",
		"invitation_id": invitation.ID,
		"email": contactEmail,
		"name": contactName,
	}
}
