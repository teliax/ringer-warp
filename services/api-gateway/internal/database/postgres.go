package database

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPostgresPool creates a new PostgreSQL connection pool
func NewPostgresPool(ctx context.Context) (*pgxpool.Pool, error) {
	// Build connection string from environment
	host := os.Getenv("DATABASE_HOST")
	if host == "" {
		host = "10.126.0.3" // Cloud SQL private IP
	}

	port := os.Getenv("DATABASE_PORT")
	if port == "" {
		port = "5432"
	}

	dbname := os.Getenv("DATABASE_NAME")
	if dbname == "" {
		dbname = "warp"
	}

	user := os.Getenv("DATABASE_USER")
	if user == "" {
		user = "warp"
	}

	password := os.Getenv("DATABASE_PASSWORD")
	if password == "" {
		return nil, fmt.Errorf("DATABASE_PASSWORD environment variable required")
	}

	sslMode := os.Getenv("DATABASE_SSL_MODE")
	if sslMode == "" {
		sslMode = "disable" // Use "require" in production
	}

	connString := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s pool_max_conns=10 pool_min_conns=2",
		host, port, user, password, dbname, sslMode,
	)

	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("unable to parse connection string: %w", err)
	}

	// Set connection pool settings
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	// Create pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	return pool, nil
}
