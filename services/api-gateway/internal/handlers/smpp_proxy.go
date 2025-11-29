package handlers

import (
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type SMPPProxyHandler struct {
	smppGatewayURL string
}

func NewSMPPProxyHandler() *SMPPProxyHandler {
	// Internal cluster DNS
	gatewayURL := "http://smpp-gateway-api.messaging:8080"
	return &SMPPProxyHandler{
		smppGatewayURL: gatewayURL,
	}
}

// ListVendors proxies to SMPP Gateway
// @Summary List SMPP vendors
// @Description Get list of all SMPP vendors with connection status
// @Tags SMPP
// @Produce json
// @Success 200 {object} models.APIResponse
// @Security BearerAuth
// @Router /v1/smpp/vendors [get]
func (h *SMPPProxyHandler) ListVendors(c *gin.Context) {
	h.proxyRequest(c, "GET", "/api/v1/vendors", nil)
}

// ReconnectVendor proxies vendor reconnect
// @Summary Reconnect SMPP vendor
// @Description Reload vendor config and reconnect
// @Tags SMPP
// @Param id path string true "Vendor ID"
// @Produce json
// @Success 200 {object} models.APIResponse
// @Security BearerAuth
// @Router /v1/smpp/vendors/{id}/reconnect [post]
func (h *SMPPProxyHandler) ReconnectVendor(c *gin.Context) {
	vendorID := c.Param("id")
	path := fmt.Sprintf("/api/v1/vendors/reconnect/%s", vendorID)
	h.proxyRequest(c, "POST", path, nil)
}

// DisconnectVendor proxies vendor disconnect
// @Summary Disconnect SMPP vendor
// @Description Gracefully disconnect from vendor
// @Tags SMPP
// @Param id path string true "Vendor ID"
// @Produce json
// @Success 200 {object} models.APIResponse
// @Security BearerAuth
// @Router /v1/smpp/vendors/{id}/disconnect [post]
func (h *SMPPProxyHandler) DisconnectVendor(c *gin.Context) {
	vendorID := c.Param("id")
	path := fmt.Sprintf("/api/v1/vendors/disconnect/%s", vendorID)
	h.proxyRequest(c, "POST", path, nil)
}

// GetStats proxies SMPP gateway stats
// @Summary Get SMPP gateway statistics
// @Description Get message counts, session info, etc
// @Tags SMPP
// @Produce json
// @Success 200 {object} models.APIResponse
// @Security BearerAuth
// @Router /v1/smpp/stats [get]
func (h *SMPPProxyHandler) GetStats(c *gin.Context) {
	h.proxyRequest(c, "GET", "/api/v1/admin/stats", nil)
}

// proxyRequest forwards request to SMPP Gateway
func (h *SMPPProxyHandler) proxyRequest(c *gin.Context, method, path string, body io.Reader) {
	url := h.smppGatewayURL + path

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("PROXY_ERROR", "Failed to create request"))
		return
	}

	// Forward request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.NewErrorResponse("GATEWAY_UNAVAILABLE", "SMPP Gateway is not reachable"))
		return
	}
	defer resp.Body.Close()

	// Read response
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse("PROXY_ERROR", "Failed to read response"))
		return
	}

	// Forward response with same status code
	c.Data(resp.StatusCode, "application/json", bodyBytes)
}

