#!/bin/bash
# Master Test Orchestration Script for WARP Phase 2
# Runs all test suites in sequence and generates consolidated report

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_BASE="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_RUN_DIR="$RESULTS_BASE/test-run-$TIMESTAMP"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Create test run directory
mkdir -p "$TEST_RUN_DIR"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$TEST_RUN_DIR/test.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$TEST_RUN_DIR/test.log"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$TEST_RUN_DIR/test.log"
}

log_section() {
    echo -e "\n${BLUE}$1${NC}\n" | tee -a "$TEST_RUN_DIR/test.log"
    echo "======================================" | tee -a "$TEST_RUN_DIR/test.log"
}

# Test execution tracking
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local script_path=$2
    local skip_on_fail=${3:-false}
    
    log_section "Running $suite_name Tests"
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    # Create suite results directory
    mkdir -p "$TEST_RUN_DIR/$suite_name"
    
    # Run the test
    if [ -x "$script_path" ]; then
        if $script_path > "$TEST_RUN_DIR/$suite_name/output.log" 2>&1; then
            log_info "✓ $suite_name tests PASSED"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            TEST_RESULTS+=("✓ $suite_name: PASSED")
            
            # Copy results if they exist
            if [ -d "$(dirname "$script_path")/../results" ]; then
                cp -r "$(dirname "$script_path")/../results/"* "$TEST_RUN_DIR/$suite_name/" 2>/dev/null || true
            fi
            
            return 0
        else
            log_error "✗ $suite_name tests FAILED"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            TEST_RESULTS+=("✗ $suite_name: FAILED")
            
            if [ "$skip_on_fail" = "true" ]; then
                log_warn "Skipping remaining tests due to critical failure"
                return 1
            fi
        fi
    else
        log_error "$suite_name test script not found or not executable: $script_path"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("✗ $suite_name: NOT FOUND")
    fi
    
    return 0
}

# Function to check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    local missing_tools=()
    
    # Check for required tools
    command -v python3 >/dev/null 2>&1 || missing_tools+=("python3")
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    command -v jq >/dev/null 2>&1 || missing_tools+=("jq")
    command -v sipp >/dev/null 2>&1 || log_warn "SIPp not installed (voice tests may fail)"
    command -v k6 >/dev/null 2>&1 || log_warn "k6 not installed (load tests may fail)"
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install missing tools before running tests"
        return 1
    fi
    
    # Check Python packages
    python3 -c "import smpplib" 2>/dev/null || {
        log_warn "Python smpplib not installed"
        log_info "Installing: pip install smpplib"
    }
    
    python3 -c "import requests" 2>/dev/null || {
        log_warn "Python requests not installed"
        log_info "Installing: pip install requests"
    }
    
    python3 -c "import jwt" 2>/dev/null || {
        log_warn "Python PyJWT not installed"
        log_info "Installing: pip install PyJWT"
    }
    
    log_info "Prerequisites check completed"
    return 0
}

