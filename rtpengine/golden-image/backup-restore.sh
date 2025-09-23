#!/bin/bash
# RTPEngine Backup and Restore Script
# Handles automated backups, restore procedures, and disaster recovery

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE_DIR="/var/backups/rtpengine"
LOG_DIR="/var/log/rtpengine-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"

# Backup settings
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_COMPRESSION=${BACKUP_COMPRESSION:-"gzip"}  # gzip, bzip2, xz
BACKUP_ENCRYPT=${BACKUP_ENCRYPT:-false}
BACKUP_ENCRYPT_KEY=${BACKUP_ENCRYPT_KEY:-""}
REMOTE_BACKUP=${REMOTE_BACKUP:-false}
REMOTE_BACKUP_DEST=${REMOTE_BACKUP_DEST:-""}
S3_BUCKET=${S3_BUCKET:-""}
S3_PREFIX=${S3_PREFIX:-"rtpengine-backups"}

# Backup components
BACKUP_BINARIES=${BACKUP_BINARIES:-true}
BACKUP_CONFIG=${BACKUP_CONFIG:-true}
BACKUP_DATA=${BACKUP_DATA:-true}
BACKUP_SYSTEMD=${BACKUP_SYSTEMD:-true}
BACKUP_KERNEL=${BACKUP_KERNEL:-true}
BACKUP_METRICS=${BACKUP_METRICS:-true}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create directories
mkdir -p "$BACKUP_BASE_DIR" "$LOG_DIR"

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
    
    # Check required commands
    local required_commands=("tar" "systemctl" "jq")
    
    if [[ "$BACKUP_COMPRESSION" == "bzip2" ]]; then
        required_commands+=("bzip2")
    elif [[ "$BACKUP_COMPRESSION" == "xz" ]]; then
        required_commands+=("xz")
    fi
    
    if [[ "$BACKUP_ENCRYPT" == "true" ]]; then
        required_commands+=("gpg")
    fi
    
    if [[ "$REMOTE_BACKUP" == "true" ]] && [[ -n "$S3_BUCKET" ]]; then
        required_commands+=("aws")
    fi
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Get backup metadata
get_backup_metadata() {
    local metadata='{}'
    
    # System information
    metadata=$(echo "$metadata" | jq '. + {
        "hostname": "'"$(hostname)"'",
        "timestamp": "'"$(date -Iseconds)"'",
        "kernel": "'"$(uname -r)"'"
    }')
    
    # RTPEngine version
    if [[ -x /usr/local/bin/rtpengine ]]; then
        local version=$(rtpengine --version 2>&1 | head -1 || echo "unknown")
        metadata=$(echo "$metadata" | jq '. + {"rtpengine_version": "'"$version"'"}')
    fi
    
    # Instance count
    local instance_count=$(systemctl list-units --type=service --all 'rtpengine-*.service' | grep -c rtpengine- || echo 0)
    metadata=$(echo "$metadata" | jq '. + {"instance_count": '"$instance_count"'}')
    
    # Backup settings
    metadata=$(echo "$metadata" | jq '. + {
        "backup_type": "full",
        "compression": "'"$BACKUP_COMPRESSION"'",
        "encrypted": '"$BACKUP_ENCRYPT"'
    }')
    
    echo "$metadata"
}

# Backup binaries
backup_binaries() {
    if [[ "$BACKUP_BINARIES" != "true" ]]; then
        return 0
    fi
    
    log "Backing up binaries..."
    
    local backup_dir="$1"
    mkdir -p "$backup_dir/binaries"
    
    # Core binaries
    local binaries=(
        "/usr/local/bin/rtpengine"
        "/usr/local/bin/rtpengine-recording"
        "/usr/local/bin/rtpengine-ng-client"
    )
    
    for binary in "${binaries[@]}"; do
        if [[ -f "$binary" ]]; then
            cp -p "$binary" "$backup_dir/binaries/"
            log_info "Backed up: $binary"
        fi
    done
    
    # Libraries
    if [[ -d /usr/local/lib ]]; then
        find /usr/local/lib -name "*rtpengine*" -type f -exec cp -p {} "$backup_dir/binaries/" \; 2>/dev/null || true
    fi
    
    log_success "Binaries backed up"
}

