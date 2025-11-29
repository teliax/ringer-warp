package handlers

import (
	"net/http"

	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"github.com/ringer-warp/api-gateway/internal/trunk"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TrunkHandler struct {
	trunkService *trunk.Service
	customerRepo *repository.CustomerRepository
}

func NewTrunkHandler(trunkService *trunk.Service, customerRepo *repository.CustomerRepository) *TrunkHandler {
	return &TrunkHandler{
		trunkService: trunkService,
		customerRepo: customerRepo,
	}
}

// ============================================================================
// ADMIN ENDPOINTS (Multi-tenant access)
// ============================================================================
// Path: /v1/admin/customers/{ban}/trunks

// CreateTrunkGroup creates a new trunk group for a customer (Admin only)
// POST /v1/admin/customers/{customerId}/trunks
func (h *TrunkHandler) CreateTrunkGroup(c *gin.Context) {
	customerIDStr := c.Param("customerId")
	if customerIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Customer ID required"})
		return
	}

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	var req models.CreateTrunkGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (set by Gatekeeper middleware)
	userID := c.GetString("user_id")
	createdBy, _ := uuid.Parse(userID)

	trunk, err := h.trunkService.CreateTrunkGroup(c.Request.Context(), customerID, req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, trunk)
}

// ListTrunkGroups lists all trunk groups for a customer (Admin only)
// GET /v1/admin/customers/{ban}/trunks
func (h *TrunkHandler) ListTrunkGroups(c *gin.Context) {
	customerIDStr := c.Param("customerId")
	if customerIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Customer ID required"})
		return
	}

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	trunks, err := h.trunkService.ListTrunkGroups(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"customer_id": customerID,
		"trunks":      trunks,
	})
}

// GetTrunkGroup retrieves a specific trunk group (Admin only)
// GET /v1/admin/customers/{customerId}/trunks/{trunk_id}
func (h *TrunkHandler) GetTrunkGroup(c *gin.Context) {
	customerIDStr := c.Param("customerId")
	trunkIDStr := c.Param("trunk_id")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	trunk, err := h.trunkService.GetTrunkGroup(c.Request.Context(), trunkID, customerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trunk not found"})
		return
	}

	c.JSON(http.StatusOK, trunk)
}

// UpdateTrunkGroup updates a trunk group (Admin only)
// PUT /v1/admin/customers/{ban}/trunks/{trunk_id}
func (h *TrunkHandler) UpdateTrunkGroup(c *gin.Context) {
	trunkIDStr := c.Param("trunk_id")
	customerIDStr := c.Param("customerId")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	var req models.UpdateTrunkGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.trunkService.UpdateTrunkGroup(c.Request.Context(), trunkID, customerID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Trunk group updated successfully"})
}

// DeleteTrunkGroup deletes a trunk group (Admin only)
// DELETE /v1/admin/customers/{ban}/trunks/{trunk_id}
func (h *TrunkHandler) DeleteTrunkGroup(c *gin.Context) {
	trunkIDStr := c.Param("trunk_id")
	customerIDStr := c.Param("customerId")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	err = h.trunkService.DeleteTrunkGroup(c.Request.Context(), trunkID, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Trunk group deleted successfully"})
}

// ============================================================================
// TRUNK IP ENDPOINTS (Admin)
// ============================================================================

// AddTrunkIP adds an IP address to a trunk's ACL (Admin only)
// POST /v1/admin/customers/{ban}/trunks/{trunk_id}/ips
func (h *TrunkHandler) AddTrunkIP(c *gin.Context) {
	trunkIDStr := c.Param("trunk_id")
	customerIDStr := c.Param("customerId")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	var req models.AddTrunkIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	createdBy, _ := uuid.Parse(userID)

	ip, err := h.trunkService.AddTrunkIP(c.Request.Context(), trunkID, customerID, req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "IP added successfully",
		"ip":      ip,
		"note":    "IP synced to Redis for Kamailio authentication",
	})
}

// ListTrunkIPs lists all IP ACL entries for a trunk (Admin only)
// GET /v1/admin/customers/{ban}/trunks/{trunk_id}/ips
func (h *TrunkHandler) ListTrunkIPs(c *gin.Context) {
	trunkIDStr := c.Param("trunk_id")
	customerIDStr := c.Param("customerId")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	ips, err := h.trunkService.ListTrunkIPs(c.Request.Context(), trunkID, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trunk_id": trunkID,
		"ips":      ips,
	})
}

