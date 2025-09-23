#!/bin/bash
set -euo pipefail

# Kong Route Configuration Script
# Configures Kong API Gateway with WARP routes and plugins

KONG_ADMIN_URL="http://34.41.176.225:8001"
API_BACKEND="http://api-v2.default.svc.cluster.local:8080"

echo "Configuring Kong API Gateway routes..."

# Create WARP API service
echo "Creating API service..."
curl -i -X POST ${KONG_ADMIN_URL}/services \
  --data "name=warp-api" \
  --data "url=${API_BACKEND}"

# Create routes for the API service
echo "Creating API routes..."
curl -i -X POST ${KONG_ADMIN_URL}/services/warp-api/routes \
  --data "name=api-v1-route" \
  --data "paths[]=/v1" \
  --data "strip_path=false"

# Configure JWT plugin for authentication
echo "Configuring JWT authentication..."
curl -i -X POST ${KONG_ADMIN_URL}/services/warp-api/plugins \
  --data "name=jwt" \
  --data "config.key_claim_name=iss" \
  --data "config.secret_is_base64=false"

# Configure rate limiting
echo "Configuring rate limiting..."
curl -i -X POST ${KONG_ADMIN_URL}/services/warp-api/plugins \
  --data "name=rate-limiting" \
  --data "config.minute=1000" \
  --data "config.hour=10000" \
  --data "config.policy=local"

# Configure CORS
echo "Configuring CORS..."
curl -i -X POST ${KONG_ADMIN_URL}/services/warp-api/plugins \
  --data "name=cors" \
  --data "config.origins=*" \
  --data "config.methods=GET,POST,PUT,DELETE,OPTIONS" \
  --data "config.headers=Accept,Accept-Version,Content-Length,Content-MD5,Content-Type,Date,X-Auth-Token,Authorization"

# Create health check route
echo "Creating health check route..."
curl -i -X POST ${KONG_ADMIN_URL}/routes \
  --data "name=health-check" \
  --data "paths[]=/health" \
  --data "service.id=$(curl -s ${KONG_ADMIN_URL}/services/warp-api | jq -r '.id')"

echo "Kong configuration complete!"

# Test the configuration
echo -e "\nTesting configuration..."
curl -i http://34.41.176.225:8000/health

echo -e "\nAvailable routes:"
curl -s ${KONG_ADMIN_URL}/routes | jq -r '.data[].paths[]'