# Backup configurations
backup_configurations() {
    if [[ "$BACKUP_CONFIG" != "true" ]]; then
        return 0
    fi
    
    log "Backing up configurations..."
    
    local backup_dir="$1"
    mkdir -p "$backup_dir/config"
    
    # RTPEngine configs
    if [[ -d /etc/rtpengine ]]; then
        cp -rp /etc/rtpengine "$backup_dir/config/"
    fi
    
    # Systemd units
    if [[ "$BACKUP_SYSTEMD" == "true" ]]; then
        mkdir -p "$backup_dir/config/systemd"
        cp -p /etc/systemd/system/rtpengine*.service "$backup_dir/config/systemd/" 2>/dev/null || true
    fi
    
    # Network configuration
    mkdir -p "$backup_dir/config/network"
    ip addr show > "$backup_dir/config/network/ip_addresses.txt"
    ip route show > "$backup_dir/config/network/ip_routes.txt"
    ss -tlnp | grep rtpengine > "$backup_dir/config/network/listening_ports.txt" 2>/dev/null || true
    
    log_success "Configurations backed up"
}

# Backup kernel modules
backup_kernel_modules() {
    if [[ "$BACKUP_KERNEL" != "true" ]]; then
        return 0
    fi
    
    log "Backing up kernel modules..."
    
    local backup_dir="$1"
    mkdir -p "$backup_dir/kernel"
    
    # Kernel module
    local kernel_version=$(uname -r)
    local module_path="/lib/modules/$kernel_version/updates/xt_RTPENGINE.ko"
    
    if [[ -f "$module_path" ]]; then
        cp -p "$module_path" "$backup_dir/kernel/"
        log_info "Backed up kernel module"
    fi
    
    # Module configuration
    if [[ -f /etc/modules-load.d/rtpengine.conf ]]; then
        cp -p /etc/modules-load.d/rtpengine.conf "$backup_dir/kernel/"
    fi
    
    # Current module info
    lsmod | grep -i rtpengine > "$backup_dir/kernel/loaded_modules.txt" 2>/dev/null || true
    
    log_success "Kernel modules backed up"
}

# Backup runtime data
backup_runtime_data() {
    if [[ "$BACKUP_DATA" != "true" ]]; then
        return 0
    fi
    
    log "Backing up runtime data..."
    
    local backup_dir="$1"
    mkdir -p "$backup_dir/data"
    
    # Recording files
    if [[ -d /var/spool/rtpengine ]]; then
        log_info "Backing up recording files..."
        cp -rp /var/spool/rtpengine "$backup_dir/data/" 2>/dev/null || true
    fi
    
    # Log files (last 7 days)
    mkdir -p "$backup_dir/data/logs"
    find /var/log -name "*rtpengine*" -mtime -7 -type f -exec cp -p {} "$backup_dir/data/logs/" \; 2>/dev/null || true
    
    log_success "Runtime data backed up"
}

# Backup metrics and state
backup_metrics() {
    if [[ "$BACKUP_METRICS" != "true" ]]; then
        return 0
    fi
    
    log "Backing up metrics and state..."
    
    local backup_dir="$1"
    mkdir -p "$backup_dir/metrics"
    
    # Get current metrics from each instance
    for config in /etc/rtpengine/rtpengine-*.conf; do
        if [[ ! -f "$config" ]]; then
            continue
        fi
        
        local instance=$(basename "$config" .conf)
        local control_port=$(grep -E '^listen-cli=' "$config" | cut -d= -f2)
        local http_port=$((control_port + 1000))
        
        # Metrics
        if curl -sf "http://localhost:${http_port}/metrics" > "$backup_dir/metrics/${instance}_metrics.txt" 2>/dev/null; then
            log_info "Backed up metrics for $instance"
        fi
        
        # Statistics
        if command -v rtpengine-ctl &> /dev/null; then
            rtpengine-ctl -p "$control_port" list totals > "$backup_dir/metrics/${instance}_stats.txt" 2>/dev/null || true
        fi
    done
    
    log_success "Metrics backed up"
}

