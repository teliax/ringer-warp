package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration for the SMPP Gateway
type Config struct {
	// SMPP Server Config
	SMPPHost    string
	SMPPPort    int
	SMPPTLSPort int
	TLSCertPath string
	TLSKeyPath  string

	// Database Config
	PostgresHost     string
	PostgresPort     int
	PostgresUser     string
	PostgresPassword string
	PostgresDB       string
	PostgresSSLMode  string

	// Redis Config
	RedisHost     string
	RedisPort     int
	RedisPassword string
	RedisDB       int

	// RabbitMQ Config
	RabbitMQHost     string
	RabbitMQPort     int
	RabbitMQUser     string
	RabbitMQPassword string
	RabbitMQVHost    string

	// Service Config
	APIPort     int
	MetricsPort int
	LogLevel    string
	Environment string
}

// LoadFromEnv loads configuration from environment variables
func LoadFromEnv() (*Config, error) {
	cfg := &Config{
		// SMPP Server
		SMPPHost:    getEnv("SMPP_HOST", "0.0.0.0"),
		SMPPPort:    getEnvInt("SMPP_PORT", 2775),
		SMPPTLSPort: getEnvInt("SMPP_TLS_PORT", 2776),
		TLSCertPath: getEnv("TLS_CERT_PATH", "/etc/smpp/tls/tls.crt"),
		TLSKeyPath:  getEnv("TLS_KEY_PATH", "/etc/smpp/tls/tls.key"),

		// PostgreSQL
		PostgresHost:     getEnv("POSTGRES_HOST", "10.126.0.3"),
		PostgresPort:     getEnvInt("POSTGRES_PORT", 5432),
		PostgresUser:     getEnv("POSTGRES_USER", "warp"),
		PostgresPassword: getEnv("POSTGRES_PASSWORD", ""),
		PostgresDB:       getEnv("POSTGRES_DB", "warp"),
		PostgresSSLMode:  getEnv("POSTGRES_SSL_MODE", "disable"),

		// Redis
		RedisHost:     getEnv("REDIS_HOST", "redis-service.messaging.svc.cluster.local"),
		RedisPort:     getEnvInt("REDIS_PORT", 6379),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvInt("REDIS_DB", 0),

		// RabbitMQ
		RabbitMQHost:     getEnv("RABBITMQ_HOST", "rabbitmq-service.messaging.svc.cluster.local"),
		RabbitMQPort:     getEnvInt("RABBITMQ_PORT", 5672),
		RabbitMQUser:     getEnv("RABBITMQ_USER", "smpp"),
		RabbitMQPassword: getEnv("RABBITMQ_PASSWORD", ""),
		RabbitMQVHost:    getEnv("RABBITMQ_VHOST", "/smpp"),

		// Service
		APIPort:     getEnvInt("API_PORT", 8080),
		MetricsPort: getEnvInt("METRICS_PORT", 9090),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
		Environment: getEnv("ENVIRONMENT", "production"),
	}

	// Validate required fields
	if cfg.PostgresPassword == "" {
		return nil, fmt.Errorf("POSTGRES_PASSWORD is required")
	}

	return cfg, nil
}

// PostgresDSN returns the PostgreSQL connection string
func (c *Config) PostgresDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.PostgresHost,
		c.PostgresPort,
		c.PostgresUser,
		c.PostgresPassword,
		c.PostgresDB,
		c.PostgresSSLMode,
	)
}

// RedisAddr returns the Redis connection address
func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%d", c.RedisHost, c.RedisPort)
}

// RabbitMQURL returns the RabbitMQ AMQP URL
func (c *Config) RabbitMQURL() string {
	return fmt.Sprintf(
		"amqp://%s:%s@%s:%d/%s",
		c.RabbitMQUser,
		c.RabbitMQPassword,
		c.RabbitMQHost,
		c.RabbitMQPort,
		c.RabbitMQVHost,
	)
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
