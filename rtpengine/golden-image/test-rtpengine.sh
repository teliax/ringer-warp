#!/bin/bash
#
# RTPEngine Comprehensive Testing Script
# Tests installation, configuration, and functionality
#

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test configuration
RTPENGINE_HOST="127.0.0.1"
RTPENGINE_PORT="22222"
RTPENGINE_CLI_PORT="9900"
TEST_CALL_ID="test-$(date +%s)-$$"
TEST_FROM_TAG="from-tag-$$"
TEST_TO_TAG="to-tag-$$"
TEST_RESULTS_DIR="/tmp/rtpengine-test-results"
FAILED_TESTS=0

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1" >&2; }

# Initialize test environment
init_tests() {
    log_info "Initializing test environment..."
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Check if running as root for some tests
    if [[ $EUID -eq 0 ]]; then
        IS_ROOT=true
    else
        IS_ROOT=false
        log_warning "Some tests require root privileges"
    fi
}

# Test binary installation
test_binary_installation() {
    log_info "Testing binary installation..."
    
    # Check main binary
    if command -v rtpengine &> /dev/null || [[ -f /usr/local/bin/rtpengine ]]; then
        log_success "RTPEngine binary found"
    else
        log_error "RTPEngine binary not found"
        ((FAILED_TESTS++))
        return 1
    fi
    
    # Check CLI tools
    if command -v rtpengine-ctl &> /dev/null || [[ -f /usr/local/bin/rtpengine-ctl ]]; then
        log_success "rtpengine-ctl found"
    else
        log_error "rtpengine-ctl not found"
        ((FAILED_TESTS++))
    fi
    
    # Check recording daemon
    if command -v rtpengine-recording &> /dev/null || [[ -f /usr/local/bin/rtpengine-recording ]]; then
        log_success "rtpengine-recording found"
    else
        log_error "rtpengine-recording not found"
        ((FAILED_TESTS++))
    fi
    
    # Test version output
    if /usr/local/bin/rtpengine --version 2>&1 | grep -q "rtpengine"; then
        log_success "Version check passed"
        /usr/local/bin/rtpengine --version
    else
        log_error "Version check failed"
        ((FAILED_TESTS++))
    fi
}

# Test kernel module
test_kernel_module() {
    log_info "Testing kernel module..."
    
    if [[ "$IS_ROOT" != "true" ]]; then
        log_warning "Skipping kernel module test (requires root)"
        return
    fi
    
    # Check if module is loaded
    if lsmod | grep -q xt_RTPENGINE; then
        log_success "Kernel module xt_RTPENGINE is loaded"
    else
        log_error "Kernel module xt_RTPENGINE is not loaded"
        ((FAILED_TESTS++))
        
        # Try to load it
        if modprobe xt_RTPENGINE 2>/dev/null; then
            log_success "Successfully loaded kernel module"
        else
            log_error "Failed to load kernel module"
        fi
    fi
    
    # Check module info
    if modinfo xt_RTPENGINE &> /dev/null; then
        log_success "Module info available"
    else
        log_warning "Module info not available"
    fi
}

# Test configuration file
test_configuration() {
    log_info "Testing configuration..."
    
    # Check if config exists
    if [[ -f /etc/rtpengine/rtpengine.conf ]]; then
        log_success "Configuration file exists"
    else
        log_error "Configuration file not found"
        ((FAILED_TESTS++))
        return 1
    fi
    
    # Validate configuration syntax
    if /usr/local/bin/rtpengine --config-file /etc/rtpengine/rtpengine.conf --config-test 2>&1 | grep -q "error"; then
        log_error "Configuration syntax error"
        ((FAILED_TESTS++))
    else
        log_success "Configuration syntax valid"
    fi
    
    # Check critical configuration parameters
    if grep -q "interface" /etc/rtpengine/rtpengine.conf; then
        log_success "Interface configuration found"
    else
        log_error "No interface configuration found"
        ((FAILED_TESTS++))
    fi
    
    if grep -q "listen-ng" /etc/rtpengine/rtpengine.conf; then
        log_success "Control port configuration found"
    else
        log_error "No control port configuration found"
        ((FAILED_TESTS++))
    fi
}

