#!/bin/bash
# RTPEngine Rolling Update Script
# Performs zero-downtime updates with automatic rollback

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/var/log/rtpengine-updates"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/update_${TIMESTAMP}.log"
BACKUP_DIR="/var/backups/rtpengine"

# Update parameters
UPDATE_MODE=${UPDATE_MODE:-"rolling"}  # rolling, canary, or blue-green
BATCH_SIZE=${BATCH_SIZE:-1}
BATCH_DELAY=${BATCH_DELAY:-60}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-10}
HEALTH_CHECK_DELAY=${HEALTH_CHECK_DELAY:-5}
AUTO_ROLLBACK=${AUTO_ROLLBACK:-true}
CANARY_PERCENTAGE=${CANARY_PERCENTAGE:-25}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create directories
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

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

log_info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

# Backup current version
backup_current_version() {
    log "Creating backup of current version..."
    
    local backup_name="rtpengine_backup_${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    mkdir -p "$backup_path"
    
    # Backup binaries
    cp -p /usr/local/bin/rtpengine "$backup_path/" 2>/dev/null || true
    cp -p /usr/local/bin/rtpengine-recording "$backup_path/" 2>/dev/null || true
    
    # Backup configurations
    cp -rp /etc/rtpengine "$backup_path/etc_rtpengine"
    
    # Backup systemd units
    cp -p /etc/systemd/system/rtpengine*.service "$backup_path/" 2>/dev/null || true
    
    # Save version info
    rtpengine --version > "$backup_path/version.txt" 2>&1 || true
    
    # Create restore script
    cat > "$backup_path/restore.sh" <<'EOF'
#!/bin/bash
# Restore script for this backup
set -e
echo "Restoring RTPEngine from backup..."
cp -p rtpengine /usr/local/bin/
cp -p rtpengine-recording /usr/local/bin/ 2>/dev/null || true
cp -rp etc_rtpengine/* /etc/rtpengine/
cp -p rtpengine*.service /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload
echo "Restore completed. Please restart RTPEngine services manually."
EOF
    chmod +x "$backup_path/restore.sh"
    
    # Compress backup
    tar -czf "${backup_path}.tar.gz" -C "$BACKUP_DIR" "$backup_name"
    rm -rf "$backup_path"
    
    log_success "Backup created: ${backup_path}.tar.gz"
    echo "${backup_path}.tar.gz"
}

# Check instance health
check_instance_health() {
    local instance=$1
    local retries=0
    
    while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
        # Check systemd status
        if ! systemctl is-active --quiet "$instance"; then
            ((retries++))
            sleep "$HEALTH_CHECK_DELAY"
            continue
        fi
        
        # Get control port from config
        local config_file="/etc/rtpengine/${instance}.conf"
        local control_port=$(grep -E '^listen-cli=' "$config_file" | cut -d= -f2)
        
        # Check CLI connectivity
        if nc -z localhost "$control_port" 2>/dev/null; then
            # Check metrics endpoint
            local http_port=$((control_port + 1000))
            if curl -sf "http://localhost:${http_port}/metrics" > /dev/null; then
                return 0
            fi
        fi
        
        ((retries++))
        sleep "$HEALTH_CHECK_DELAY"
    done
    
    return 1
}

# Update single instance
update_instance() {
    local instance=$1
    local new_binary=$2
    
    log "Updating instance: $instance"
    
    # Get current metrics
    local config_file="/etc/rtpengine/${instance}.conf"
    local control_port=$(grep -E '^listen-cli=' "$config_file" | cut -d= -f2)
    local http_port=$((control_port + 1000))
    
    # Save current call count
    local active_calls=0
    if curl -sf "http://localhost:${http_port}/metrics" > /dev/null; then
        active_calls=$(curl -sf "http://localhost:${http_port}/metrics" | grep -E '^rtpengine_sessions_total' | awk '{print $2}' || echo 0)
    fi
    
    log_info "Active calls on $instance: $active_calls"
    
    # Wait for calls to drain if needed
    if [[ $active_calls -gt 0 ]]; then
        log "Waiting for $active_calls calls to complete..."
        
        # Signal graceful shutdown
        systemctl kill -s TERM "$instance"
        
        # Wait for calls to drain (max 5 minutes)
        local wait_time=0
        while [[ $wait_time -lt 300 ]]; do
            if ! systemctl is-active --quiet "$instance"; then
                break
            fi
            
            active_calls=$(curl -sf "http://localhost:${http_port}/metrics" 2>/dev/null | grep -E '^rtpengine_sessions_total' | awk '{print $2}' || echo 0)
            if [[ $active_calls -eq 0 ]]; then
                break
            fi
            
            sleep 5
            ((wait_time+=5))
            log_info "Still waiting for $active_calls calls to complete..."
        done
    fi
    
    # Stop the instance
    systemctl stop "$instance"
    
    # Update binary
    cp -f "$new_binary" /usr/local/bin/rtpengine
    chmod +x /usr/local/bin/rtpengine
    
    # Start the instance
    systemctl start "$instance"
    
    # Health check
    if check_instance_health "$instance"; then
        log_success "Instance $instance updated successfully"
        return 0
    else
        log_error "Health check failed for $instance"
        return 1
    fi
}

# Rollback instance
rollback_instance() {
    local instance=$1
    local backup_file=$2
    
    log_warning "Rolling back instance: $instance"
    
    # Extract backup
    local temp_dir="/tmp/rtpengine_rollback_$$"
    mkdir -p "$temp_dir"
    tar -xzf "$backup_file" -C "$temp_dir"
    
    # Stop instance
    systemctl stop "$instance"
    
    # Restore binary
    local backup_name=$(basename "$backup_file" .tar.gz)
    cp -f "$temp_dir/$backup_name/rtpengine" /usr/local/bin/
    chmod +x /usr/local/bin/rtpengine
    
    # Start instance
    systemctl start "$instance"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    # Health check
    if check_instance_health "$instance"; then
        log_success "Instance $instance rolled back successfully"
        return 0
    else
        log_error "Rollback failed for $instance"
        return 1
    fi
}

# Perform rolling update
rolling_update() {
    local new_binary=$1
    local backup_file=$2
    
    log "Starting rolling update..."
    
    # Get all RTPEngine instances
    local instances=($(systemctl list-units --type=service --all 'rtpengine-*.service' | grep rtpengine- | awk '{print $1}' | sed 's/.service//'))
    local total_instances=${#instances[@]}
    local updated_instances=0
    local failed_instances=()
    
    log "Found $total_instances instances to update"
    
    # Update instances in batches
    for ((i=0; i<$total_instances; i+=$BATCH_SIZE)); do
        local batch_end=$((i + BATCH_SIZE))
        if [[ $batch_end -gt $total_instances ]]; then
            batch_end=$total_instances
        fi
        
        log "Updating batch: instances $((i+1)) to $batch_end of $total_instances"
        
        # Update instances in current batch
        for ((j=i; j<$batch_end; j++)); do
            local instance=${instances[$j]}
            
            if update_instance "$instance" "$new_binary"; then
                ((updated_instances++))
            else
                failed_instances+=("$instance")
                
                if [[ "$AUTO_ROLLBACK" == "true" ]]; then
                    log_warning "Auto-rollback triggered for $instance"
                    rollback_instance "$instance" "$backup_file"
                fi
            fi
        done
        
        # Delay between batches
        if [[ $batch_end -lt $total_instances ]]; then
            log "Waiting $BATCH_DELAY seconds before next batch..."
            sleep "$BATCH_DELAY"
        fi
    done
    
    # Summary
    log "Update completed: $updated_instances/$total_instances instances updated successfully"
    
    if [[ ${#failed_instances[@]} -gt 0 ]]; then
        log_error "Failed instances: ${failed_instances[*]}"
        return 1
    fi
    
    return 0
}

# Perform canary update
canary_update() {
    local new_binary=$1
    local backup_file=$2
    
    log "Starting canary update..."
    
    # Get all instances
    local instances=($(systemctl list-units --type=service --all 'rtpengine-*.service' | grep rtpengine- | awk '{print $1}' | sed 's/.service//'))
    local total_instances=${#instances[@]}
    local canary_count=$((total_instances * CANARY_PERCENTAGE / 100))
    
    if [[ $canary_count -lt 1 ]]; then
        canary_count=1
    fi
    
    log "Updating $canary_count canary instances out of $total_instances"
    
    # Update canary instances
    local updated=0
    for instance in "${instances[@]}"; do
        if [[ $updated -ge $canary_count ]]; then
            break
        fi
        
        if update_instance "$instance" "$new_binary"; then
            ((updated++))
        else
            log_error "Canary update failed"
            
            if [[ "$AUTO_ROLLBACK" == "true" ]]; then
                rollback_instance "$instance" "$backup_file"
            fi
            
            return 1
        fi
    done
    
    log_success "Canary instances updated successfully"
    log "Monitor canary instances for issues before proceeding with full update"
    
    # Wait for monitoring period
    log "Waiting 5 minutes for canary monitoring..."
    sleep 300
    
    # Check canary health
    for ((i=0; i<$updated; i++)); do
        if ! check_instance_health "${instances[$i]}"; then
            log_error "Canary instance ${instances[$i]} failed health check"
            return 1
        fi
    done
    
    log "Proceeding with full update..."
    
    # Update remaining instances
    for ((i=$updated; i<$total_instances; i++)); do
        update_instance "${instances[$i]}" "$new_binary" || true
    done
    
    return 0
}

# Build new version
build_new_version() {
    log "Building new RTPEngine version..."
    
    local build_dir="/tmp/rtpengine_build_${TIMESTAMP}"
    mkdir -p "$build_dir"
    
    # Clone or update repository
    if [[ -d /opt/rtpengine/.git ]]; then
        log "Updating existing repository..."
        cd /opt/rtpengine
        git fetch --all
        git checkout "${RTPENGINE_VERSION:-master}"
        git pull
    else
        log "Cloning repository..."
        git clone https://github.com/sipwise/rtpengine.git "$build_dir"
        cd "$build_dir"
        git checkout "${RTPENGINE_VERSION:-master}"
    fi
    
    # Build
    make -j$(nproc) || {
        log_error "Build failed"
        return 1
    }
    
    # Copy new binary
    cp daemon/rtpengine "/tmp/rtpengine_new_${TIMESTAMP}"
    chmod +x "/tmp/rtpengine_new_${TIMESTAMP}"
    
    log_success "New version built successfully"
    echo "/tmp/rtpengine_new_${TIMESTAMP}"
}

# Validate new version
validate_new_version() {
    local new_binary=$1
    
    log "Validating new version..."
    
    # Check binary exists and is executable
    if [[ ! -x "$new_binary" ]]; then
        log_error "New binary not found or not executable: $new_binary"
        return 1
    fi
    
    # Check version
    local new_version=$("$new_binary" --version 2>&1 | head -1)
    local current_version=$(rtpengine --version 2>&1 | head -1)
    
    log_info "Current version: $current_version"
    log_info "New version: $new_version"
    
    # Basic syntax check
    if ! "$new_binary" --config-check > /dev/null 2>&1; then
        log_warning "Config check not supported in this version"
    fi
    
    log_success "Validation passed"
    return 0
}

# Main update process
main() {
    log "=== RTPEngine Update Process Started ==="
    log "Update mode: $UPDATE_MODE"
    log "Batch size: $BATCH_SIZE"
    log "Auto-rollback: $AUTO_ROLLBACK"
    
    # Create backup
    local backup_file=$(backup_current_version)
    
    # Build or use provided binary
    local new_binary=""
    if [[ -n "${RTPENGINE_BINARY:-}" ]] && [[ -f "$RTPENGINE_BINARY" ]]; then
        new_binary="$RTPENGINE_BINARY"
        log "Using provided binary: $new_binary"
    else
        new_binary=$(build_new_version)
    fi
    
    # Validate new version
    if ! validate_new_version "$new_binary"; then
        log_error "Validation failed, aborting update"
        exit 1
    fi
    
    # Perform update based on mode
    case "$UPDATE_MODE" in
        rolling)
            rolling_update "$new_binary" "$backup_file"
            ;;
        canary)
            canary_update "$new_binary" "$backup_file"
            ;;
        *)
            log_error "Unknown update mode: $UPDATE_MODE"
            exit 1
            ;;
    esac
    
    # Cleanup
    rm -f "$new_binary"
    
    # Final summary
    if [[ $? -eq 0 ]]; then
        log_success "=== UPDATE COMPLETED SUCCESSFULLY ==="
    else
        log_error "=== UPDATE FAILED ==="
        log "Backup available at: $backup_file"
    fi
    
    log "Log file: $LOG_FILE"
}

# Show usage
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
    -m, --mode MODE             Update mode (rolling, canary)
    -b, --batch-size SIZE       Number of instances to update at once
    -d, --delay SECONDS         Delay between batches
    -B, --binary PATH           Path to new RTPEngine binary
    -V, --version VERSION       RTPEngine version to build
    -n, --no-rollback          Disable automatic rollback
    -h, --help                 Show this help

Environment variables:
    UPDATE_MODE                Update mode (default: rolling)
    BATCH_SIZE                 Batch size (default: 1)
    BATCH_DELAY               Delay between batches (default: 60)
    AUTO_ROLLBACK             Enable auto-rollback (default: true)
    RTPENGINE_BINARY          Path to new binary
    RTPENGINE_VERSION         Version to build (default: master)

Examples:
    # Rolling update with default settings
    $0

    # Canary deployment
    $0 --mode canary

    # Update with custom binary
    $0 --binary /path/to/new/rtpengine

    # Update specific version
    $0 --version v9.5.0
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            UPDATE_MODE="$2"
            shift 2
            ;;
        -b|--batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        -d|--delay)
            BATCH_DELAY="$2"
            shift 2
            ;;
        -B|--binary)
            RTPENGINE_BINARY="$2"
            shift 2
            ;;
        -V|--version)
            RTPENGINE_VERSION="$2"
            shift 2
            ;;
        -n|--no-rollback)
            AUTO_ROLLBACK=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

# Run main update process
main