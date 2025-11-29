.PHONY: help build run test docker-build docker-push deploy-k8s gen-docs

# Variables
APP_NAME=api-gateway
IMAGE_NAME=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/$(APP_NAME)
VERSION?=v1.0.0
GCP_PROJECT=ringer-warp-v01

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

deps: ## Install dependencies
	go mod download
	go install github.com/swaggo/swag/cmd/swag@latest

gen-docs: ## Generate Swagger documentation
	swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal

build: gen-docs ## Build the application
	go build -o bin/api-gateway cmd/server/main.go

run: gen-docs ## Run the application locally
	go run cmd/server/main.go

test: ## Run tests
	go test -v ./...

test-coverage: ## Run tests with coverage
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

docker-build: gen-docs ## Build Docker image
	docker build --platform linux/amd64 -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .

docker-push: docker-build ## Push Docker image to Artifact Registry
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest

deploy-k8s: docker-push ## Deploy to Kubernetes
	kubectl apply -f deployments/kubernetes/

logs: ## View logs
	kubectl logs -n warp-api -l app=api-gateway --tail=100 -f

clean: ## Clean build artifacts
	rm -rf bin/ docs/ coverage.out coverage.html

.DEFAULT_GOAL := help