# Create backup archive
create_backup_archive() {
    local backup_dir="$1"
    local archive_name="rtpengine_backup_${TIMESTAMP}"
    local archive_path="${BACKUP_BASE_DIR}/${archive_name}"
    
    log "Creating backup archive..."
    
    # Create metadata file
    get_backup_metadata > "$backup_dir/metadata.json"
    
    # Create archive based on compression type
    case "$BACKUP_COMPRESSION" in
        gzip)
            tar -czf "${archive_path}.tar.gz" -C "$BACKUP_BASE_DIR" "$(basename "$backup_dir")"
            archive_path="${archive_path}.tar.gz"
            ;;
        bzip2)
            tar -cjf "${archive_path}.tar.bz2" -C "$BACKUP_BASE_DIR" "$(basename "$backup_dir")"
            archive_path="${archive_path}.tar.bz2"
            ;;
        xz)
            tar -cJf "${archive_path}.tar.xz" -C "$BACKUP_BASE_DIR" "$(basename "$backup_dir")"
            archive_path="${archive_path}.tar.xz"
            ;;
        none)
            tar -cf "${archive_path}.tar" -C "$BACKUP_BASE_DIR" "$(basename "$backup_dir")"
            archive_path="${archive_path}.tar"
            ;;
    esac
    
    # Encrypt if requested
    if [[ "$BACKUP_ENCRYPT" == "true" ]] && [[ -n "$BACKUP_ENCRYPT_KEY" ]]; then
        log "Encrypting backup..."
        gpg --batch --yes --passphrase "$BACKUP_ENCRYPT_KEY" -c "$archive_path"
        rm -f "$archive_path"
        archive_path="${archive_path}.gpg"
    fi
    
    # Calculate checksum
    sha256sum "$archive_path" > "${archive_path}.sha256"
    
    log_success "Backup archive created: $archive_path"
    echo "$archive_path"
}

# Upload to remote storage
upload_to_remote() {
    local archive_path="$1"
    
    if [[ "$REMOTE_BACKUP" != "true" ]]; then
        return 0
    fi
    
    log "Uploading to remote storage..."
    
    # S3 upload
    if [[ -n "$S3_BUCKET" ]]; then
        log_info "Uploading to S3: $S3_BUCKET"
        
        local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$archive_path")"
        
        if aws s3 cp "$archive_path" "$s3_path"; then
            # Upload checksum too
            aws s3 cp "${archive_path}.sha256" "${s3_path}.sha256"
            log_success "Uploaded to S3: $s3_path"
        else
            log_error "Failed to upload to S3"
            return 1
        fi
    fi
    
    # SCP upload
    if [[ -n "$REMOTE_BACKUP_DEST" ]]; then
        log_info "Uploading via SCP: $REMOTE_BACKUP_DEST"
        
        if scp "$archive_path" "${archive_path}.sha256" "$REMOTE_BACKUP_DEST"; then
            log_success "Uploaded via SCP"
        else
            log_error "Failed to upload via SCP"
            return 1
        fi
    fi
    
    return 0
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Local cleanup
    find "$BACKUP_BASE_DIR" -name "rtpengine_backup_*.tar*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -f {} \;
    find "$BACKUP_BASE_DIR" -name "rtpengine_backup_*.sha256" -mtime +$BACKUP_RETENTION_DAYS -exec rm -f {} \;
    
    # S3 cleanup
    if [[ "$REMOTE_BACKUP" == "true" ]] && [[ -n "$S3_BUCKET" ]]; then
        log_info "Cleaning up old S3 backups..."
        
        # List and delete old S3 objects
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
            local file_date=$(echo "$line" | awk '{print $1}')
            local file_name=$(echo "$line" | awk '{print $4}')
            
            if [[ -n "$file_name" ]]; then
                local file_age_days=$(( ($(date +%s) - $(date -d "$file_date" +%s)) / 86400 ))
                
                if [[ $file_age_days -gt $BACKUP_RETENTION_DAYS ]]; then
                    aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file_name}"
                    log_info "Deleted old S3 backup: $file_name"
                fi
            fi
        done
    fi
    
    log_success "Cleanup completed"
}

