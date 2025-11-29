package repository

import (
	"context"
	"fmt"

	"github.com/ringer-warp/api-gateway/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TrunkRepository struct {
	db *pgxpool.Pool
}

func NewTrunkRepository(db *pgxpool.Pool) *TrunkRepository {
	return &TrunkRepository{db: db}
}

// ============================================================================
// Trunk Group Operations
// ============================================================================

// CreateTrunkGroup creates a new trunk group for a customer
func (r *TrunkRepository) CreateTrunkGroup(ctx context.Context, customerID uuid.UUID, req models.CreateTrunkGroupRequest, createdBy uuid.UUID) (*models.TrunkGroup, error) {
	trunk := &models.TrunkGroup{
		ID:                      uuid.New(),
		CustomerID:              customerID,
		Name:                    req.Name,
		Description:             req.Description,
		AuthType:                req.AuthType,
		CapacityCPS:             req.CapacityCPS,
		CapacityConcurrentCalls: req.CapacityConcurrentCalls,
		Enabled:                 true,
		CreatedBy:               &createdBy,
	}

	query := `
		INSERT INTO accounts.trunk_groups (
			id, customer_id, name, description, auth_type,
			capacity_cps, capacity_concurrent_calls, enabled, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query,
		trunk.ID, trunk.CustomerID, trunk.Name, trunk.Description, trunk.AuthType,
		trunk.CapacityCPS, trunk.CapacityConcurrentCalls, trunk.Enabled, trunk.CreatedBy,
	).Scan(&trunk.CreatedAt, &trunk.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create trunk group: %w", err)
	}

	return trunk, nil
}

// GetTrunkGroup retrieves a trunk group by ID
func (r *TrunkRepository) GetTrunkGroup(ctx context.Context, trunkID uuid.UUID) (*models.TrunkGroup, error) {
	trunk := &models.TrunkGroup{}

	query := `
		SELECT id, customer_id, name, description, auth_type,
		       capacity_cps, capacity_concurrent_calls, enabled,
		       created_at, updated_at, created_by
		FROM accounts.trunk_groups
		WHERE id = $1
	`

	err := r.db.QueryRow(ctx, query, trunkID).Scan(
		&trunk.ID, &trunk.CustomerID, &trunk.Name, &trunk.Description, &trunk.AuthType,
		&trunk.CapacityCPS, &trunk.CapacityConcurrentCalls, &trunk.Enabled,
		&trunk.CreatedAt, &trunk.UpdatedAt, &trunk.CreatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get trunk group: %w", err)
	}

	return trunk, nil
}

// ListTrunkGroupsByCustomer retrieves all trunk groups for a customer
func (r *TrunkRepository) ListTrunkGroupsByCustomer(ctx context.Context, customerID uuid.UUID) ([]models.TrunkGroup, error) {
	query := `
		SELECT id, customer_id, name, description, auth_type,
		       capacity_cps, capacity_concurrent_calls, enabled,
		       created_at, updated_at, created_by
		FROM accounts.trunk_groups
		WHERE customer_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to list trunk groups: %w", err)
	}
	defer rows.Close()

	var trunks []models.TrunkGroup
	for rows.Next() {
		var trunk models.TrunkGroup
		err := rows.Scan(
			&trunk.ID, &trunk.CustomerID, &trunk.Name, &trunk.Description, &trunk.AuthType,
			&trunk.CapacityCPS, &trunk.CapacityConcurrentCalls, &trunk.Enabled,
			&trunk.CreatedAt, &trunk.UpdatedAt, &trunk.CreatedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trunk group: %w", err)
		}
		trunks = append(trunks, trunk)
	}

	return trunks, nil
}

