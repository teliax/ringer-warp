package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
)

type CustomerHandler struct {
	customerRepo *repository.CustomerRepository
}

func NewCustomerHandler(customerRepo *repository.CustomerRepository) *CustomerHandler {
	return &CustomerHandler{
		customerRepo: customerRepo,
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

	customer, err := h.customerRepo.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("CREATE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.NewSuccessResponse(customer))
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

	customers, total, err := h.customerRepo.List(c.Request.Context(), search, status, page, perPage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("LIST_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewListResponse(customers, page, perPage, total))
}

// GetCustomer godoc
// @Summary Get customer by ID
// @Description Get detailed customer information by ID with optional relationships
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Param include query string false "Include relationships (comma-separated: trunks,dids,usage)"
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

	include := c.Query("include")
	includeTrunks := strings.Contains(include, "trunks")
	includeDIDs := strings.Contains(include, "dids")

	customer, err := h.customerRepo.GetByID(c.Request.Context(), id, includeTrunks, includeDIDs)
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

	var req models.UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_REQUEST", err.Error()))
		return
	}

	customer, err := h.customerRepo.Update(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("UPDATE_FAILED", err.Error()))
		return
	}

	if customer == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse("NOT_FOUND", "Customer not found"))
		return
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
// @Success 200 {object} models.APIResponse{data=[]models.Trunk}
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/trunks [get]
func (h *CustomerHandler) GetCustomerTrunks(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	trunks, err := h.customerRepo.GetCustomerTrunks(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(trunks))
}

// GetCustomerDIDs godoc
// @Summary Get customer DIDs
// @Description Get all phone numbers (DIDs) for a customer
// @Tags Customers
// @Accept json
// @Produce json
// @Param id path string true "Customer ID (UUID)"
// @Success 200 {object} models.APIResponse{data=[]models.DID}
// @Failure 404 {object} models.APIResponse
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /customers/{id}/dids [get]
func (h *CustomerHandler) GetCustomerDIDs(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("INVALID_ID", "Invalid customer ID format"))
		return
	}

	dids, err := h.customerRepo.GetCustomerDIDs(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("GET_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(dids))
}