// UpdateTrunkIP updates a trunk IP entry (Admin only)
// PUT /v1/admin/customers/{ban}/trunks/{trunk_id}/ips/{ip_id}
func (h *TrunkHandler) UpdateTrunkIP(c *gin.Context) {
	ipIDStr := c.Param("ip_id")
	customerIDStr := c.Param("customerId")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	ipID, err := uuid.Parse(ipIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid IP ID"})
		return
	}

	var req models.UpdateTrunkIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.trunkService.UpdateTrunkIP(c.Request.Context(), ipID, customerID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Trunk IP updated successfully"})
}

// DeleteTrunkIP removes an IP from a trunk's ACL (Admin only)
// DELETE /v1/admin/customers/{ban}/trunks/{trunk_id}/ips/{ip_id}
func (h *TrunkHandler) DeleteTrunkIP(c *gin.Context) {
	ipIDStr := c.Param("ip_id")
	customerIDStr := c.Param("customerId")

	// Parse customer ID (can be UUID or BAN)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		// If not a UUID, try to lookup by BAN
		customer, err := h.customerRepo.GetByBAN(c.Request.Context(), customerIDStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		customerID = customer.ID
	}

	ipID, err := uuid.Parse(ipIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid IP ID"})
		return
	}

	err = h.trunkService.DeleteTrunkIP(c.Request.Context(), ipID, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Trunk IP deleted successfully"})
}

// ============================================================================
// CUSTOMER ENDPOINTS (Self-service, customer-scoped)
// ============================================================================
// Path: /v1/customers/trunks (customer manages their own trunks)

// CustomerListTrunks lists trunks for the authenticated customer
// GET /v1/customers/trunks
func (h *TrunkHandler) CustomerListTrunks(c *gin.Context) {
	// Get customer ID from Gatekeeper middleware (user's assigned customer)
	customerIDStr := c.GetString("customer_id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No customer context"})
		return
	}

	trunks, err := h.trunkService.ListTrunkGroups(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trunks": trunks,
	})
}

// CustomerCreateTrunk creates a new trunk for the authenticated customer
// POST /v1/customers/trunks
func (h *TrunkHandler) CustomerCreateTrunk(c *gin.Context) {
	customerIDStr := c.GetString("customer_id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No customer context"})
		return
	}

	var req models.CreateTrunkGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	createdBy, _ := uuid.Parse(userID)

	trunk, err := h.trunkService.CreateTrunkGroup(c.Request.Context(), customerID, req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, trunk)
}

// CustomerGetTrunk retrieves a specific trunk for the authenticated customer
// GET /v1/customers/trunks/{trunk_id}
func (h *TrunkHandler) CustomerGetTrunk(c *gin.Context) {
	customerIDStr := c.GetString("customer_id")
	trunkIDStr := c.Param("trunk_id")

	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No customer context"})
		return
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	trunk, err := h.trunkService.GetTrunkGroup(c.Request.Context(), trunkID, customerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trunk not found"})
		return
	}

	c.JSON(http.StatusOK, trunk)
}

// CustomerAddTrunkIP adds an IP to the customer's trunk ACL
// POST /v1/customers/trunks/{trunk_id}/ips
func (h *TrunkHandler) CustomerAddTrunkIP(c *gin.Context) {
	customerIDStr := c.GetString("customer_id")
	trunkIDStr := c.Param("trunk_id")

	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No customer context"})
		return
	}

	trunkID, err := uuid.Parse(trunkIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trunk ID"})
		return
	}

	var req models.AddTrunkIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	createdBy, _ := uuid.Parse(userID)

	ip, err := h.trunkService.AddTrunkIP(c.Request.Context(), trunkID, customerID, req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "IP added successfully",
		"ip":      ip,
		"note":    "It may take up to 60 seconds for IP authentication to become active",
	})
}

// CustomerDeleteTrunkIP removes an IP from the customer's trunk ACL
// DELETE /v1/customers/trunks/{trunk_id}/ips/{ip_id}
func (h *TrunkHandler) CustomerDeleteTrunkIP(c *gin.Context) {
	customerIDStr := c.GetString("customer_id")
	ipIDStr := c.Param("ip_id")

	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No customer context"})
		return
	}

	ipID, err := uuid.Parse(ipIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid IP ID"})
		return
	}

	err = h.trunkService.DeleteTrunkIP(c.Request.Context(), ipID, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "IP removed successfully",
		"note":    "It may take up to 60 seconds for the change to take effect",
	})
}

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

// GetVendorOriginationIPs returns the list of WARP origination IPs
// GET /v1/customers/vendor-ips
func (h *TrunkHandler) GetVendorOriginationIPs(c *gin.Context) {
	ips := h.trunkService.GetVendorOriginationIPs()
	c.JSON(http.StatusOK, ips)
}

// GetCustomerIngressIPs returns the customer-facing SIP server IPs
// GET /v1/customers/ingress-ips
func (h *TrunkHandler) GetCustomerIngressIPs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"region": "us-central1",
		"servers": []map[string]string{
			{
				"protocol":  "UDP",
				"hostname":  "sip.ringer.tel",
				"ip":        "34.44.183.87",
				"port":      "5060",
				"primary":   "true",
			},
			{
				"protocol":  "TCP",
				"hostname":  "sip-tcp.ringer.tel",
				"ip":        "34.55.182.145",
				"port":      "5060",
				"primary":   "false",
			},
		},
		"note": "Configure your SIP trunk to send traffic to these IP addresses. Add your source IPs to the IP whitelist in your trunk configuration.",
	})
}

// SyncAllTrunkIPs manually triggers a full sync of trunk IPs to Redis (Admin only)
// POST /v1/admin/trunks/sync-redis
func (h *TrunkHandler) SyncAllTrunkIPs(c *gin.Context) {
	err := h.trunkService.SyncAllTrunkIPsToRedis(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "All trunk IPs synced to Redis successfully",
	})
}