# Function to generate consolidated report
generate_consolidated_report() {
    log_section "Generating Consolidated Test Report"
    
    local report_file="$TEST_RUN_DIR/consolidated_report.md"
    local html_report="$TEST_RUN_DIR/test_report.html"
    
    # Markdown Report
    cat > "$report_file" << EOF
# WARP Phase 2 Test Report

**Test Run:** $TIMESTAMP  
**Total Test Suites:** $TESTS_TOTAL  
**Passed:** $TESTS_PASSED  
**Failed:** $TESTS_FAILED  
**Success Rate:** $(awk "BEGIN {printf \"%.1f\", ($TESTS_PASSED/$TESTS_TOTAL)*100}")%

## Test Suite Results

EOF

    for result in "${TEST_RESULTS[@]}"; do
        echo "- $result" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## Test Categories

### Voice Testing (RTPEngine/Kamailio)
- SIP Registration Tests
- Call Setup and Teardown
- Media Flow Validation
- DTMF Testing
- Load Testing

### SMS Testing (Jasmin SMSC)
- SMPP Connectivity
- Message Delivery (MT/MO)
- Delivery Reports
- HTTP API Testing
- Bulk Messaging

### API Gateway Testing (Kong)
- Authentication (JWT/API Key)
- Authorization and ACLs
- Rate Limiting
- CORS Configuration
- Performance Testing

### Integration Testing
- End-to-End Scenarios
- Cross-Service Workflows
- Failover Testing
- Data Consistency

### Load Testing
- Concurrent Users
- Throughput Testing
- Stress Testing
- Performance Benchmarks

## Recommendations

1. **Infrastructure Scaling**
   - Monitor resource usage during peak load
   - Scale horizontally if needed
   - Implement caching strategies

2. **Security Hardening**
   - Regular security audits
   - Update authentication tokens
   - Monitor for anomalous traffic

3. **Performance Optimization**
   - Optimize database queries
   - Implement connection pooling
   - Use CDN for static assets

4. **Monitoring Enhancement**
   - Set up alerting thresholds
   - Create custom dashboards
   - Implement distributed tracing

## Next Steps

1. Address any failed test cases
2. Run extended soak tests
3. Perform security penetration testing
4. Validate disaster recovery procedures
5. Document operational runbooks
EOF

    # HTML Report
    cat > "$html_report" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>WARP Phase 2 Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        h1, h2, h3 { margin-top: 0; }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        .test-results {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        .pass { color: #22c55e; font-weight: bold; }
        .fail { color: #ef4444; font-weight: bold; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            background-color: #f9fafb;
            font-weight: 600;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>WARP Phase 2 Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">$TESTS_TOTAL</div>
            <div class="metric-label">Total Test Suites</div>
        </div>
        <div class="metric">
            <div class="metric-value">$TESTS_PASSED</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value">$TESTS_FAILED</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">$(awk "BEGIN {printf \"%.1f\", ($TESTS_PASSED/$TESTS_TOTAL)*100}")%</div>
            <div class="metric-label">Success Rate</div>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Test Suite Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Suite</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
EOF

    for result in "${TEST_RESULTS[@]}"; do
        if [[ $result == *"PASSED"* ]]; then
            status_class="pass"
            status_text="PASSED"
        else
            status_class="fail"
            status_text="FAILED"
        fi
        suite_name=$(echo "$result" | cut -d':' -f1 | sed 's/[✓✗] //')
        echo "                <tr>" >> "$html_report"
        echo "                    <td>$suite_name</td>" >> "$html_report"
        echo "                    <td class=\"$status_class\">$status_text</td>" >> "$html_report"
        echo "                    <td><a href=\"$suite_name/output.log\">View Logs</a></td>" >> "$html_report"
        echo "                </tr>" >> "$html_report"
    done
    
    cat >> "$html_report" << EOF
            </tbody>
        </table>
    </div>
    
    <div class="test-results">
        <h2>Test Categories</h2>
        <ul>
            <li><strong>Voice Testing:</strong> SIP registration, call setup, media flow, DTMF</li>
            <li><strong>SMS Testing:</strong> SMPP connectivity, message delivery, bulk messaging</li>
            <li><strong>API Gateway:</strong> Authentication, rate limiting, performance</li>
            <li><strong>Integration:</strong> End-to-end scenarios, failover, data consistency</li>
            <li><strong>Load Testing:</strong> Concurrent users, throughput, stress testing</li>
        </ul>
    </div>
</body>
</html>
EOF

    log_info "Reports generated:"
    log_info "  - Markdown: $report_file"
    log_info "  - HTML: $html_report"
}

# Main execution
main() {
    log_section "WARP Phase 2 Test Orchestration"
    log_info "Test run directory: $TEST_RUN_DIR"
    
    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    # Run test suites in order
    run_test_suite "Voice" "$SCRIPT_DIR/voice/scripts/run-voice-tests.sh"
    run_test_suite "SMS-SMPP" "$SCRIPT_DIR/sms/scripts/smpp-test-client.py"
    run_test_suite "SMS-HTTP" "$SCRIPT_DIR/sms/scripts/http-api-test.sh"
    run_test_suite "API-Gateway" "$SCRIPT_DIR/api-gateway/scripts/kong-test-suite.py"
    run_test_suite "Integration" "$SCRIPT_DIR/integration/scripts/integration-test-runner.py"
    run_test_suite "Load-Testing" "$SCRIPT_DIR/load-testing/run-load-tests.sh"
    
    # Generate consolidated report
    generate_consolidated_report
    
    # Summary
    log_section "Test Execution Summary"
    log_info "Total Test Suites: $TESTS_TOTAL"
    log_info "Passed: $TESTS_PASSED"
    log_info "Failed: $TESTS_FAILED"
    log_info "Success Rate: $(awk "BEGIN {printf \"%.1f\", ($TESTS_PASSED/$TESTS_TOTAL)*100}")%"
    log_info ""
    log_info "Test results saved to: $TEST_RUN_DIR"
    log_info "View HTML report: $TEST_RUN_DIR/test_report.html"
    
    # Exit with appropriate code
    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Run main function
main "$@"