# Makefile for WARP SMPP Gateway

.PHONY: help build run test clean docker-build docker-push deploy-k8s

# Variables
SERVICE_NAME := smpp-gateway
DOCKER_REGISTRY := gcr.io/ringer-warp-v01
IMAGE_TAG ?= latest
FULL_IMAGE := $(DOCKER_REGISTRY)/$(SERVICE_NAME):$(IMAGE_TAG)

help:
	@echo "WARP SMPP Gateway - Make targets:"
	@echo "  build          - Build the Go binary"
	@echo "  run            - Run locally with default config"
	@echo "  test           - Run unit tests"
	@echo "  docker-build   - Build Docker image"
	@echo "  docker-push    - Push Docker image to GCR"
	@echo "  deploy-k8s     - Deploy to Kubernetes"
	@echo "  clean          - Clean build artifacts"

build:
	@echo "Building $(SERVICE_NAME)..."
	cd cmd/smpp-gateway && go build -o ../../bin/smpp-gateway

run: build
	@echo "Running $(SERVICE_NAME)..."
	./bin/smpp-gateway

test:
	@echo "Running tests..."
	go test -v ./...

clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	go clean

docker-build:
	@echo "Building Docker image: $(FULL_IMAGE)"
	docker build -t $(FULL_IMAGE) -f Dockerfile .

docker-push: docker-build
	@echo "Pushing Docker image: $(FULL_IMAGE)"
	docker push $(FULL_IMAGE)

deploy-k8s:
	@echo "Deploying to Kubernetes..."
	kubectl apply -f deployments/kubernetes/

logs:
	@echo "Tailing logs..."
	kubectl logs -n messaging -l app=smpp-gateway -f --tail=100

status:
	@echo "Checking deployment status..."
	kubectl get pods -n messaging -l app=smpp-gateway
	kubectl get svc -n messaging -l app=smpp-gateway

# Development helpers
dev-deps:
	@echo "Installing development dependencies..."
	go mod download
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

lint:
	@echo "Running linters..."
	golangci-lint run

fmt:
	@echo "Formatting code..."
	go fmt ./...
	goimports -w .
