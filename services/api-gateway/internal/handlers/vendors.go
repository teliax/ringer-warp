package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/ringer-warp/api-gateway/internal/services"
)

// VendorHandler handles vendor-related HTTP requests
type VendorHandler struct {
	vendorService services.VendorService
}

// NewVendorHandler creates a new vendor handler
func NewVendorHandler(vendorService services.VendorService) *VendorHandler {
	return &VendorHandler{
		vendorService: vendorService,
	}
}

// CreateSMPPVendor creates a new SMPP vendor configuration
func (h *VendorHandler) CreateSMPPVendor(c *gin.Context) {
	var req models.CreateSMPPVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request",
			"details": err.Error(),
		})
		return
	}

	vendor, err := h.vendorService.CreateSMPPVendor(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create vendor",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    vendor,
	})
}

// ListSMPPVendors returns all configured SMPP vendors
func (h *VendorHandler) ListSMPPVendors(c *gin.Context) {
	vendors, err := h.vendorService.ListSMPPVendors(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list vendors",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"vendors": vendors,
			"total":   len(vendors),
		},
	})
}

// GetSMPPVendor returns a specific SMPP vendor
func GetSMPPVendor(c *gin.Context) {
	vendorID := c.Param("id")

	// TODO: Implement
	// Query PostgreSQL for vendor by ID

	c.JSON(http.StatusNotFound, gin.H{
		"error": "Vendor not found",
		"id":    vendorID,
	})
}

// UpdateSMPPVendor updates an existing SMPP vendor
func UpdateSMPPVendor(c *gin.Context) {
	vendorID := c.Param("id")

	// TODO: Implement
	// 1. Update PostgreSQL
	// 2. Update Jasmin connector if bind active

	c.JSON(http.StatusNotImplemented, gin.H{
		"error": "Not implemented yet",
		"id":    vendorID,
	})
}

// DeleteSMPPVendor removes an SMPP vendor
func DeleteSMPPVendor(c *gin.Context) {
	vendorID := c.Param("id")

	// TODO: Implement
	// 1. Stop bind in Jasmin
	// 2. Delete connector from Jasmin
	// 3. Soft delete in PostgreSQL

	c.JSON(http.StatusNotImplemented, gin.H{
		"error": "Not implemented yet",
		"id":    vendorID,
	})
}

// BindSMPPVendor starts SMPP bind for a vendor
func (h *VendorHandler) BindSMPPVendor(c *gin.Context) {
	vendorID := c.Param("id")

	if err := h.vendorService.BindSMPPVendor(c.Request.Context(), vendorID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start SMPP bind",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "SMPP bind started",
		"vendor_id": vendorID,
	})
}

// GetSMPPVendorStatus returns current bind status
func (h *VendorHandler) GetSMPPVendorStatus(c *gin.Context) {
	vendorID := c.Param("id")

	status, err := h.vendorService.GetSMPPVendorStatus(c.Request.Context(), vendorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get status",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// Placeholder implementations for other methods
func (h *VendorHandler) GetSMPPVendor(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func (h *VendorHandler) UpdateSMPPVendor(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func (h *VendorHandler) DeleteSMPPVendor(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}
