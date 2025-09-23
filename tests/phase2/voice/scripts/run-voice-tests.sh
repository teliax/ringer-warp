#!/bin/bash
# Voice Testing Execution Script
# This script runs various SIPp scenarios against the RTPEngine/Kamailio infrastructure

set -e

# Configuration
KAMAILIO_IP="${KAMAILIO_IP:-10.0.1.10}"
KAMAILIO_PORT="${KAMAILIO_PORT:-5060}"
TEST_USER="${TEST_USER:-1001}"
TEST_PASS="${TEST_PASS:-TestPass123!}"
RESULTS_DIR="/home/daldworth/repos/ringer-warp/tests/phase2/voice/results"
SCENARIOS_DIR="/home/daldworth/repos/ringer-warp/tests/phase2/voice/sipp-scenarios"
PCAP_DIR="/home/daldworth/repos/ringer-warp/tests/phase2/test-data"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create results directory
mkdir -p "$RESULTS_DIR"
mkdir -p "$PCAP_DIR"

# Function to print colored output
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to generate test audio PCAP if not exists
generate_test_audio() {
    if [ ! -f "$PCAP_DIR/test_audio.pcap" ]; then
        log_info "Generating test audio PCAP file..."
        # This would normally use a tool to generate PCAP with RTP audio
        # For now, we'll create a placeholder
        touch "$PCAP_DIR/test_audio.pcap"
    fi
}

# Function to run SIPp test
run_sipp_test() {
    local test_name=$1
    local scenario=$2
    local rate=$3
    local calls=$4
    local duration=$5
    local extra_args=$6
    
    log_info "Running test: $test_name"
    log_info "Scenario: $scenario"
    log_info "Rate: $rate cps, Calls: $calls, Duration: ${duration}s"
    
    sipp -sf "$SCENARIOS_DIR/$scenario" \
         -s "$TEST_USER" \
         -i 0.0.0.0 \
         -p 5061 \
         -r "$rate" \
         -l "$calls" \
         -d "$duration" \
         -trace_msg \
         -trace_err \
         -error_file "$RESULTS_DIR/${test_name}_errors.log" \
         -screen_file "$RESULTS_DIR/${test_name}_screen.log" \
         -stf "$RESULTS_DIR/${test_name}_stats.csv" \
         $extra_args \
         "$KAMAILIO_IP:$KAMAILIO_PORT" || {
        log_error "Test $test_name failed"
        return 1
    }
    
    log_info "Test $test_name completed successfully"
    return 0
}

# Function to run registration tests
run_registration_tests() {
    log_info "=== Running Registration Tests ==="
    
    # Basic registration test
    run_sipp_test "registration_basic" \
                  "registration-basic.xml" \
                  1 \
                  10 \
                  3000 \
                  "-au $TEST_USER -ap $TEST_PASS"
    
    # High rate registration test
    run_sipp_test "registration_stress" \
                  "registration-basic.xml" \
                  10 \
                  100 \
                  3000 \
                  "-au $TEST_USER -ap $TEST_PASS"
}

# Function to run call setup tests
run_call_tests() {
    log_info "=== Running Call Setup Tests ==="
    
    # Generate test audio
    generate_test_audio
    
    # Basic call test
    run_sipp_test "call_basic" \
                  "call-setup-basic.xml" \
                  1 \
                  5 \
                  10000 \
                  "-rtp_echo"
    
    # Concurrent calls test
    run_sipp_test "call_concurrent" \
                  "call-setup-basic.xml" \
                  5 \
                  50 \
                  10000 \
                  "-rtp_echo"
}

# Function to run DTMF tests
run_dtmf_tests() {
    log_info "=== Running DTMF Tests ==="
    
    if [ -f "$SCENARIOS_DIR/call-dtmf.xml" ]; then
        run_sipp_test "dtmf_rfc2833" \
                      "call-dtmf.xml" \
                      1 \
                      5 \
                      15000 \
                      "-rtp_echo"
    else
        log_warn "DTMF test scenario not found, skipping"
    fi
}

# Function to analyze RTPEngine statistics
check_rtpengine_stats() {
    log_info "=== Checking RTPEngine Statistics ==="
    
    # Get RTPEngine statistics via CLI
    if command -v rtpengine-ctl &> /dev/null; then
        rtpengine-ctl -ip 127.0.0.1 -port 22223 list totals > "$RESULTS_DIR/rtpengine_stats.txt"
        log_info "RTPEngine statistics saved to $RESULTS_DIR/rtpengine_stats.txt"
    else
        log_warn "rtpengine-ctl not found, skipping statistics collection"
    fi
}

# Function to generate test report
generate_report() {
    log_info "=== Generating Test Report ==="
    
    cat > "$RESULTS_DIR/test_report.md" << EOF
# Voice Test Report
Generated: $(date)

## Test Environment
- Kamailio IP: $KAMAILIO_IP
- Kamailio Port: $KAMAILIO_PORT
- Test User: $TEST_USER

## Test Results Summary

### Registration Tests
EOF

    # Parse registration test results
    for test in registration_basic registration_stress; do
        if [ -f "$RESULTS_DIR/${test}_screen.log" ]; then
            echo "- **$test**: $(grep -o "Successful calls.*" "$RESULTS_DIR/${test}_screen.log" || echo "No results")" >> "$RESULTS_DIR/test_report.md"
        fi
    done
    
    echo -e "\n### Call Setup Tests" >> "$RESULTS_DIR/test_report.md"
    
    # Parse call test results
    for test in call_basic call_concurrent; do
        if [ -f "$RESULTS_DIR/${test}_screen.log" ]; then
            echo "- **$test**: $(grep -o "Successful calls.*" "$RESULTS_DIR/${test}_screen.log" || echo "No results")" >> "$RESULTS_DIR/test_report.md"
        fi
    done
    
    log_info "Test report saved to $RESULTS_DIR/test_report.md"
}

# Main execution
main() {
    log_info "Starting WARP Voice Testing Suite"
    log_info "Results will be saved to: $RESULTS_DIR"
    
    # Check if SIPp is installed
    if ! command -v sipp &> /dev/null; then
        log_error "SIPp is not installed. Please install SIPp first."
        exit 1
    fi
    
    # Run test suites
    run_registration_tests
    sleep 5
    
    run_call_tests
    sleep 5
    
    run_dtmf_tests
    
    # Collect statistics
    check_rtpengine_stats
    
    # Generate report
    generate_report
    
    log_info "All tests completed. Results saved in $RESULTS_DIR"
}

# Run main function
main "$@"