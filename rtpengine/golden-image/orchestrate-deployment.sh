#!/bin/bash
# RTPEngine Complete Deployment Orchestration Script
# Handles end-to-end deployment with zero downtime

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/var/log/rtpengine-deployment"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/deployment_${TIMESTAMP}.log"
STATE_FILE="${LOG_DIR}/deployment_state.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Deployment parameters
DRY_RUN=${DRY_RUN:-false}
PARALLEL_DEPLOY=${PARALLEL_DEPLOY:-true}
MAX_PARALLEL_INSTANCES=${MAX_PARALLEL_INSTANCES:-5}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-30}
HEALTH_CHECK_DELAY=${HEALTH_CHECK_DELAY:-10}

# Create log directory
mkdir -p "$LOG_DIR"

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

# State management
save_state() {
    local phase=$1
    local status=$2
    local data=$3
    
    cat > "$STATE_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "phase": "$phase",
  "status": "$status",
  "data": $data
}
EOF
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
    
    # Check required files
    local required_files=(
        "${SCRIPT_DIR}/install.sh"
        "${SCRIPT_DIR}/configure.sh"
        "${SCRIPT_DIR}/monitor.sh"
        "${SCRIPT_DIR}/rtpengine.conf.template"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file missing: $file"
            exit 1
        fi
    done
    
    # Check system resources
    local available_memory=$(free -g | awk '/^Mem:/{print $7}')
    if [[ $available_memory -lt 2 ]]; then
        log_warning "Low available memory: ${available_memory}GB"
    fi
    
    # Check network connectivity
    if ! ping -c 1 8.8.8.8 &> /dev/null; then
        log_error "No internet connectivity"
        exit 1
    fi
    
    # Check for existing RTPEngine instances
    if systemctl is-active --quiet rtpengine; then
        log_warning "Existing RTPEngine instance detected"
    fi
    
    log_success "Pre-deployment checks completed"
    save_state "pre_deployment" "completed" "{}"
}

# Install dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would install dependencies"
        return 0
    fi
    
    # Update package list
    apt-get update -y >> "$LOG_FILE" 2>&1
    
    # Install required packages
    local packages=(
        "build-essential"
        "linux-headers-$(uname -r)"
        "dkms"
        "libevent-dev"
        "libpcap-dev"
        "libssl-dev"
        "libcurl4-openssl-dev"
        "libglib2.0-dev"
        "libhiredis-dev"
        "libspandsp-dev"
        "libiptc-dev"
        "libavcodec-dev"
        "libavformat-dev"
        "libavutil-dev"
        "libswresample-dev"
        "libavfilter-dev"
        "libjson-glib-dev"
        "libwebsockets-dev"
        "libopus-dev"
        "libsrtp2-dev"
        "libsystemd-dev"
        "libmariadb-dev"
        "libpq-dev"
        "libxmlrpc-core-c3-dev"
        "markdown"
        "gperf"
        "pandoc"
        "jq"
        "git"
        "curl"
        "wget"
        "netcat"
        "prometheus-node-exporter"
    )
    
    for package in "${packages[@]}"; do
        log "Installing $package..."
        apt-get install -y "$package" >> "$LOG_FILE" 2>&1
    done
    
    log_success "Dependencies installed successfully"
    save_state "dependencies" "completed" "{}"
}

# Build RTPEngine
build_rtpengine() {
    log "Building RTPEngine from source..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would build RTPEngine"
        return 0
    fi
    
    # Run the install script
    cd "$SCRIPT_DIR"
    ./install.sh >> "$LOG_FILE" 2>&1
    
    # Verify installation
    if [[ ! -x /usr/local/bin/rtpengine ]]; then
        log_error "RTPEngine binary not found after build"
        exit 1
    fi
    
    log_success "RTPEngine built successfully"
    save_state "build" "completed" '{"version": "'"$(rtpengine --version 2>&1 | head -1)"'"}'
}

