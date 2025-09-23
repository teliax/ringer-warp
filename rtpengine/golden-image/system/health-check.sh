#!/bin/bash
# RTPEngine Health Check Script

set -euo pipefail

# Configuration
RTPENGINE_HOST="${RTPENGINE_HOST:-127.0.0.1}"
RTPENGINE_PORT="${RTPENGINE_PORT:-22222}"
RTPENGINE_TIMEOUT="${RTPENGINE_TIMEOUT:-5}"
LOG_FILE="/var/log/rtpengine-health.log"
STATE_FILE="/var/run/rtpengine/health.state"
METRICS_FILE="/var/lib/prometheus/node-exporter/rtpengine-health.prom"

# Exit codes
EXIT_OK=0
EXIT_WARNING=1
EXIT_CRITICAL=2
EXIT_UNKNOWN=3

# Thresholds
CPU_THRESHOLD_WARNING=70
CPU_THRESHOLD_CRITICAL=90
MEMORY_THRESHOLD_WARNING=80
MEMORY_THRESHOLD_CRITICAL=95
SESSION_THRESHOLD_WARNING=1000
SESSION_THRESHOLD_CRITICAL=2000
PACKET_LOSS_THRESHOLD_WARNING=0.1
PACKET_LOSS_THRESHOLD_CRITICAL=1.0

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $@" | tee -a "${LOG_FILE}"
}

# Check if RTPEngine process is running
check_process() {
    if pidof rtpengine > /dev/null; then
        return 0
    else
        log "ERROR: RTPEngine process not running"
        return $EXIT_CRITICAL
    fi
}

# Check RTPEngine control port
check_control_port() {
    if timeout $RTPENGINE_TIMEOUT bash -c "echo > /dev/tcp/$RTPENGINE_HOST/$RTPENGINE_PORT" 2>/dev/null; then
        return 0
    else
        log "ERROR: Cannot connect to RTPEngine control port $RTPENGINE_HOST:$RTPENGINE_PORT"
        return $EXIT_CRITICAL
    fi
}

# Get RTPEngine statistics
get_stats() {
    local stats_cmd="rtpengine-ctl -p /var/run/rtpengine/rtpengine.pid"
    
    if [[ -x /usr/bin/rtpengine-ctl ]]; then
        $stats_cmd stats 2>/dev/null || echo ""
    else
        # Fallback to netcat if rtpengine-ctl not available
        echo -e "ping\n" | nc -w $RTPENGINE_TIMEOUT $RTPENGINE_HOST $RTPENGINE_PORT 2>/dev/null || echo ""
    fi
}

# Parse statistics and check thresholds
check_statistics() {
    local stats="$1"
    local status=$EXIT_OK
    local message="OK"
    
    if [[ -z "$stats" ]]; then
        log "ERROR: Unable to retrieve RTPEngine statistics"
        return $EXIT_CRITICAL
    fi
    
    # Extract metrics
    local current_sessions=$(echo "$stats" | grep -oP 'Current sessions:\s*\K\d+' || echo "0")
    local total_sessions=$(echo "$stats" | grep -oP 'Total managed sessions:\s*\K\d+' || echo "0")
    local current_streams=$(echo "$stats" | grep -oP 'Current streams:\s*\K\d+' || echo "0")
    local packets_relayed=$(echo "$stats" | grep -oP 'Packets relayed:\s*\K\d+' || echo "0")
    local errors=$(echo "$stats" | grep -oP 'Errors:\s*\K\d+' || echo "0")
    
    # Check session thresholds
    if [[ $current_sessions -gt $SESSION_THRESHOLD_CRITICAL ]]; then
        status=$EXIT_CRITICAL
        message="CRITICAL: High session count: $current_sessions"
    elif [[ $current_sessions -gt $SESSION_THRESHOLD_WARNING ]]; then
        status=$EXIT_WARNING
        message="WARNING: Elevated session count: $current_sessions"
    fi
    
    # Write Prometheus metrics
    cat > "${METRICS_FILE}.tmp" <<EOF
# HELP rtpengine_health_status RTPEngine health status (0=OK, 1=WARNING, 2=CRITICAL)
# TYPE rtpengine_health_status gauge
rtpengine_health_status $status

# HELP rtpengine_current_sessions Current active sessions
# TYPE rtpengine_current_sessions gauge
rtpengine_current_sessions $current_sessions

# HELP rtpengine_total_sessions Total sessions since start
# TYPE rtpengine_total_sessions counter
rtpengine_total_sessions $total_sessions

# HELP rtpengine_current_streams Current active media streams
# TYPE rtpengine_current_streams gauge
rtpengine_current_streams $current_streams

# HELP rtpengine_packets_relayed Total packets relayed
# TYPE rtpengine_packets_relayed counter
rtpengine_packets_relayed $packets_relayed

# HELP rtpengine_errors Total errors
# TYPE rtpengine_errors counter
rtpengine_errors $errors
EOF
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE" 2>/dev/null || true
    
    echo "$message"
    return $status
}

