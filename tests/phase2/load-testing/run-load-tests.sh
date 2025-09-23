#!/bin/bash
# Load Testing Execution Script for WARP Platform

set -e

# Configuration
BASE_URL="${BASE_URL:-https://api.ringer.tel}"
SMS_API_URL="${SMS_API_URL:-http://jasmin.ringer.tel:8080}"
RESULTS_DIR="/home/daldworth/repos/ringer-warp/tests/phase2/load-testing/results"
GRAFANA_URL="${GRAFANA_URL:-http://grafana.ringer.tel:3000}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Function to check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install k6 first."
        log_info "Installation: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    log_info "k6 version: $(k6 version)"
}

# Function to run k6 test
run_k6_test() {
    local test_name=$1
    local test_file=$2
    local vus=$3
    local duration=$4
    local extra_args=$5
    
    log_info "Running load test: $test_name"
    log_info "VUs: $vus, Duration: $duration"
    
    k6 run \
        --out json="$RESULTS_DIR/${test_name}_raw.json" \
        --summary-export="$RESULTS_DIR/${test_name}_summary.json" \
        -e BASE_URL="$BASE_URL" \
        -e SMS_API_URL="$SMS_API_URL" \
        $extra_args \
        "$test_file" || {
        log_error "Load test $test_name failed"
        return 1
    }
    
    log_info "Load test $test_name completed"
    return 0
}

# Function to run stress test
run_stress_test() {
    log_section "Running Stress Test"
    
    cat > "$RESULTS_DIR/stress-test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/v1/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
EOF

    run_k6_test "stress_test" "$RESULTS_DIR/stress-test.js" "" "" ""
}

# Function to run soak test
run_soak_test() {
    log_section "Running Soak Test"
    
    cat > "$RESULTS_DIR/soak-test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Ramp up to 50 users
    { duration: '30m', target: 50 },   // Stay at 50 users for 30 minutes
    { duration: '5m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Rotate through different endpoints
  const endpoints = [
    '/v1/health',
    '/v1/customers',
    '/v1/trunks',
    '/v1/routing/rules',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${__ENV.BASE_URL}${endpoint}`);
  
  check(res, {
    'status not 5xx': (r) => r.status < 500,
  });
  
  sleep(Math.random() * 3 + 1);
}
EOF

    run_k6_test "soak_test" "$RESULTS_DIR/soak-test.js" "" "" ""
}

# Function to analyze results
analyze_results() {
    log_section "Analyzing Test Results"
    
    # Parse k6 summary files
    for summary_file in "$RESULTS_DIR"/*_summary.json; do
        if [ -f "$summary_file" ]; then
            test_name=$(basename "$summary_file" _summary.json)
            log_info "Analyzing $test_name results..."
            
            # Extract key metrics using jq if available
            if command -v jq &> /dev/null; then
                total_requests=$(jq '.metrics.http_reqs.values.count' "$summary_file")
                avg_duration=$(jq '.metrics.http_req_duration.values.avg' "$summary_file")
                p95_duration=$(jq '.metrics.http_req_duration.values."p(95)"' "$summary_file")
                error_rate=$(jq '.metrics.http_req_failed.values.rate' "$summary_file")
                
                log_info "  Total Requests: $total_requests"
                log_info "  Avg Duration: ${avg_duration}ms"
                log_info "  P95 Duration: ${p95_duration}ms"
                log_info "  Error Rate: $(echo "$error_rate * 100" | bc)%"
            fi
        fi
    done
}

# Function to generate HTML report
generate_html_report() {
    log_section "Generating HTML Report"
    
    cat > "$RESULTS_DIR/load_test_report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>WARP Platform Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .metric { font-weight: bold; color: #2196F3; }
        .pass { color: green; }
        .fail { color: red; }
    </style>
</head>
<body>
    <h1>WARP Platform Load Test Report</h1>
    <p>Generated: $(date)</p>
    
    <h2>Test Environment</h2>
    <ul>
        <li>API URL: $BASE_URL</li>
        <li>SMS URL: $SMS_API_URL</li>
        <li>Test Duration: $(date)</li>
    </ul>
    
    <h2>Test Results Summary</h2>
    <table>
        <tr>
            <th>Test Type</th>
            <th>Total Requests</th>
            <th>Avg Response Time</th>
            <th>P95 Response Time</th>
            <th>Error Rate</th>
            <th>Status</th>
        </tr>
EOF

    # Add test results to HTML
    for summary_file in "$RESULTS_DIR"/*_summary.json; do
        if [ -f "$summary_file" ] && command -v jq &> /dev/null; then
            test_name=$(basename "$summary_file" _summary.json)
            total_requests=$(jq '.metrics.http_reqs.values.count' "$summary_file")
            avg_duration=$(jq '.metrics.http_req_duration.values.avg' "$summary_file" | xargs printf "%.2f")
            p95_duration=$(jq '.metrics.http_req_duration.values."p(95)"' "$summary_file" | xargs printf "%.2f")
            error_rate=$(jq '.metrics.http_req_failed.values.rate' "$summary_file" | xargs printf "%.2f")
            
            if (( $(echo "$error_rate < 0.05" | bc -l) )); then
                status="<span class='pass'>PASS</span>"
            else
                status="<span class='fail'>FAIL</span>"
            fi
            
            cat >> "$RESULTS_DIR/load_test_report.html" << EOF
        <tr>
            <td>$test_name</td>
            <td class='metric'>$total_requests</td>
            <td>${avg_duration}ms</td>
            <td>${p95_duration}ms</td>
            <td>${error_rate}%</td>
            <td>$status</td>
        </tr>
EOF
        fi
    done
    
    cat >> "$RESULTS_DIR/load_test_report.html" << EOF
    </table>
    
    <h2>Recommendations</h2>
    <ul>
        <li>Monitor response times during peak hours</li>
        <li>Scale infrastructure if P95 exceeds 1 second</li>
        <li>Investigate any endpoints with >5% error rate</li>
        <li>Consider implementing caching for frequently accessed data</li>
    </ul>
    
    <h2>Grafana Dashboard</h2>
    <p>View real-time metrics at: <a href="$GRAFANA_URL">$GRAFANA_URL</a></p>
</body>
</html>
EOF

    log_info "HTML report generated: $RESULTS_DIR/load_test_report.html"
}

# Main execution
main() {
    log_section "WARP Platform Load Testing Suite"
    log_info "Results will be saved to: $RESULTS_DIR"
    
    # Check dependencies
    check_k6
    
    # Run main load test
    if [ -f "/home/daldworth/repos/ringer-warp/tests/phase2/load-testing/k6-load-test.js" ]; then
        log_section "Running Main Load Test"
        run_k6_test "main_load_test" \
            "/home/daldworth/repos/ringer-warp/tests/phase2/load-testing/k6-load-test.js" \
            "" "" ""
    fi
    
    # Run stress test
    run_stress_test
    
    # Optional: Run soak test (commented out due to duration)
    # run_soak_test
    
    # Analyze results
    analyze_results
    
    # Generate report
    generate_html_report
    
    log_section "Load Testing Complete"
    log_info "Results saved in: $RESULTS_DIR"
    log_info "View HTML report: $RESULTS_DIR/load_test_report.html"
}

# Run main function
main "$@"