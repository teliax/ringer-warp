package config

import (
	"fmt"
	"net/url"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Auth     AuthConfig
	SMPP     SMPPConfig
}

type ServerConfig struct {
	Port         string
	Environment  string
	AllowOrigins []string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	SSLMode  string
	MaxConns int32
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type AuthConfig struct {
	GoogleClientID string
	JWTSecret      string
	JWTExpiration  int // hours (deprecated - use hardcoded in main.go)
}

type SMPPConfig struct {
	GatewayURL string // go-smpp gateway URL
}

func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/warp/")

	// Environment variable overrides
	viper.AutomaticEnv()
	viper.SetEnvPrefix("WARP")

	// Set defaults
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.environment", "production")
	viper.SetDefault("database.port", "5432")
	viper.SetDefault("database.sslmode", "require")
	viper.SetDefault("database.maxconns", 25)
	viper.SetDefault("redis.port", "6379")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("auth.jwt_expiration", 24)

	// Read config file if exists
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
		// Config file not found, use environment variables
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Override with environment variables for sensitive data
	if dbPassword := os.Getenv("DATABASE_PASSWORD"); dbPassword != "" {
		config.Database.Password = dbPassword
	}
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		config.Auth.JWTSecret = jwtSecret
	}
	if googleClientID := os.Getenv("GOOGLE_CLIENT_ID"); googleClientID != "" {
		config.Auth.GoogleClientID = googleClientID
	}
	if redisPassword := os.Getenv("REDIS_PASSWORD"); redisPassword != "" {
		config.Redis.Password = redisPassword
	}

	return &config, nil
}

func (c *Config) DatabaseDSN() string {
	// URL-encode password to handle special characters
	password := url.QueryEscape(c.Database.Password)

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.Database.User,
		password,
		c.Database.Host,
		c.Database.Port,
		c.Database.Database,
		c.Database.SSLMode,
	)
}

func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%s", c.Redis.Host, c.Redis.Port)
}