// UpdateTrunkGroup updates a trunk group
func (r *TrunkRepository) UpdateTrunkGroup(ctx context.Context, trunkID uuid.UUID, req models.UpdateTrunkGroupRequest) error {
	// Build dynamic update query
	updates := []string{}
	args := []interface{}{trunkID}
	argCount := 2

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argCount))
		args = append(args, *req.Name)
		argCount++
	}
	if req.Description != nil {
		updates = append(updates, fmt.Sprintf("description = $%d", argCount))
		args = append(args, *req.Description)
		argCount++
	}
	if req.AuthType != nil {
		updates = append(updates, fmt.Sprintf("auth_type = $%d", argCount))
		args = append(args, *req.AuthType)
		argCount++
	}
	if req.CapacityCPS != nil {
		updates = append(updates, fmt.Sprintf("capacity_cps = $%d", argCount))
		args = append(args, *req.CapacityCPS)
		argCount++
	}
	if req.CapacityConcurrentCalls != nil {
		updates = append(updates, fmt.Sprintf("capacity_concurrent_calls = $%d", argCount))
		args = append(args, *req.CapacityConcurrentCalls)
		argCount++
	}
	if req.Enabled != nil {
		updates = append(updates, fmt.Sprintf("enabled = $%d", argCount))
		args = append(args, *req.Enabled)
		argCount++
	}

	if len(updates) == 0 {
		return nil // No updates
	}

	query := fmt.Sprintf(`
		UPDATE accounts.trunk_groups
		SET %s, updated_at = NOW()
		WHERE id = $1
	`, join(updates, ", "))

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update trunk group: %w", err)
	}

	return nil
}

// DeleteTrunkGroup deletes a trunk group (and cascades to trunk_ips)
func (r *TrunkRepository) DeleteTrunkGroup(ctx context.Context, trunkID uuid.UUID) error {
	query := `DELETE FROM accounts.trunk_groups WHERE id = $1`
	_, err := r.db.Exec(ctx, query, trunkID)
	if err != nil {
		return fmt.Errorf("failed to delete trunk group: %w", err)
	}
	return nil
}

// ============================================================================
// Trunk IP Operations
// ============================================================================

// AddTrunkIP adds an IP address to a trunk's ACL
func (r *TrunkRepository) AddTrunkIP(ctx context.Context, trunkID uuid.UUID, req models.AddTrunkIPRequest, createdBy uuid.UUID) (*models.TrunkIP, error) {
	netmask := 32 // Default to single IP
	if req.Netmask != nil {
		netmask = *req.Netmask
	}

	trunkIP := &models.TrunkIP{
		ID:           uuid.New(),
		TrunkGroupID: trunkID,
		IPAddress:    req.IPAddress,
		Netmask:      netmask,
		Description:  req.Description,
		Enabled:      true,
		CreatedBy:    &createdBy,
	}

	query := `
		INSERT INTO accounts.trunk_ips (
			id, trunk_group_id, ip_address, netmask, description, enabled, created_by
		) VALUES (
			$1, $2, $3::inet, $4, $5, $6, $7
		)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query,
		trunkIP.ID, trunkIP.TrunkGroupID, trunkIP.IPAddress, trunkIP.Netmask,
		trunkIP.Description, trunkIP.Enabled, trunkIP.CreatedBy,
	).Scan(&trunkIP.CreatedAt, &trunkIP.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to add trunk IP: %w", err)
	}

	return trunkIP, nil
}

// ListTrunkIPs retrieves all IP ACL entries for a trunk group
func (r *TrunkRepository) ListTrunkIPs(ctx context.Context, trunkID uuid.UUID) ([]models.TrunkIP, error) {
	query := `
		SELECT id, trunk_group_id, ip_address::text, netmask, description, enabled,
		       created_at, updated_at, created_by
		FROM accounts.trunk_ips
		WHERE trunk_group_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, trunkID)
	if err != nil {
		return nil, fmt.Errorf("failed to list trunk IPs: %w", err)
	}
	defer rows.Close()

	var ips []models.TrunkIP
	for rows.Next() {
		var ip models.TrunkIP
		err := rows.Scan(
			&ip.ID, &ip.TrunkGroupID, &ip.IPAddress, &ip.Netmask, &ip.Description,
			&ip.Enabled, &ip.CreatedAt, &ip.UpdatedAt, &ip.CreatedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trunk IP: %w", err)
		}
		ips = append(ips, ip)
	}

	return ips, nil
}

// GetTrunkIP retrieves a specific trunk IP entry
func (r *TrunkRepository) GetTrunkIP(ctx context.Context, ipID uuid.UUID) (*models.TrunkIP, error) {
	ip := &models.TrunkIP{}

	query := `
		SELECT id, trunk_group_id, ip_address::text, netmask, description, enabled,
		       created_at, updated_at, created_by
		FROM accounts.trunk_ips
		WHERE id = $1
	`

	err := r.db.QueryRow(ctx, query, ipID).Scan(
		&ip.ID, &ip.TrunkGroupID, &ip.IPAddress, &ip.Netmask, &ip.Description,
		&ip.Enabled, &ip.CreatedAt, &ip.UpdatedAt, &ip.CreatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get trunk IP: %w", err)
	}

	return ip, nil
}