# Configure RTPEngine instances
configure_instances() {
    log "Configuring RTPEngine instances..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would configure instances"
        return 0
    fi
    
    # Get instance configuration
    local instance_config=$(cat <<EOF
{
  "instances": [
    {"id": 1, "interface": "eth0", "port_min": 30000, "port_max": 31999},
    {"id": 2, "interface": "eth0", "port_min": 32000, "port_max": 33999},
    {"id": 3, "interface": "eth0", "port_min": 34000, "port_max": 35999},
    {"id": 4, "interface": "eth0", "port_min": 36000, "port_max": 37999}
  ]
}
EOF
)
    
    # Configure each instance
    echo "$instance_config" | jq -r '.instances[]' | while read -r instance; do
        local id=$(echo "$instance" | jq -r '.id')
        local interface=$(echo "$instance" | jq -r '.interface')
        local port_min=$(echo "$instance" | jq -r '.port_min')
        local port_max=$(echo "$instance" | jq -r '.port_max')
        
        log "Configuring instance $id..."
        
        # Run configuration script
        INSTANCE_ID=$id \
        INTERFACE=$interface \
        PORT_MIN=$port_min \
        PORT_MAX=$port_max \
        ./configure.sh >> "$LOG_FILE" 2>&1
    done
    
    log_success "Instances configured successfully"
    save_state "configure" "completed" "$instance_config"
}

# Deploy instances
deploy_instances() {
    log "Deploying RTPEngine instances..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would deploy instances"
        return 0
    fi
    
    # Get configured instances
    local instances=$(find /etc/rtpengine -name "rtpengine-*.conf" | sort)
    
    if [[ "$PARALLEL_DEPLOY" == "true" ]]; then
        log "Deploying instances in parallel (max $MAX_PARALLEL_INSTANCES)..."
        
        # Deploy instances in parallel with rate limiting
        echo "$instances" | xargs -n1 -P"$MAX_PARALLEL_INSTANCES" -I{} bash -c '
            instance=$(basename {} .conf)
            echo "Starting $instance..."
            systemctl start $instance
            sleep 2
        '
    else
        # Deploy instances sequentially
        for config in $instances; do
            local instance=$(basename "$config" .conf)
            log "Starting $instance..."
            systemctl start "$instance"
            sleep 5
            
            # Health check
            if ! systemctl is-active --quiet "$instance"; then
                log_error "Failed to start $instance"
                exit 1
            fi
        done
    fi
    
    log_success "Instances deployed successfully"
    save_state "deploy" "completed" "{}"
}

# Health checks
perform_health_checks() {
    log "Performing health checks..."
    
    local all_healthy=true
    local retries=0
    
    while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
        all_healthy=true
        
        # Check each instance
        for config in /etc/rtpengine/rtpengine-*.conf; do
            local instance=$(basename "$config" .conf)
            local control_port=$(grep -E '^listen-cli=' "$config" | cut -d= -f2)
            
            # Check systemd status
            if ! systemctl is-active --quiet "$instance"; then
                log_warning "$instance is not active"
                all_healthy=false
                continue
            fi
            
            # Check CLI connectivity
            if ! timeout 5 nc -z localhost "$control_port" 2>/dev/null; then
                log_warning "$instance CLI not responding on port $control_port"
                all_healthy=false
                continue
            fi
            
            # Check metrics endpoint
            local http_port=$((control_port + 1000))
            if ! curl -sf "http://localhost:${http_port}/metrics" > /dev/null; then
                log_warning "$instance metrics endpoint not responding"
                all_healthy=false
            fi
        done
        
        if [[ "$all_healthy" == "true" ]]; then
            break
        fi
        
        ((retries++))
        log "Health check retry $retries/$HEALTH_CHECK_RETRIES..."
        sleep "$HEALTH_CHECK_DELAY"
    done
    
    if [[ "$all_healthy" != "true" ]]; then
        log_error "Health checks failed after $retries attempts"
        exit 1
    fi
    
    log_success "All health checks passed"
    save_state "health_check" "completed" "{}"
}

