#!/bin/bash
# Basic Kong API Gateway Test

KONG_URL="http://34.41.176.225"
RESULTS_DIR="/home/daldworth/repos/ringer-warp/tests/phase2/results"
mkdir -p "$RESULTS_DIR"

echo "=== Kong API Gateway Basic Test ==="
echo "Target: $KONG_URL"
echo ""

# Test 1: Basic connectivity
echo "1. Testing basic connectivity..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$KONG_URL/")
echo "   Root endpoint: HTTP $response"

# Test 2: Check for common endpoints
endpoints=("/status" "/health" "/api/health" "/v1/health" "/metrics")
echo ""
echo "2. Testing common endpoints..."
for endpoint in "${endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$KONG_URL$endpoint")
    echo "   $endpoint: HTTP $response"
done

# Test 3: Check Kong headers
echo ""
echo "3. Checking Kong headers..."
curl -s -I "$KONG_URL/" | grep -i "kong\|server" || echo "   No Kong headers found"

# Test 4: Test with different methods
echo ""
echo "4. Testing HTTP methods..."
for method in GET POST PUT DELETE; do
    response=$(curl -s -X $method -o /dev/null -w "%{http_code}" "$KONG_URL/")
    echo "   $method /: HTTP $response"
done

# Test 5: Authentication test (expecting 401)
echo ""
echo "5. Testing authentication requirement..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$KONG_URL/v1/customers")
echo "   /v1/customers without auth: HTTP $response (expecting 401)"

# Save results
echo ""
echo "Saving results to $RESULTS_DIR/kong-basic-test.log"
echo "Test completed at $(date)" > "$RESULTS_DIR/kong-basic-test.log"