// UpdateTrunkIP updates a trunk IP entry
func (r *TrunkRepository) UpdateTrunkIP(ctx context.Context, ipID uuid.UUID, req models.UpdateTrunkIPRequest) error {
	updates := []string{}
	args := []interface{}{ipID}
	argCount := 2

	if req.Description != nil {
		updates = append(updates, fmt.Sprintf("description = $%d", argCount))
		args = append(args, *req.Description)
		argCount++
	}
	if req.Enabled != nil {
		updates = append(updates, fmt.Sprintf("enabled = $%d", argCount))
		args = append(args, *req.Enabled)
		argCount++
	}

	if len(updates) == 0 {
		return nil // No updates
	}

	query := fmt.Sprintf(`
		UPDATE accounts.trunk_ips
		SET %s, updated_at = NOW()
		WHERE id = $1
	`, join(updates, ", "))

	_, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update trunk IP: %w", err)
	}

	return nil
}

// DeleteTrunkIP deletes a trunk IP entry
func (r *TrunkRepository) DeleteTrunkIP(ctx context.Context, ipID uuid.UUID) error {
	query := `DELETE FROM accounts.trunk_ips WHERE id = $1`
	_, err := r.db.Exec(ctx, query, ipID)
	if err != nil {
		return fmt.Errorf("failed to delete trunk IP: %w", err)
	}
	return nil
}

// ============================================================================
// Trunk Group with IPs Operations
// ============================================================================

// GetTrunkGroupWithIPs retrieves a trunk group with all its IP ACL entries
func (r *TrunkRepository) GetTrunkGroupWithIPs(ctx context.Context, trunkID uuid.UUID) (*models.TrunkGroupWithIPs, error) {
	trunk, err := r.GetTrunkGroup(ctx, trunkID)
	if err != nil {
		return nil, err
	}

	ips, err := r.ListTrunkIPs(ctx, trunkID)
	if err != nil {
		return nil, err
	}

	return &models.TrunkGroupWithIPs{
		TrunkGroup: *trunk,
		IPs:        ips,
	}, nil
}

// ListTrunkGroupsWithIPsByCustomer retrieves all trunk groups with IPs for a customer
func (r *TrunkRepository) ListTrunkGroupsWithIPsByCustomer(ctx context.Context, customerID uuid.UUID) ([]models.TrunkGroupWithIPs, error) {
	trunks, err := r.ListTrunkGroupsByCustomer(ctx, customerID)
	if err != nil {
		return nil, err
	}

	result := make([]models.TrunkGroupWithIPs, 0, len(trunks))
	for _, trunk := range trunks {
		ips, err := r.ListTrunkIPs(ctx, trunk.ID)
		if err != nil {
			return nil, err
		}

		result = append(result, models.TrunkGroupWithIPs{
			TrunkGroup: trunk,
			IPs:        ips,
		})
	}

	return result, nil
}

// ============================================================================
// Customer Access Verification
// ============================================================================

// VerifyTrunkAccess verifies that a trunk belongs to the given customer
func (r *TrunkRepository) VerifyTrunkAccess(ctx context.Context, trunkID uuid.UUID, customerID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM accounts.trunk_groups
			WHERE id = $1 AND customer_id = $2
		)
	`

	var exists bool
	err := r.db.QueryRow(ctx, query, trunkID, customerID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to verify trunk access: %w", err)
	}

	return exists, nil
}

// VerifyTrunkIPAccess verifies that a trunk IP belongs to the given customer
func (r *TrunkRepository) VerifyTrunkIPAccess(ctx context.Context, ipID uuid.UUID, customerID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM accounts.trunk_ips ti
			JOIN accounts.trunk_groups tg ON ti.trunk_group_id = tg.id
			WHERE ti.id = $1 AND tg.customer_id = $2
		)
	`

	var exists bool
	err := r.db.QueryRow(ctx, query, ipID, customerID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to verify trunk IP access: %w", err)
	}

	return exists, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// Note: join() function is defined in customer.go to avoid duplication
