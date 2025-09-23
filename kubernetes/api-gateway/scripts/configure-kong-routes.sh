#!/bin/bash
# Configure Kong routes for WARP API

set -euo pipefail

# Kong Admin API URL
KONG_ADMIN="http://kong-admin:8001"
KONG_NAMESPACE="kong"

# Protected endpoints that require authentication
PROTECTED_ENDPOINTS=(
    "/v1/customers"
    "/v1/trunks"
    "/v1/partitions"
    "/v1/providers"
    "/v1/routing"
    "/v1/messaging"
    "/v1/cdrs"
    "/v1/billing"
    "/v1/metrics"
)

# Public endpoints (no auth required)
PUBLIC_ENDPOINTS=(
    "/v1/health"
    "/v1/auth/login"
    "/v1/auth/refresh"
)

# Create routes for protected endpoints
echo "Creating protected API routes..."
for endpoint in "${PROTECTED_ENDPOINTS[@]}"; do
    echo "Adding route: $endpoint"
    kubectl run -it --rm kong-config-$RANDOM --image=curlimages/curl --restart=Never -n $KONG_NAMESPACE -- \
        curl -s -X POST $KONG_ADMIN/services/warp-api/routes \
        -d "paths[]=$endpoint" \
        -d "strip_path=false" \
        -d "hosts[]=api.ringer.tel" \
        -d "methods[]=GET" \
        -d "methods[]=POST" \
        -d "methods[]=PUT" \
        -d "methods[]=PATCH" \
        -d "methods[]=DELETE" \
        -d "methods[]=OPTIONS"
done

# Add JWT authentication plugin to protected routes
echo "Adding JWT authentication to protected routes..."
kubectl run -it --rm kong-config-jwt --image=curlimages/curl --restart=Never -n $KONG_NAMESPACE -- \
    curl -s -X POST $KONG_ADMIN/plugins \
    -d "name=jwt" \
    -d "service.name=warp-api" \
    -d "config.key_claim_name=iss" \
    -d "config.claims_to_verify[]=exp"

# Add API key authentication as alternative
echo "Adding API key authentication..."
kubectl run -it --rm kong-config-apikey --image=curlimages/curl --restart=Never -n $KONG_NAMESPACE -- \
    curl -s -X POST $KONG_ADMIN/plugins \
    -d "name=key-auth" \
    -d "service.name=warp-api" \
    -d "config.key_names[]=X-API-Key" \
    -d "config.key_names[]=apikey" \
    -d "config.hide_credentials=true"

echo "Kong routes configuration completed!"