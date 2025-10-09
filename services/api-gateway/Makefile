# Makefile for WARP API Gateway

.PHONY: help build run test clean docker-build deploy

# Variables
BINARY_NAME=api-server
DOCKER_IMAGE=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway
GO=$(shell which go || echo ~/.local/go/bin/go)

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the API server binary
	$(GO) build -o $(BINARY_NAME) ./cmd/server

run: ## Run the API server locally
	$(GO) run ./cmd/server/main.go

test: ## Run tests
	$(GO) test -v ./...

test-coverage: ## Run tests with coverage
	$(GO) test -cover -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html

lint: ## Run linter
	golangci-lint run ./...

clean: ## Clean build artifacts
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html

deps: ## Download dependencies
	$(GO) mod download
	$(GO) mod tidy

docker-build: ## Build Docker image
	docker build -t $(DOCKER_IMAGE):latest .

docker-push: ## Push Docker image to GCP Artifact Registry
	gcloud builds submit --tag $(DOCKER_IMAGE):latest .

deploy-k8s: ## Deploy to Kubernetes
	kubectl apply -f deployments/kubernetes/

logs: ## Show API logs from Kubernetes
	kubectl logs -n warp-api -l app=api-gateway --tail=100 -f

status: ## Check API status in Kubernetes
	kubectl get pods -n warp-api -l app=api-gateway

restart: ## Restart API pods
	kubectl rollout restart deployment/api-gateway -n warp-api

# Database migrations
migrate-up: ## Run database migrations
	@echo "TODO: Implement migration runner"
	@echo "Run: psql < migrations/001_create_service_providers.up.sql"

migrate-down: ## Rollback last migration
	@echo "TODO: Implement migration runner"
	@echo "Run: psql < migrations/001_create_service_providers.down.sql"