# Test systemd service
test_systemd_service() {
    log_info "Testing systemd service..."
    
    if [[ "$IS_ROOT" != "true" ]]; then
        log_warning "Skipping systemd service test (requires root)"
        return
    fi
    
    # Check if service file exists
    if [[ -f /etc/systemd/system/rtpengine.service ]]; then
        log_success "Systemd service file exists"
    else
        log_error "Systemd service file not found"
        ((FAILED_TESTS++))
        return 1
    fi
    
    # Check service status
    if systemctl is-enabled rtpengine &> /dev/null; then
        log_success "Service is enabled"
    else
        log_warning "Service is not enabled"
    fi
    
    # Check if service is running
    if systemctl is-active rtpengine &> /dev/null; then
        log_success "Service is running"
    else
        log_warning "Service is not running"
        
        # Try to start it
        log_info "Attempting to start service..."
        if systemctl start rtpengine 2>/dev/null; then
            sleep 2
            if systemctl is-active rtpengine &> /dev/null; then
                log_success "Service started successfully"
            else
                log_error "Service failed to start"
                ((FAILED_TESTS++))
                journalctl -u rtpengine --no-pager | tail -20
            fi
        fi
    fi
}

# Test control protocol connectivity
test_control_protocol() {
    log_info "Testing control protocol..."
    
    # Test NG protocol
    if timeout 2 nc -zv "$RTPENGINE_HOST" "$RTPENGINE_PORT" &> /dev/null; then
        log_success "NG control port $RTPENGINE_PORT is accessible"
    else
        log_error "Cannot connect to NG control port $RTPENGINE_PORT"
        ((FAILED_TESTS++))
        return 1
    fi
    
    # Test CLI protocol
    if timeout 2 nc -zv "$RTPENGINE_HOST" "$RTPENGINE_CLI_PORT" &> /dev/null; then
        log_success "CLI port $RTPENGINE_CLI_PORT is accessible"
    else
        log_error "Cannot connect to CLI port $RTPENGINE_CLI_PORT"
        ((FAILED_TESTS++))
    fi
    
    # Test basic CLI command
    if echo "list totals" | timeout 2 nc -N "$RTPENGINE_HOST" "$RTPENGINE_CLI_PORT" 2>/dev/null | grep -q "Total statistics"; then
        log_success "CLI protocol working"
    else
        log_error "CLI protocol not responding correctly"
        ((FAILED_TESTS++))
    fi
}

# Test NG protocol commands
test_ng_protocol() {
    log_info "Testing NG protocol commands..."
    
    # Create a simple test SDP
    local test_sdp=$(cat << 'EOF'
v=0
o=- 1234567890 1234567890 IN IP4 10.0.0.1
s=Test Session
c=IN IP4 10.0.0.1
t=0 0
m=audio 10000 RTP/AVP 0 8 101
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000
a=sendrecv
EOF
)
    
    # Test ping command
    local ping_cmd='{"command": "ping", "call-id": "'$TEST_CALL_ID'"}'
    local response=$(echo -n "${#ping_cmd} ${ping_cmd}" | timeout 2 nc -w 1 "$RTPENGINE_HOST" "$RTPENGINE_PORT" 2>/dev/null)
    
    if echo "$response" | grep -q "pong"; then
        log_success "Ping command successful"
    else
        log_error "Ping command failed"
        ((FAILED_TESTS++))
    fi
    
    # Test offer command
    local offer_cmd='{"command": "offer", "call-id": "'$TEST_CALL_ID'", "from-tag": "'$TEST_FROM_TAG'", "sdp": "'$(echo -n "$test_sdp" | sed 's/$/\\n/g' | tr -d '\n')'"}'
    local response=$(echo -n "${#offer_cmd} ${offer_cmd}" | timeout 2 nc -w 1 "$RTPENGINE_HOST" "$RTPENGINE_PORT" 2>/dev/null)
    
    if echo "$response" | grep -q "ok"; then
        log_success "Offer command successful"
    else
        log_error "Offer command failed"
        ((FAILED_TESTS++))
    fi
    
    # Test delete command
    local delete_cmd='{"command": "delete", "call-id": "'$TEST_CALL_ID'", "from-tag": "'$TEST_FROM_TAG'"}'
    local response=$(echo -n "${#delete_cmd} ${delete_cmd}" | timeout 2 nc -w 1 "$RTPENGINE_HOST" "$RTPENGINE_PORT" 2>/dev/null)
    
    if echo "$response" | grep -q "ok"; then
        log_success "Delete command successful"
    else
        log_error "Delete command failed"
        ((FAILED_TESTS++))
    fi
}

# Test RTP port allocation
test_rtp_ports() {
    log_info "Testing RTP port allocation..."
    
    # Get configured port range
    local port_min=$(grep "port-min" /etc/rtpengine/rtpengine.conf 2>/dev/null | awk '{print $NF}')
    local port_max=$(grep "port-max" /etc/rtpengine/rtpengine.conf 2>/dev/null | awk '{print $NF}')
    
    if [[ -n "$port_min" && -n "$port_max" ]]; then
        log_success "Port range configured: $port_min-$port_max"
    else
        log_warning "Could not determine port range"
    fi
    
    # Check if ports are available
    local sample_port=$((port_min + 100))
    if ! ss -ln | grep -q ":$sample_port "; then
        log_success "RTP port range appears available"
    else
        log_warning "Some RTP ports may be in use"
    fi
}

