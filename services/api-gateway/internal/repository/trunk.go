package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ringer-warp/api-gateway/internal/models"
)

type TrunkRepository struct {
	db *pgxpool.Pool
}

func NewTrunkRepository(db *pgxpool.Pool) *TrunkRepository {
	return &TrunkRepository{db: db}
}

// CreateTrunk creates a new SIP trunk for a customer
func (r *TrunkRepository) CreateTrunk(ctx context.Context, customerID uuid.UUID, req *models.CreateTrunkRequest) (*models.Trunk, error) {
	query := `
		INSERT INTO voice.trunks (
			customer_id, trunk_name, trunk_code, partition_id,
			inbound_config, outbound_config, codecs,
			max_concurrent_calls, calls_per_second_limit
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, customer_id, trunk_name, trunk_code, partition_id,
		          inbound_config, outbound_config, codecs,
		          max_concurrent_calls, calls_per_second_limit,
		          status, created_at, updated_at
	`

	trunk := &models.Trunk{}
	err := r.db.QueryRow(ctx, query,
		customerID,
		req.TrunkName,
		req.TrunkCode,
		req.PartitionID,
		req.InboundConfig,
		req.OutboundConfig,
		req.Codecs,
		coalesce(req.MaxConcurrentCalls, 100),
		coalesce(req.CallsPerSecondLimit, 10),
	).Scan(
		&trunk.ID,
		&trunk.CustomerID,
		&trunk.TrunkName,
		&trunk.TrunkCode,
		&trunk.PartitionID,
		&trunk.InboundConfig,
		&trunk.OutboundConfig,
		&trunk.Codecs,
		&trunk.MaxConcurrentCalls,
		&trunk.CallsPerSecondLimit,
		&trunk.Status,
		&trunk.CreatedAt,
		&trunk.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create trunk: %w", err)
	}

	return trunk, nil
}

// GetTrunkByID retrieves a trunk by ID
func (r *TrunkRepository) GetTrunkByID(ctx context.Context, id uuid.UUID) (*models.Trunk, error) {
	query := `
		SELECT id, customer_id, trunk_name, trunk_code, partition_id,
		       inbound_config, outbound_config, codecs,
		       max_concurrent_calls, calls_per_second_limit,
		       status, created_at, updated_at
		FROM voice.trunks
		WHERE id = $1
	`

	trunk := &models.Trunk{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&trunk.ID,
		&trunk.CustomerID,
		&trunk.TrunkName,
		&trunk.TrunkCode,
		&trunk.PartitionID,
		&trunk.InboundConfig,
		&trunk.OutboundConfig,
		&trunk.Codecs,
		&trunk.MaxConcurrentCalls,
		&trunk.CallsPerSecondLimit,
		&trunk.Status,
		&trunk.CreatedAt,
		&trunk.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get trunk: %w", err)
	}

	return trunk, nil
}
