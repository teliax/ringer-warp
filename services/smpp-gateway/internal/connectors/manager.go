package connectors

import (
	"context"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/smpp-gateway/internal/config"
	"github.com/ringer-warp/smpp-gateway/internal/models"
	log "github.com/sirupsen/logrus"
)

// Manager manages SMPP client connections to upstream vendors
type Manager struct {
	connectors map[string]*SMPPClient
	db         *pgxpool.Pool
	config     *config.Config
	mu         sync.RWMutex
}

// NewManager creates a new connector manager
func NewManager(ctx context.Context, cfg *config.Config) (*Manager, error) {
	// Connect to PostgreSQL
	dbPool, err := pgxpool.New(ctx, cfg.PostgresDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	// Test connection
	if err := dbPool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	log.Info("Connected to PostgreSQL")

	mgr := &Manager{
		connectors: make(map[string]*SMPPClient),
		db:         dbPool,
		config:     cfg,
	}

	// Load vendors from PostgreSQL
	if err := mgr.LoadVendors(ctx); err != nil {
		return nil, fmt.Errorf("failed to load vendors: %w", err)
	}

	return mgr, nil
}

// LoadVendors loads active vendors from PostgreSQL
func (m *Manager) LoadVendors(ctx context.Context) error {
	query := `
		SELECT id, instance_name, display_name, host, port, use_tls,
		       bind_type, throughput, priority, is_primary, is_active,
		       COALESCE(username, '') as username,
		       COALESCE(password, '') as password,
		       COALESCE(system_type, 'smpp') as system_type
		FROM messaging.vendors
		WHERE provider_type = 'smpp' AND is_active = true
		ORDER BY priority ASC
	`

	rows, err := m.db.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	vendorCount := 0
	for rows.Next() {
		vendor := &models.Vendor{}
		err := rows.Scan(
			&vendor.ID,
			&vendor.InstanceName,
			&vendor.DisplayName,
			&vendor.Host,
			&vendor.Port,
			&vendor.UseTLS,
			&vendor.BindType,
			&vendor.Throughput,
			&vendor.Priority,
			&vendor.IsPrimary,
			&vendor.IsActive,
			&vendor.Username,
			&vendor.Password,
			&vendor.SystemType,
		)
		if err != nil {
			log.Errorf("Failed to scan vendor row: %v", err)
			continue
		}

		// Create SMPP client for this vendor
		client, err := NewSMPPClient(vendor, m.config)
		if err != nil {
			log.Errorf("Failed to create client for %s: %v", vendor.InstanceName, err)
			continue
		}

		m.mu.Lock()
		m.connectors[vendor.ID] = client
		m.mu.Unlock()

		vendorCount++
		log.WithFields(log.Fields{
			"vendor_id":   vendor.ID,
			"vendor_name": vendor.InstanceName,
			"host":        vendor.Host,
			"port":        vendor.Port,
		}).Info("Loaded vendor")
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("rows iteration failed: %w", err)
	}

	log.WithField("count", vendorCount).Info("Vendors loaded from PostgreSQL")
	return nil
}

// StartAll starts SMPP connections to all vendors
func (m *Manager) StartAll(ctx context.Context) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for vendorID, client := range m.connectors {
		log.WithField("vendor_id", vendorID).Info("Starting vendor connection...")

		// Start connection in goroutine
		go func(c *SMPPClient, id string) {
			if err := c.Connect(ctx); err != nil {
				log.WithFields(log.Fields{
					"vendor_id": id,
					"error":     err,
				}).Error("Failed to connect to vendor")
			}
		}(client, vendorID)
	}

	return nil
}

// GetConnector returns a connector by vendor ID
func (m *Manager) GetConnector(vendorID string) (*SMPPClient, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	client, exists := m.connectors[vendorID]
	if !exists {
		return nil, fmt.Errorf("connector not found: %s", vendorID)
	}

	return client, nil
}