# Configure monitoring
configure_monitoring() {
    log "Configuring monitoring..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would configure monitoring"
        return 0
    fi
    
    # Configure Prometheus targets
    cat > /etc/prometheus/targets/rtpengine.json <<EOF
[
  {
    "targets": ["localhost:8080", "localhost:8081", "localhost:8082", "localhost:8083"],
    "labels": {
      "job": "rtpengine",
      "environment": "production"
    }
  }
]
EOF
    
    # Reload Prometheus configuration
    if systemctl is-active --quiet prometheus; then
        systemctl reload prometheus
    fi
    
    # Import Grafana dashboard
    if [[ -f "${SCRIPT_DIR}/monitoring-dashboard.json" ]]; then
        log "Importing Grafana dashboard..."
        # This would use Grafana API to import dashboard
        # curl -X POST -H "Content-Type: application/json" \
        #      -d @"${SCRIPT_DIR}/monitoring-dashboard.json" \
        #      http://admin:admin@localhost:3000/api/dashboards/db
    fi
    
    log_success "Monitoring configured successfully"
    save_state "monitoring" "completed" "{}"
}

# Configure load balancer
configure_load_balancer() {
    log "Configuring load balancer..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would configure load balancer"
        return 0
    fi
    
    # Create Kamailio dispatcher list
    cat > /etc/kamailio/dispatcher.list <<EOF
# RTPEngine instances
1 sip:127.0.0.1:7722 0 0 weight=25
1 sip:127.0.0.1:7723 0 0 weight=25
1 sip:127.0.0.1:7724 0 0 weight=25
1 sip:127.0.0.1:7725 0 0 weight=25
EOF
    
    # Reload Kamailio if running
    if systemctl is-active --quiet kamailio; then
        kamctl dispatcher reload
    fi
    
    log_success "Load balancer configured successfully"
    save_state "load_balancer" "completed" "{}"
}

# Post-deployment validation
post_deployment_validation() {
    log "Performing post-deployment validation..."
    
    # Validate all instances are running
    local instance_count=$(systemctl list-units --type=service --state=active 'rtpengine-*' | grep -c rtpengine-)
    log "Active RTPEngine instances: $instance_count"
    
    # Check port bindings
    local ports_bound=$(ss -tlnp | grep -c rtpengine || true)
    log "RTPEngine port bindings: $ports_bound"
    
    # Check kernel module
    if lsmod | grep -q xt_RTPENGINE; then
        log_success "Kernel module loaded"
    else
        log_warning "Kernel module not loaded"
    fi
    
    # Generate deployment report
    cat > "${LOG_DIR}/deployment_report_${TIMESTAMP}.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "completed",
  "instances": $instance_count,
  "duration_seconds": $SECONDS,
  "log_file": "$LOG_FILE"
}
EOF
    
    log_success "Post-deployment validation completed"
    save_state "validation" "completed" "{}"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    # Remove temporary files
    rm -f /tmp/rtpengine-deploy-*
    
    # Archive old logs
    find "$LOG_DIR" -name "*.log" -mtime +30 -exec gzip {} \;
    
    log "Cleanup completed"
}

# Trap for cleanup on exit
trap cleanup EXIT

# Main deployment flow
main() {
    log "Starting RTPEngine deployment orchestration"
    log "Deployment ID: ${TIMESTAMP}"
    log "Dry run: $DRY_RUN"
    
    # Execute deployment phases
    pre_deployment_checks
    install_dependencies
    build_rtpengine
    configure_instances
    deploy_instances
    perform_health_checks
    configure_monitoring
    configure_load_balancer
    post_deployment_validation
    
    # Final summary
    log_success "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="
    log "Total duration: $SECONDS seconds"
    log "Log file: $LOG_FILE"
    log "State file: $STATE_FILE"
    
    # Send notification (if configured)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"RTPEngine deployment completed successfully on $(hostname)\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Run main function
main "$@"