# Restore from backup
restore_from_backup() {
    local backup_file="$1"
    local restore_components="${2:-all}"
    
    log "Starting restore from: $backup_file"
    
    # Verify backup file
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Create restore directory
    local restore_dir="/tmp/rtpengine_restore_${TIMESTAMP}"
    mkdir -p "$restore_dir"
    
    # Decrypt if needed
    if [[ "$backup_file" =~ \.gpg$ ]]; then
        log "Decrypting backup..."
        
        if [[ -z "$BACKUP_ENCRYPT_KEY" ]]; then
            log_error "Encryption key required for encrypted backup"
            exit 1
        fi
        
        local decrypted_file="${restore_dir}/$(basename "$backup_file" .gpg)"
        gpg --batch --yes --passphrase "$BACKUP_ENCRYPT_KEY" -d "$backup_file" > "$decrypted_file"
        backup_file="$decrypted_file"
    fi
    
    # Verify checksum if available
    if [[ -f "${backup_file}.sha256" ]]; then
        log "Verifying backup integrity..."
        if ! sha256sum -c "${backup_file}.sha256"; then
            log_error "Backup integrity check failed"
            exit 1
        fi
    fi
    
    # Extract backup
    log "Extracting backup..."
    tar -xf "$backup_file" -C "$restore_dir"
    
    # Find extracted directory
    local backup_content=$(find "$restore_dir" -maxdepth 1 -type d -name "rtpengine_backup_*" | head -1)
    
    if [[ -z "$backup_content" ]]; then
        log_error "Invalid backup structure"
        exit 1
    fi
    
    # Read metadata
    if [[ -f "$backup_content/metadata.json" ]]; then
        log_info "Backup metadata:"
        jq . "$backup_content/metadata.json"
    fi
    
    # Stop RTPEngine services
    log "Stopping RTPEngine services..."
    systemctl stop 'rtpengine-*.service' || true
    
    # Restore components
    if [[ "$restore_components" == "all" ]] || [[ "$restore_components" =~ "binaries" ]]; then
        restore_binaries "$backup_content"
    fi
    
    if [[ "$restore_components" == "all" ]] || [[ "$restore_components" =~ "config" ]]; then
        restore_configurations "$backup_content"
    fi
    
    if [[ "$restore_components" == "all" ]] || [[ "$restore_components" =~ "kernel" ]]; then
        restore_kernel_modules "$backup_content"
    fi
    
    if [[ "$restore_components" == "all" ]] || [[ "$restore_components" =~ "data" ]]; then
        restore_runtime_data "$backup_content"
    fi
    
    # Reload systemd
    systemctl daemon-reload
    
    # Start RTPEngine services
    log "Starting RTPEngine services..."
    for service in /etc/systemd/system/rtpengine-*.service; do
        if [[ -f "$service" ]]; then
            systemctl start "$(basename "$service")"
        fi
    done
    
    # Cleanup
    rm -rf "$restore_dir"
    
    log_success "Restore completed successfully"
}

