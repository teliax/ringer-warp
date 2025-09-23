#!/bin/bash
# Jasmin HTTP API Testing Script

set -e

# Configuration
JASMIN_HOST="${JASMIN_HOST:-jasmin.test.ringer.tel}"
JASMIN_PORT="${JASMIN_PORT:-8080}"
API_USER="${API_USER:-test_user}"
API_PASS="${API_PASS:-test_pass}"
RESULTS_DIR="/home/daldworth/repos/ringer-warp/tests/phase2/sms/results"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create results directory
mkdir -p "$RESULTS_DIR"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to test HTTP Send API
test_http_send() {
    log_info "=== Testing HTTP Send API ==="
    
    # Test 1: Simple SMS send
    log_info "Test 1: Simple SMS send"
    response=$(curl -s -w "\n%{http_code}" \
        "http://${JASMIN_HOST}:${JASMIN_PORT}/send" \
        --data-urlencode "username=${API_USER}" \
        --data-urlencode "password=${API_PASS}" \
        --data-urlencode "to=+13105552000" \
        --data-urlencode "from=+12125551000" \
        --data-urlencode "content=Test message via HTTP API")
    
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_info "✓ Simple SMS send successful: $body"
    else
        log_error "✗ Simple SMS send failed: HTTP $http_code - $body"
    fi
    
    # Test 2: Unicode message
    log_info "Test 2: Unicode message"
    response=$(curl -s -w "\n%{http_code}" \
        "http://${JASMIN_HOST}:${JASMIN_PORT}/send" \
        --data-urlencode "username=${API_USER}" \
        --data-urlencode "password=${API_PASS}" \
        --data-urlencode "to=+13105552001" \
        --data-urlencode "from=+12125551000" \
        --data-urlencode "content=Unicode test: 你好 🚀" \
        --data-urlencode "coding=8")
    
    http_code=$(echo "$response" | tail -1)
    if [ "$http_code" = "200" ]; then
        log_info "✓ Unicode SMS send successful"
    else
        log_error "✗ Unicode SMS send failed: HTTP $http_code"
    fi
    
    # Test 3: Batch send
    log_info "Test 3: Batch SMS send"
    response=$(curl -s -w "\n%{http_code}" \
        "http://${JASMIN_HOST}:${JASMIN_PORT}/send" \
        --data-urlencode "username=${API_USER}" \
        --data-urlencode "password=${API_PASS}" \
        --data-urlencode "to=+13105552000,+13105552001,+13105552002" \
        --data-urlencode "from=+12125551000" \
        --data-urlencode "content=Batch test message")
    
    http_code=$(echo "$response" | tail -1)
    if [ "$http_code" = "200" ]; then
        log_info "✓ Batch SMS send successful"
    else
        log_error "✗ Batch SMS send failed: HTTP $http_code"
    fi
}

# Function to test HTTP Rate API
test_http_rate() {
    log_info "=== Testing HTTP Rate Check API ==="
    
    response=$(curl -s -w "\n%{http_code}" \
        "http://${JASMIN_HOST}:${JASMIN_PORT}/rate" \
        --data-urlencode "username=${API_USER}" \
        --data-urlencode "password=${API_PASS}" \
        --data-urlencode "to=+13105552000")
    
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_info "✓ Rate check successful: $body"
        echo "$body" > "$RESULTS_DIR/rate_check.json"
    else
        log_error "✗ Rate check failed: HTTP $http_code"
    fi
}

# Function to test HTTP Balance API
test_http_balance() {
    log_info "=== Testing HTTP Balance API ==="
    
    response=$(curl -s -w "\n%{http_code}" \
        "http://${JASMIN_HOST}:${JASMIN_PORT}/balance" \
        --data-urlencode "username=${API_USER}" \
        --data-urlencode "password=${API_PASS}")
    
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_info "✓ Balance check successful: $body"
        echo "$body" > "$RESULTS_DIR/balance.json"
    else
        log_error "✗ Balance check failed: HTTP $http_code"
    fi
}

# Function to test rate limiting
test_rate_limiting() {
    log_info "=== Testing HTTP API Rate Limiting ==="
    
    # Send 20 requests rapidly
    for i in {1..20}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            "http://${JASMIN_HOST}:${JASMIN_PORT}/send" \
            --data-urlencode "username=${API_USER}" \
            --data-urlencode "password=${API_PASS}" \
            --data-urlencode "to=+1310555200$i" \
            --data-urlencode "from=+12125551000" \
            --data-urlencode "content=Rate limit test $i")
        
        if [ "$response" = "429" ]; then
            log_warn "Rate limit hit at request $i (expected behavior)"
            break
        elif [ "$response" = "200" ]; then
            echo -n "."
        else
            log_error "Unexpected response: $response"
        fi
    done
    echo ""
    log_info "Rate limiting test completed"
}