# Check system resources
check_system_resources() {
    local status=$EXIT_OK
    
    # Check CPU usage
    local cpu_usage=$(top -bn1 | grep "^%Cpu" | awk '{print int($2)}')
    if [[ $cpu_usage -gt $CPU_THRESHOLD_CRITICAL ]]; then
        log "CRITICAL: CPU usage at ${cpu_usage}%"
        status=$EXIT_CRITICAL
    elif [[ $cpu_usage -gt $CPU_THRESHOLD_WARNING ]]; then
        log "WARNING: CPU usage at ${cpu_usage}%"
        status=$EXIT_WARNING
    fi
    
    # Check memory usage
    local mem_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [[ $mem_usage -gt $MEMORY_THRESHOLD_CRITICAL ]]; then
        log "CRITICAL: Memory usage at ${mem_usage}%"
        status=$EXIT_CRITICAL
    elif [[ $mem_usage -gt $MEMORY_THRESHOLD_WARNING ]]; then
        log "WARNING: Memory usage at ${mem_usage}%"
        status=$EXIT_WARNING
    fi
    
    # Check disk usage for recording directory
    if [[ -d /var/spool/rtpengine ]]; then
        local disk_usage=$(df /var/spool/rtpengine | awk 'NR==2 {print int($5)}')
        if [[ $disk_usage -gt 90 ]]; then
            log "CRITICAL: Recording disk usage at ${disk_usage}%"
            status=$EXIT_CRITICAL
        elif [[ $disk_usage -gt 80 ]]; then
            log "WARNING: Recording disk usage at ${disk_usage}%"
            status=$EXIT_WARNING
        fi
    fi
    
    return $status
}

# Check kernel module
check_kernel_module() {
    if lsmod | grep -q xt_RTPENGINE; then
        return 0
    else
        log "WARNING: xt_RTPENGINE kernel module not loaded"
        return $EXIT_WARNING
    fi
}

# Perform comprehensive health check
perform_health_check() {
    local overall_status=$EXIT_OK
    local status_message="OK"
    local checks_passed=0
    local checks_total=0
    
    # Load instance configuration if available
    if [[ -f /etc/rtpengine/instance.conf ]]; then
        source /etc/rtpengine/instance.conf
    fi
    
    log "Starting health check for ${INSTANCE_NAME:-rtpengine}"
    
    # Check 1: Process
    ((checks_total++))
    if check_process; then
        ((checks_passed++))
    else
        overall_status=$EXIT_CRITICAL
        status_message="Process check failed"
    fi
    
    # Check 2: Control port
    ((checks_total++))
    if check_control_port; then
        ((checks_passed++))
    else
        overall_status=$EXIT_CRITICAL
        status_message="Control port check failed"
    fi
    
    # Check 3: Statistics and thresholds
    ((checks_total++))
    local stats=$(get_stats)
    if result=$(check_statistics "$stats"); then
        ((checks_passed++))
        log "Statistics: $result"
    else
        local check_status=$?
        if [[ $check_status -gt $overall_status ]]; then
            overall_status=$check_status
            status_message="Statistics check: $result"
        fi
    fi
    
    # Check 4: System resources
    ((checks_total++))
    if check_system_resources; then
        ((checks_passed++))
    else
        local check_status=$?
        if [[ $check_status -gt $overall_status ]]; then
            overall_status=$check_status
            status_message="System resource check failed"
        fi
    fi
    
    # Check 5: Kernel module
    ((checks_total++))
    if check_kernel_module; then
        ((checks_passed++))
    else
        if [[ $overall_status -eq $EXIT_OK ]]; then
            overall_status=$EXIT_WARNING
            status_message="Kernel module check failed"
        fi
    fi
    
    # Update state file
    cat > "$STATE_FILE" <<EOF
status=$overall_status
message="$status_message"
checks_passed=$checks_passed
checks_total=$checks_total
timestamp=$(date +%s)
EOF
    
    # Log final status
    case $overall_status in
        $EXIT_OK)
            log "Health check PASSED ($checks_passed/$checks_total checks)"
            ;;
        $EXIT_WARNING)
            log "Health check WARNING: $status_message ($checks_passed/$checks_total checks)"
            ;;
        $EXIT_CRITICAL)
            log "Health check CRITICAL: $status_message ($checks_passed/$checks_total checks)"
            ;;
        *)
            log "Health check UNKNOWN: $status_message"
            ;;
    esac
    
    return $overall_status
}

# Handle startup flag
if [[ "${1:-}" == "--startup" ]]; then
    # During startup, only check if process started
    sleep 2
    if check_process && check_control_port; then
        log "Startup health check passed"
        exit $EXIT_OK
    else
        log "Startup health check failed"
        exit $EXIT_CRITICAL
    fi
fi

# Main health check
mkdir -p /var/lib/prometheus/node-exporter
perform_health_check
exit $?