// GetAllConnectors returns all connectors
func (m *Manager) GetAllConnectors() map[string]*SMPPClient {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return copy to avoid concurrent map access
	connectors := make(map[string]*SMPPClient, len(m.connectors))
	for id, client := range m.connectors {
		connectors[id] = client
	}

	return connectors
}

// HealthCheck returns health status of all connectors
func (m *Manager) HealthCheck() map[string]*models.ConnectorHealth {
	m.mu.RLock()
	defer m.mu.RUnlock()

	health := make(map[string]*models.ConnectorHealth)
	for id, client := range m.connectors {
		health[id] = client.GetHealth()
	}

	return health
}

// ReconnectVendor reloads vendor config from DB and reconnects
func (m *Manager) ReconnectVendor(ctx context.Context, vendorID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	client, exists := m.connectors[vendorID]
	if !exists {
		return fmt.Errorf("vendor not found: %s", vendorID)
	}

	log.WithField("vendor_id", vendorID).Info("Reconnecting vendor...")

	// Disconnect existing connection
	if err := client.Disconnect(ctx); err != nil {
		log.WithError(err).Warn("Error disconnecting vendor")
	}

	// Reload vendor config from database
	query := `
		SELECT id, instance_name, display_name, host, port, use_tls,
		       bind_type, throughput, priority, is_primary, is_active,
		       COALESCE(username, '') as username,
		       COALESCE(password, '') as password,
		       COALESCE(system_type, 'smpp') as system_type
		FROM messaging.vendors
		WHERE id = $1 AND provider_type = 'smpp'
	`

	vendor := &models.Vendor{}
	err := m.db.QueryRow(ctx, query, vendorID).Scan(
		&vendor.ID,
		&vendor.InstanceName,
		&vendor.DisplayName,
		&vendor.Host,
		&vendor.Port,
		&vendor.UseTLS,
		&vendor.BindType,
		&vendor.Throughput,
		&vendor.Priority,
		&vendor.IsPrimary,
		&vendor.IsActive,
		&vendor.Username,
		&vendor.Password,
		&vendor.SystemType,
	)
	if err != nil {
		return fmt.Errorf("failed to reload vendor: %w", err)
	}

	// Create new client with updated config
	newClient, err := NewSMPPClient(vendor, m.config)
	if err != nil {
		return fmt.Errorf("failed to create new client: %w", err)
	}

	// Replace old client
	m.connectors[vendorID] = newClient

	// Attempt connection in background
	go func() {
		if err := newClient.Connect(context.Background()); err != nil {
			log.WithFields(log.Fields{
				"vendor_id": vendorID,
				"error":     err,
			}).Error("Failed to reconnect vendor")
		}
	}()

	log.WithField("vendor_id", vendorID).Info("Vendor reconnection initiated")
	return nil
}

// DisconnectVendor gracefully disconnects a vendor
func (m *Manager) DisconnectVendor(ctx context.Context, vendorID string) error {
	m.mu.RLock()
	client, exists := m.connectors[vendorID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("vendor not found: %s", vendorID)
	}

	log.WithField("vendor_id", vendorID).Info("Disconnecting vendor...")
	return client.Disconnect(ctx)
}

// ConnectVendor attempts to connect a vendor
func (m *Manager) ConnectVendor(ctx context.Context, vendorID string) error {
	m.mu.RLock()
	client, exists := m.connectors[vendorID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("vendor not found: %s", vendorID)
	}

	log.WithField("vendor_id", vendorID).Info("Connecting vendor...")
	return client.Connect(ctx)
}

// StopAll gracefully stops all vendor connections
func (m *Manager) StopAll(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	log.Info("Stopping all vendor connections...")

	for vendorID, client := range m.connectors {
		log.WithField("vendor_id", vendorID).Info("Stopping vendor connection...")
		if err := client.Disconnect(ctx); err != nil {
			log.WithFields(log.Fields{
				"vendor_id": vendorID,
				"error":     err,
			}).Error("Error disconnecting from vendor")
		}
	}

	// Close database pool
	m.db.Close()
	log.Info("All vendor connections stopped")

	return nil
}