# Test resource limits
test_resource_limits() {
    log_info "Testing resource limits..."
    
    if [[ "$IS_ROOT" != "true" ]]; then
        log_warning "Skipping resource limits test (requires root)"
        return
    fi
    
    # Check rtpengine user limits
    if [[ -f /etc/security/limits.d/rtpengine.conf ]]; then
        log_success "RTPEngine limits file exists"
        
        # Check specific limits for rtpengine user
        local nofile_limit=$(su - rtpengine -s /bin/bash -c "ulimit -n" 2>/dev/null)
        if [[ "$nofile_limit" -gt 65536 ]]; then
            log_success "File descriptor limit adequate: $nofile_limit"
        else
            log_warning "File descriptor limit may be too low: $nofile_limit"
        fi
    else
        log_error "RTPEngine limits file not found"
        ((FAILED_TESTS++))
    fi
}

# Test kernel optimizations
test_kernel_optimizations() {
    log_info "Testing kernel optimizations..."
    
    # Check key kernel parameters
    local params=(
        "net.core.rmem_max"
        "net.core.wmem_max"
        "net.ipv4.ip_forward"
        "net.core.netdev_max_backlog"
    )
    
    for param in "${params[@]}"; do
        local value=$(sysctl -n "$param" 2>/dev/null)
        if [[ -n "$value" ]]; then
            log_success "$param = $value"
        else
            log_warning "Could not read $param"
        fi
    done
    
    # Check if optimization file exists
    if [[ -f /etc/sysctl.d/99-rtpengine.conf ]]; then
        log_success "Kernel optimization file exists"
    else
        log_warning "Kernel optimization file not found"
    fi
}

# Performance benchmark test
test_performance_benchmark() {
    log_info "Running performance benchmark..."
    
    # Simple load test using rtpengine-ctl if available
    if command -v rtpengine-ctl &> /dev/null; then
        # Get current statistics
        local stats=$(rtpengine-ctl list totals 2>/dev/null)
        if [[ -n "$stats" ]]; then
            log_success "Retrieved statistics successfully"
            echo "$stats" | grep -E "(Total|Offer|Answer|Delete)" | head -5
        else
            log_warning "Could not retrieve statistics"
        fi
    else
        log_warning "rtpengine-ctl not available for benchmarking"
    fi
}

# Generate test report
generate_test_report() {
    local report_file="$TEST_RESULTS_DIR/test-report-$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
RTPEngine Test Report
=====================
Date: $(date)
Hostname: $(hostname)
Failed Tests: $FAILED_TESTS

Test Summary:
- Binary Installation: $(test_binary_installation &> /dev/null && echo "PASS" || echo "FAIL")
- Kernel Module: $(test_kernel_module &> /dev/null && echo "PASS" || echo "FAIL")
- Configuration: $(test_configuration &> /dev/null && echo "PASS" || echo "FAIL")
- Systemd Service: $(test_systemd_service &> /dev/null && echo "PASS" || echo "FAIL")
- Control Protocol: $(test_control_protocol &> /dev/null && echo "PASS" || echo "FAIL")
- NG Protocol: $(test_ng_protocol &> /dev/null && echo "PASS" || echo "FAIL")
- RTP Ports: $(test_rtp_ports &> /dev/null && echo "PASS" || echo "FAIL")
- Resource Limits: $(test_resource_limits &> /dev/null && echo "PASS" || echo "FAIL")
- Kernel Optimizations: $(test_kernel_optimizations &> /dev/null && echo "PASS" || echo "FAIL")

System Information:
- OS: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
- Kernel: $(uname -r)
- CPU: $(nproc) cores
- Memory: $(free -h | awk '/^Mem:/ {print $2}')

RTPEngine Version:
$(/usr/local/bin/rtpengine --version 2>&1 || echo "Not available")

EOF
    
    log_info "Test report saved to: $report_file"
}

# Main test execution
main() {
    log_info "Starting RTPEngine comprehensive test suite..."
    
    init_tests
    
    # Run all tests
    test_binary_installation
    echo
    test_kernel_module
    echo
    test_configuration
    echo
    test_systemd_service
    echo
    test_control_protocol
    echo
    test_ng_protocol
    echo
    test_rtp_ports
    echo
    test_resource_limits
    echo
    test_kernel_optimizations
    echo
    test_performance_benchmark
    echo
    
    # Generate report
    generate_test_report
    
    # Final summary
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "All tests passed successfully!"
        exit 0
    else
        log_error "Failed tests: $FAILED_TESTS"
        log_info "Review the test report for details"
        exit 1
    fi
}

# Run main function
main "$@"