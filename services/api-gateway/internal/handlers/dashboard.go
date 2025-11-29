package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type DashboardHandler struct {
	db *pgxpool.Pool
}

func NewDashboardHandler(db *pgxpool.Pool) *DashboardHandler {
	return &DashboardHandler{
		db: db,
	}
}

// DashboardStats represents admin dashboard statistics
type DashboardStats struct {
	TotalCustomers   int     `json:"total_customers"`
	ActiveCustomers  int     `json:"active_customers"`
	TotalRevenue     float64 `json:"total_revenue"`
	MonthlyGrowth    float64 `json:"monthly_growth"`
	ActiveVendors    int     `json:"active_vendors"`
	SupportTickets   int     `json:"support_tickets"`
}

// GetDashboardStats godoc
// @Summary Get admin dashboard statistics
// @Description Returns key metrics for the admin dashboard
// @Tags Dashboard
// @Produce json
// @Success 200 {object} models.APIResponse{data=DashboardStats}
// @Failure 500 {object} models.APIResponse
// @Security BearerAuth
// @Router /v1/dashboard/stats [get]
func (h *DashboardHandler) GetStats(c *gin.Context) {
	// Get customer scoping from Gatekeeper middleware
	var customerFilter []uuid.UUID
	if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
		customerFilter = accessibleCustomers.([]uuid.UUID)
	}

	stats := DashboardStats{}

	// Build customer filter clause
	var customerFilterClause string
	var args []interface{}
	if customerFilter != nil {
		if len(customerFilter) == 0 {
			// No customers accessible - return zero stats
			c.JSON(http.StatusOK, models.NewSuccessResponse(stats))
			return
		}
		customerFilterClause = " WHERE id = ANY($1)"
		args = append(args, customerFilter)
	}
	// If customerFilter is nil (SuperAdmin), no WHERE clause = all customers

	// Query total customers
	query := "SELECT COUNT(*) FROM accounts.customers" + customerFilterClause
	if err := h.db.QueryRow(c.Request.Context(), query, args...).Scan(&stats.TotalCustomers); err != nil {
		stats.TotalCustomers = 0
	}

	// Query active customers
	var activeArgs []interface{}
	activeClause := " WHERE status = 'ACTIVE'"
	if customerFilter != nil && len(customerFilter) > 0 {
		activeClause = " WHERE status = 'ACTIVE' AND id = ANY($1)"
		activeArgs = append(activeArgs, customerFilter)
	}
	query = "SELECT COUNT(*) FROM accounts.customers" + activeClause
	if err := h.db.QueryRow(c.Request.Context(), query, activeArgs...).Scan(&stats.ActiveCustomers); err != nil {
		stats.ActiveCustomers = 0
	}

	// Query vendor count (all users see all vendors - vendors are platform-level, not customer-level)
	query = "SELECT COUNT(*) FROM messaging.vendors WHERE is_active = true"
	if err := h.db.QueryRow(c.Request.Context(), query).Scan(&stats.ActiveVendors); err != nil {
		stats.ActiveVendors = 0
	}

	// Placeholder values for fields not yet implemented
	stats.TotalRevenue = 0.00    // TODO: Sum from billing system
	stats.MonthlyGrowth = 0.00   // TODO: Calculate from historical data
	stats.SupportTickets = 0     // TODO: Integrate ticketing system

	c.JSON(http.StatusOK, models.NewSuccessResponse(stats))
}

// UserInfo represents current logged-in user info
type UserInfo struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
	Name     string `json:"name"`
}

// GetCurrentUser godoc
// @Summary Get current user information
// @Description Returns information about the currently logged-in user
// @Tags Dashboard
// @Produce json
// @Success 200 {object} models.APIResponse{data=UserInfo}
// @Failure 401 {object} models.APIResponse
// @Security BearerAuth
// @Router /v1/dashboard/me [get]
func (h *DashboardHandler) GetCurrentUser(c *gin.Context) {
	// Get user info from JWT context (set by middleware)
	userID, _ := c.Get("user_id")
	email, _ := c.Get("email")
	userType, _ := c.Get("user_type")

	user := UserInfo{
		UserID:   userID.(string),
		Email:    email.(string),
		UserType: userType.(string),
		Name:     email.(string), // Use email as name for now
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(user))
}

