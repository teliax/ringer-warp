package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserTypeRepository struct {
	db *pgxpool.Pool
}

func NewUserTypeRepository(db *pgxpool.Pool) *UserTypeRepository {
	return &UserTypeRepository{db: db}
}

// GetUserTypeIDByName returns user type ID by name
func (r *UserRepository) GetUserTypeIDByName(ctx context.Context, typeName string) (uuid.UUID, error) {
	query := `SELECT id FROM auth.user_types WHERE type_name = $1`

	var typeID uuid.UUID
	err := r.db.QueryRow(ctx, query, typeName).Scan(&typeID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to get user type by name: %w", err)
	}

	return typeID, nil
}
