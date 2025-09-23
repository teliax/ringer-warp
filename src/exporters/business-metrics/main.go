package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gopkg.in/yaml.v2"
)

type Config struct {
	Database struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		Name     string `yaml:"name"`
		User     string `yaml:"user"`
		SSLMode  string `yaml:"sslmode"`
		Password string
	} `yaml:"database"`
	Redis struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DB       int    `yaml:"db"`
		Password string
	} `yaml:"redis"`
	Metrics struct {
		Port     int           `yaml:"port"`
		Path     string        `yaml:"path"`
		Interval time.Duration `yaml:"interval"`
	} `yaml:"metrics"`
	Queries []MetricQuery `yaml:"queries"`
}

type MetricQuery struct {
	Name  string `yaml:"name"`
	Help  string `yaml:"help"`
	Type  string `yaml:"type"`
	Query string `yaml:"query"`
}

type BusinessExporter struct {
	db      *sql.DB
	redis   *redis.Client
	config  Config
	metrics map[string]interface{}
}

func NewBusinessExporter(config Config) (*BusinessExporter, error) {
	// Connect to PostgreSQL
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = config.Database.Password
	}

	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		config.Database.Host, config.Database.Port, config.Database.User,
		dbPassword, config.Database.Name, config.Database.SSLMode)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Connect to Redis
	redisPassword := os.Getenv("REDIS_PASSWORD")
	if redisPassword == "" {
		redisPassword = config.Redis.Password
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", config.Redis.Host, config.Redis.Port),
		Password: redisPassword,
		DB:       config.Redis.DB,
	})

	if _, err := rdb.Ping(context.Background()).Result(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
		// Continue without Redis - it's optional for caching
	}

	exporter := &BusinessExporter{
		db:      db,
		redis:   rdb,
		config:  config,
		metrics: make(map[string]interface{}),
	}

	// Register metrics
	for _, query := range config.Queries {
		switch query.Type {
		case "counter":
			metric := prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Name: query.Name,
					Help: query.Help,
				},
				extractLabels(query.Query),
			)
			prometheus.MustRegister(metric)
			exporter.metrics[query.Name] = metric

		case "gauge":
			metric := prometheus.NewGaugeVec(
				prometheus.GaugeOpts{
					Name: query.Name,
					Help: query.Help,
				},
				extractLabels(query.Query),
			)
			prometheus.MustRegister(metric)
			exporter.metrics[query.Name] = metric

		case "histogram":
			metric := prometheus.NewHistogramVec(
				prometheus.HistogramOpts{
					Name:    query.Name,
					Help:    query.Help,
					Buckets: prometheus.DefBuckets,
				},
				extractLabels(query.Query),
			)
			prometheus.MustRegister(metric)
			exporter.metrics[query.Name] = metric
		}
	}

	return exporter, nil
}

func extractLabels(query string) []string {
	// Simple label extraction - looks for column names after SELECT that aren't "value"
	// In production, use proper SQL parsing
	labels := []string{}
	// Check if query has GROUP BY
	if contains(query, "GROUP BY") {
		// Extract grouped columns as labels
		// Simplified - in production use SQL parser
		labels = append(labels, "type", "direction", "call_type", "status")
	}
	return labels
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && s[len(s)-len(substr):] == substr
}

func (e *BusinessExporter) CollectMetrics() {
	for _, query := range e.config.Queries {
		rows, err := e.db.Query(query.Query)
		if err != nil {
			log.Printf("Error executing query %s: %v", query.Name, err)
			continue
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			log.Printf("Error getting columns for %s: %v", query.Name, err)
			continue
		}

		for rows.Next() {
			values := make([]interface{}, len(cols))
			valuePtrs := make([]interface{}, len(cols))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				log.Printf("Error scanning row for %s: %v", query.Name, err)
				continue
			}

			// Extract value and labels
			var metricValue float64
			labels := prometheus.Labels{}

			for i, col := range cols {
				if col == "value" {
					switch v := values[i].(type) {
					case int64:
						metricValue = float64(v)
					case float64:
						metricValue = v
					case []byte:
						fmt.Sscanf(string(v), "%f", &metricValue)
					}
				} else {
					if values[i] != nil {
						labels[col] = fmt.Sprintf("%v", values[i])
					}
				}
			}

			// Update metric
			switch metric := e.metrics[query.Name].(type) {
			case *prometheus.CounterVec:
				metric.With(labels).Add(metricValue)
			case *prometheus.GaugeVec:
				metric.With(labels).Set(metricValue)
			case *prometheus.HistogramVec:
				metric.With(labels).Observe(metricValue)
			}
		}
	}
}

func (e *BusinessExporter) Start() {
	// Start metrics collection loop
	go func() {
		ticker := time.NewTicker(e.config.Metrics.Interval)
		defer ticker.Stop()

		// Collect immediately on start
		e.CollectMetrics()

		for range ticker.C {
			e.CollectMetrics()
		}
	}()

	// Start HTTP server
	http.Handle(e.config.Metrics.Path, promhttp.Handler())
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if err := e.db.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Database connection failed"))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Ready"))
	})

	addr := fmt.Sprintf(":%d", e.config.Metrics.Port)
	log.Printf("Starting metrics server on %s%s", addr, e.config.Metrics.Path)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func main() {
	// Load configuration
	configFile := "/etc/exporter/config.yaml"
	if env := os.Getenv("CONFIG_FILE"); env != "" {
		configFile = env
	}

	data, err := os.ReadFile(configFile)
	if err != nil {
		log.Fatalf("Failed to read config file: %v", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		log.Fatalf("Failed to parse config: %v", err)
	}

	// Create and start exporter
	exporter, err := NewBusinessExporter(config)
	if err != nil {
		log.Fatalf("Failed to create exporter: %v", err)
	}

	exporter.Start()
}