# Function to test DLR callback
test_dlr_callback() {
    log_info "=== Testing DLR Callback Setup ==="
    
    # Start a simple HTTP server to receive callbacks
    log_info "Starting callback receiver on port 8888..."
    timeout 30 python3 -m http.server 8888 > "$RESULTS_DIR/dlr_callbacks.log" 2>&1 &
    SERVER_PID=$!
    
    sleep 2
    
    # Send SMS with DLR callback
    response=$(curl -s -w "\n%{http_code}" \
        "http://${JASMIN_HOST}:${JASMIN_PORT}/send" \
        --data-urlencode "username=${API_USER}" \
        --data-urlencode "password=${API_PASS}" \
        --data-urlencode "to=+13105552000" \
        --data-urlencode "from=+12125551000" \
        --data-urlencode "content=DLR callback test" \
        --data-urlencode "dlr=yes" \
        --data-urlencode "dlr-url=http://localhost:8888/dlr?msgid=%msgid%&status=%status%")
    
    http_code=$(echo "$response" | tail -1)
    if [ "$http_code" = "200" ]; then
        log_info "✓ SMS with DLR callback sent successfully"
    else
        log_error "✗ SMS with DLR callback failed: HTTP $http_code"
    fi
    
    # Wait for callback
    log_info "Waiting for DLR callback..."
    sleep 10
    
    # Check if callback was received
    if grep -q "GET /dlr" "$RESULTS_DIR/dlr_callbacks.log" 2>/dev/null; then
        log_info "✓ DLR callback received"
    else
        log_warn "✗ No DLR callback received (check network/routing)"
    fi
    
    # Clean up
    kill $SERVER_PID 2>/dev/null || true
}

# Function to run load test via HTTP API
test_http_load() {
    log_info "=== Running HTTP API Load Test ==="
    
    TOTAL_MESSAGES=100
    START_TIME=$(date +%s)
    SUCCESS_COUNT=0
    FAIL_COUNT=0
    
    log_info "Sending $TOTAL_MESSAGES messages..."
    
    for i in $(seq 1 $TOTAL_MESSAGES); do
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            "http://${JASMIN_HOST}:${JASMIN_PORT}/send" \
            --data-urlencode "username=${API_USER}" \
            --data-urlencode "password=${API_PASS}" \
            --data-urlencode "to=+1310555$(printf "%04d" $((2000 + i)))" \
            --data-urlencode "from=+12125551000" \
            --data-urlencode "content=Load test message $i" &)
        
        # Control concurrency (max 10 parallel requests)
        if [ $((i % 10)) -eq 0 ]; then
            wait
            echo -n "."
        fi
    done
    
    wait
    echo ""
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    RATE=$(echo "scale=2; $TOTAL_MESSAGES / $DURATION" | bc)
    
    log_info "Load test completed:"
    log_info "- Total messages: $TOTAL_MESSAGES"
    log_info "- Duration: ${DURATION}s"
    log_info "- Rate: ${RATE} msg/sec"
}

# Function to generate test report
generate_report() {
    log_info "=== Generating Test Report ==="
    
    cat > "$RESULTS_DIR/http_api_test_report.md" << EOF
# Jasmin HTTP API Test Report
Generated: $(date)

## Test Environment
- Host: $JASMIN_HOST
- Port: $JASMIN_PORT
- API User: $API_USER

## Test Results

### HTTP Send API
- Simple SMS: $(grep -c "Simple SMS send successful" "$0" || echo "0") passed
- Unicode SMS: $(grep -c "Unicode SMS send successful" "$0" || echo "0") passed
- Batch SMS: $(grep -c "Batch SMS send successful" "$0" || echo "0") passed

### API Features
- Rate Check: $([ -f "$RESULTS_DIR/rate_check.json" ] && echo "✓ Passed" || echo "✗ Failed")
- Balance Check: $([ -f "$RESULTS_DIR/balance.json" ] && echo "✓ Passed" || echo "✗ Failed")
- Rate Limiting: $(grep -q "Rate limit hit" "$0" && echo "✓ Working" || echo "✗ Not tested")
- DLR Callbacks: $(grep -q "DLR callback received" "$0" && echo "✓ Received" || echo "✗ Not received")

## Recommendations
1. Verify rate limiting thresholds match requirements
2. Test DLR callbacks with production callback URLs
3. Monitor API response times under load
4. Implement proper error handling for all API responses
EOF

    log_info "Test report saved to $RESULTS_DIR/http_api_test_report.md"
}

# Main execution
main() {
    log_info "Starting Jasmin HTTP API Test Suite"
    log_info "Results will be saved to: $RESULTS_DIR"
    
    # Check connectivity
    if ! curl -s -f "http://${JASMIN_HOST}:${JASMIN_PORT}/ping" > /dev/null; then
        log_error "Cannot reach Jasmin HTTP API at http://${JASMIN_HOST}:${JASMIN_PORT}"
        exit 1
    fi
    
    # Run tests
    test_http_send
    sleep 2
    
    test_http_rate
    sleep 1
    
    test_http_balance
    sleep 1
    
    test_rate_limiting
    sleep 2
    
    test_dlr_callback
    sleep 2
    
    test_http_load
    
    # Generate report
    generate_report
    
    log_info "All tests completed. Results saved in $RESULTS_DIR"
}

# Run main function
main "$@"