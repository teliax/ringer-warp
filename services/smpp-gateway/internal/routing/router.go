package routing

import (
	"context"
	"fmt"
	"regexp"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/smpp-gateway/internal/connectors"
	"github.com/ringer-warp/smpp-gateway/internal/models"
	log "github.com/sirupsen/logrus"
)

// Router handles message routing to appropriate vendors
type Router struct {
	db           *pgxpool.Pool
	connectorMgr *connectors.Manager
}

// NewRouter creates a new message router
func NewRouter(db *pgxpool.Pool, connMgr *connectors.Manager) *Router {
	return &Router{
		db:           db,
		connectorMgr: connMgr,
	}
}

// RouteMessage selects the appropriate vendor for a message
func (r *Router) RouteMessage(ctx context.Context, msg *models.Message) (*connectors.SMPPClient, error) {
	logger := log.WithFields(log.Fields{
		"msg_id": msg.ID,
		"source": msg.SourceAddr,
		"dest":   msg.DestAddr,
	})

	// For initial implementation, use simple priority-based selection
	vendors := r.connectorMgr.GetAllConnectors()
	if len(vendors) == 0 {
		return nil, fmt.Errorf("no vendors available")
	}

	// Get vendor priority list from PostgreSQL
	query := `
		SELECT id, instance_name, priority, is_primary
		FROM messaging.vendors
		WHERE provider_type = 'smpp'
		  AND is_active = true
		ORDER BY priority ASC
		LIMIT 10
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query vendors: %w", err)
	}
	defer rows.Close()

	// Try vendors in priority order
	for rows.Next() {
		var vendorID, instanceName string
		var priority int
		var isPrimary bool

		if err := rows.Scan(&vendorID, &instanceName, &priority, &isPrimary); err != nil {
			log.WithError(err).Error("Failed to scan vendor row")
			continue
		}

		// Get connector from manager
		connector, err := r.connectorMgr.GetConnector(vendorID)
		if err != nil {
			logger.WithField("vendor_id", vendorID).Debug("Vendor connector not found")
			continue
		}

		// Check if connected
		if !connector.IsConnected() {
			logger.WithFields(log.Fields{
				"vendor_id":   vendorID,
				"vendor_name": instanceName,
			}).Debug("Vendor not connected, trying next")
			continue
		}

		// Found a connected vendor
		logger.WithFields(log.Fields{
			"vendor_id":   vendorID,
			"vendor_name": instanceName,
			"priority":    priority,
		}).Info("Selected vendor for routing")

		msg.VendorID = vendorID
		return connector, nil
	}

	return nil, fmt.Errorf("no connected vendors available")
}

// RouteMessageAdvanced uses routing rules for advanced routing
func (r *Router) RouteMessageAdvanced(ctx context.Context, msg *models.Message) (*connectors.SMPPClient, error) {
	// TODO: Implement routing rules from PostgreSQL
	// This would query a routing_rules table with regex patterns
	// For now, fall back to simple routing

	return r.RouteMessage(ctx, msg)
}

// selectVendorByRules applies routing rules to select vendor
func (r *Router) selectVendorByRules(ctx context.Context, msg *models.Message) (string, error) {
	// Query routing rules from database
	query := `
		SELECT vendor_id, source_pattern, dest_pattern, priority
		FROM routing.rules
		WHERE is_active = true
		ORDER BY priority ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return "", fmt.Errorf("failed to query routing rules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var vendorID, sourcePattern, destPattern string
		var priority int

		if err := rows.Scan(&vendorID, &sourcePattern, &destPattern, &priority); err != nil {
			log.WithError(err).Error("Failed to scan routing rule")
			continue
		}

		// Match source pattern
		if sourcePattern != "" {
			sourceRe, err := regexp.Compile(sourcePattern)
			if err != nil {
				log.WithError(err).Error("Invalid source pattern regex")
				continue
			}
			if !sourceRe.MatchString(msg.SourceAddr) {
				continue
			}
		}

		// Match destination pattern
		if destPattern != "" {
			destRe, err := regexp.Compile(destPattern)
			if err != nil {
				log.WithError(err).Error("Invalid dest pattern regex")
				continue
			}
			if !destRe.MatchString(msg.DestAddr) {
				continue
			}
		}

		// Rule matched
		log.WithFields(log.Fields{
			"vendor_id": vendorID,
			"priority":  priority,
		}).Debug("Routing rule matched")

		return vendorID, nil
	}

	return "", fmt.Errorf("no routing rule matched")
}

// GetRoutingStats returns routing statistics
func (r *Router) GetRoutingStats(ctx context.Context) (map[string]int64, error) {
	// TODO: Implement routing statistics
	// This would track messages routed per vendor
	return make(map[string]int64), nil
}