# Restore binaries
restore_binaries() {
    local backup_content="$1"
    
    log "Restoring binaries..."
    
    if [[ -d "$backup_content/binaries" ]]; then
        # Backup current binaries
        for file in "$backup_content/binaries"/*; do
            if [[ -f "$file" ]]; then
                local filename=$(basename "$file")
                local target="/usr/local/bin/$filename"
                
                if [[ -f "$target" ]]; then
                    mv "$target" "${target}.bak"
                fi
                
                cp -p "$file" "$target"
                chmod +x "$target"
                log_info "Restored: $target"
            fi
        done
    fi
    
    log_success "Binaries restored"
}

# Restore configurations
restore_configurations() {
    local backup_content="$1"
    
    log "Restoring configurations..."
    
    # RTPEngine configs
    if [[ -d "$backup_content/config/rtpengine" ]]; then
        # Backup current configs
        if [[ -d /etc/rtpengine ]]; then
            mv /etc/rtpengine "/etc/rtpengine.bak.${TIMESTAMP}"
        fi
        
        cp -rp "$backup_content/config/rtpengine" /etc/
        log_info "Restored: /etc/rtpengine"
    fi
    
    # Systemd units
    if [[ -d "$backup_content/config/systemd" ]]; then
        cp -p "$backup_content/config/systemd"/*.service /etc/systemd/system/
        log_info "Restored systemd units"
    fi
    
    log_success "Configurations restored"
}

# Restore kernel modules
restore_kernel_modules() {
    local backup_content="$1"
    
    log "Restoring kernel modules..."
    
    if [[ -d "$backup_content/kernel" ]]; then
        local kernel_version=$(uname -r)
        local module_path="/lib/modules/$kernel_version/updates"
        
        mkdir -p "$module_path"
        
        if [[ -f "$backup_content/kernel/xt_RTPENGINE.ko" ]]; then
            cp -p "$backup_content/kernel/xt_RTPENGINE.ko" "$module_path/"
            depmod -a
            modprobe xt_RTPENGINE
            log_info "Restored kernel module"
        fi
        
        if [[ -f "$backup_content/kernel/rtpengine.conf" ]]; then
            cp -p "$backup_content/kernel/rtpengine.conf" /etc/modules-load.d/
        fi
    fi
    
    log_success "Kernel modules restored"
}

# Restore runtime data
restore_runtime_data() {
    local backup_content="$1"
    
    log "Restoring runtime data..."
    
    # Recording files
    if [[ -d "$backup_content/data/rtpengine" ]]; then
        if [[ -d /var/spool/rtpengine ]]; then
            mv /var/spool/rtpengine "/var/spool/rtpengine.bak.${TIMESTAMP}"
        fi
        
        cp -rp "$backup_content/data/rtpengine" /var/spool/
        log_info "Restored recording files"
    fi
    
    log_success "Runtime data restored"
}

# Disaster recovery
disaster_recovery() {
    log "=== DISASTER RECOVERY MODE ==="
    
    # Find latest backup
    local latest_backup=""
    
    # Check local backups
    latest_backup=$(find "$BACKUP_BASE_DIR" -name "rtpengine_backup_*.tar*" -type f | sort -r | head -1)
    
    # Check S3 if no local backup
    if [[ -z "$latest_backup" ]] && [[ -n "$S3_BUCKET" ]]; then
        log "Searching for backup in S3..."
        
        local s3_latest=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | sort -r | head -1 | awk '{print $4}')
        
        if [[ -n "$s3_latest" ]]; then
            log "Downloading backup from S3: $s3_latest"
            aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${s3_latest}" "$BACKUP_BASE_DIR/"
            latest_backup="${BACKUP_BASE_DIR}/${s3_latest}"
        fi
    fi
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No backup found for disaster recovery"
        exit 1
    fi
    
    log "Using backup: $latest_backup"
    
    # Restore from backup
    restore_from_backup "$latest_backup" "all"
    
    log_success "=== DISASTER RECOVERY COMPLETED ==="
}

# Scheduled backup
scheduled_backup() {
    log "Running scheduled backup..."
    
    # Perform backup
    perform_backup
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send notification
    if command -v mail &> /dev/null && [[ -n "${BACKUP_EMAIL:-}" ]]; then
        echo "RTPEngine backup completed on $(hostname) at $(date)" | \
            mail -s "RTPEngine Backup Success" "$BACKUP_EMAIL"
    fi
}

# Perform backup
perform_backup() {
    log "=== Starting RTPEngine Backup ==="
    
    # Create temporary backup directory
    local temp_backup_dir="${BACKUP_BASE_DIR}/temp_backup_${TIMESTAMP}"
    mkdir -p "$temp_backup_dir"
    
    # Backup components
    backup_binaries "$temp_backup_dir"
    backup_configurations "$temp_backup_dir"
    backup_kernel_modules "$temp_backup_dir"
    backup_runtime_data "$temp_backup_dir"
    backup_metrics "$temp_backup_dir"
    
    # Create archive
    local archive_path=$(create_backup_archive "$temp_backup_dir")
    
    # Upload to remote
    upload_to_remote "$archive_path"
    
    # Cleanup temporary directory
    rm -rf "$temp_backup_dir"
    
    log_success "=== Backup Completed Successfully ==="
    log "Backup file: $archive_path"
    log "Size: $(du -h "$archive_path" | cut -f1)"
}

# Setup automated backups
setup_automated_backups() {
    log "Setting up automated backups..."
    
    # Create cron job
    local cron_schedule="${BACKUP_SCHEDULE:-"0 2 * * *"}"  # Default: 2 AM daily
    local cron_file="/etc/cron.d/rtpengine-backup"
    
    cat > "$cron_file" <<EOF
# RTPEngine automated backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
BACKUP_RETENTION_DAYS=$BACKUP_RETENTION_DAYS
REMOTE_BACKUP=$REMOTE_BACKUP
S3_BUCKET=$S3_BUCKET
S3_PREFIX=$S3_PREFIX

$cron_schedule root $0 --scheduled >> $LOG_FILE 2>&1
EOF
    
    chmod 644 "$cron_file"
    
    log_success "Automated backups configured"
    log "Schedule: $cron_schedule"
}

# Show usage
usage() {
    cat <<EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
    backup                  Perform manual backup
    restore FILE           Restore from backup file
    disaster-recovery      Automatic disaster recovery
    list                   List available backups
    setup-cron            Setup automated backups
    cleanup               Clean old backups

Options:
    --components COMP     Components to backup/restore (all,binaries,config,kernel,data)
    --encrypt            Enable encryption
    --remote             Enable remote backup
    --s3-bucket BUCKET   S3 bucket for remote backup
    --retention DAYS     Backup retention in days
    --scheduled          Run as scheduled backup

Environment Variables:
    BACKUP_RETENTION_DAYS    Retention period (default: 30)
    BACKUP_COMPRESSION       Compression type (gzip,bzip2,xz,none)
    BACKUP_ENCRYPT          Enable encryption (true/false)
    BACKUP_ENCRYPT_KEY      Encryption passphrase
    REMOTE_BACKUP           Enable remote backup
    S3_BUCKET              S3 bucket name
    S3_PREFIX              S3 prefix path

Examples:
    # Manual backup
    $0 backup

    # Backup with encryption to S3
    BACKUP_ENCRYPT=true BACKUP_ENCRYPT_KEY="secret" S3_BUCKET="my-bucket" $0 backup

    # Restore from backup
    $0 restore /var/backups/rtpengine/rtpengine_backup_20231201_120000.tar.gz

    # Disaster recovery
    $0 disaster-recovery

    # Setup automated daily backups
    $0 setup-cron
EOF
}

# Parse arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        backup|restore|disaster-recovery|list|setup-cron|cleanup)
            COMMAND="$1"
            shift
            ;;
        --components)
            RESTORE_COMPONENTS="$2"
            shift 2
            ;;
        --encrypt)
            BACKUP_ENCRYPT=true
            shift
            ;;
        --remote)
            REMOTE_BACKUP=true
            shift
            ;;
        --s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --retention)
            BACKUP_RETENTION_DAYS="$2"
            shift 2
            ;;
        --scheduled)
            COMMAND="scheduled"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            if [[ "$COMMAND" == "restore" ]] && [[ -z "${RESTORE_FILE:-}" ]]; then
                RESTORE_FILE="$1"
                shift
            else
                log_error "Unknown option: $1"
                usage
                exit 1
            fi
            ;;
    esac
done

# Check prerequisites
check_prerequisites

# Execute command
case "$COMMAND" in
    backup)
        perform_backup
        ;;
    restore)
        if [[ -z "${RESTORE_FILE:-}" ]]; then
            log_error "Restore file required"
            usage
            exit 1
        fi
        restore_from_backup "$RESTORE_FILE" "${RESTORE_COMPONENTS:-all}"
        ;;
    disaster-recovery)
        disaster_recovery
        ;;
    list)
        log "Available backups:"
        find "$BACKUP_BASE_DIR" -name "rtpengine_backup_*.tar*" -type f | sort -r
        
        if [[ -n "$S3_BUCKET" ]]; then
            log ""
            log "S3 backups:"
            aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | sort -r
        fi
        ;;
    setup-cron)
        setup_automated_backups
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    scheduled)
        scheduled_backup
        ;;
    *)
        log_error "Command required"
        usage
        exit 1
        ;;
esac