#!/bin/bash
# RTPEngine VM Startup Script
# This script runs on VM boot to configure network settings

set -euo pipefail

# Configuration
LOG_FILE="/var/log/rtpengine-startup.log"
METADATA_URL="http://metadata.google.internal/computeMetadata/v1"
METADATA_HEADER="Metadata-Flavor: Google"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $@" | tee -a "${LOG_FILE}"
}

# Get metadata with retry
get_metadata() {
    local path="$1"
    local max_retries=10
    local retry_delay=2
    
    for i in $(seq 1 $max_retries); do
        if result=$(curl -s -H "${METADATA_HEADER}" "${METADATA_URL}/${path}" 2>/dev/null); then
            echo "$result"
            return 0
        fi
        log "Metadata fetch attempt $i failed, retrying in ${retry_delay}s..."
        sleep $retry_delay
    done
    
    log "ERROR: Failed to fetch metadata after $max_retries attempts"
    return 1
}

# Main startup sequence
main() {
    log "Starting RTPEngine VM startup configuration"
    
    # Get instance metadata
    INSTANCE_NAME=$(get_metadata "instance/name") || exit 1
    INSTANCE_ZONE=$(get_metadata "instance/zone" | cut -d'/' -f4) || exit 1
    INSTANCE_ID=$(get_metadata "instance/id") || exit 1
    
    # Extract instance number from name (e.g., rtpengine-instance-1 -> 1)
    INSTANCE_NUMBER=$(echo "$INSTANCE_NAME" | grep -oE '[0-9]+$' || echo "0")
    
    log "Instance Details:"
    log "  Name: $INSTANCE_NAME"
    log "  Zone: $INSTANCE_ZONE"
    log "  ID: $INSTANCE_ID"
    log "  Number: $INSTANCE_NUMBER"
    
    # Get custom metadata
    RTP_START_PORT=$(get_metadata "instance/attributes/rtp-start-port" || echo "30000")
    RTP_END_PORT=$(get_metadata "instance/attributes/rtp-end-port" || echo "40000")
    SIGNALING_IP=$(get_metadata "instance/attributes/signaling-ip" || echo "")
    MEDIA_IP=$(get_metadata "instance/attributes/media-ip" || echo "")
    
    # Get network interfaces
    INTERNAL_IP=$(get_metadata "instance/network-interfaces/0/ip") || exit 1
    EXTERNAL_IP=$(get_metadata "instance/network-interfaces/0/access-configs/0/external-ip" || echo "")
    
    log "Network Configuration:"
    log "  Internal IP: $INTERNAL_IP"
    log "  External IP: $EXTERNAL_IP"
    log "  Signaling IP: $SIGNALING_IP"
    log "  Media IP: $MEDIA_IP"
    log "  RTP Ports: $RTP_START_PORT-$RTP_END_PORT"
    
    # Store configuration for other scripts
    cat > /etc/rtpengine/instance.conf <<EOF
INSTANCE_NAME=$INSTANCE_NAME
INSTANCE_ZONE=$INSTANCE_ZONE
INSTANCE_ID=$INSTANCE_ID
INSTANCE_NUMBER=$INSTANCE_NUMBER
INTERNAL_IP=$INTERNAL_IP
EXTERNAL_IP=$EXTERNAL_IP
SIGNALING_IP=$SIGNALING_IP
MEDIA_IP=$MEDIA_IP
RTP_START_PORT=$RTP_START_PORT
RTP_END_PORT=$RTP_END_PORT
EOF
    
    # Configure network interfaces if multiple IPs provided
    if [[ -n "$SIGNALING_IP" && "$SIGNALING_IP" != "$INTERNAL_IP" ]]; then
        log "Configuring signaling network interface"
        # Add alias for signaling IP if different from primary
        ip addr add "$SIGNALING_IP/32" dev eth0 label eth0:sig 2>/dev/null || true
    fi
    
    if [[ -n "$MEDIA_IP" && "$MEDIA_IP" != "$INTERNAL_IP" && "$MEDIA_IP" != "$SIGNALING_IP" ]]; then
        log "Configuring media network interface"
        # Add alias for media IP if different
        ip addr add "$MEDIA_IP/32" dev eth0 label eth0:media 2>/dev/null || true
    fi
    
    # Configure sysctl for RTP
    log "Applying sysctl optimizations"
    cat > /etc/sysctl.d/99-rtpengine.conf <<EOF
# RTPEngine Network Optimizations
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.netdev_max_backlog = 5000
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
EOF
    sysctl -p /etc/sysctl.d/99-rtpengine.conf
    
    # Configure firewall rules
    log "Configuring firewall rules"
    
    # Allow RTPEngine signaling port
    iptables -A INPUT -p udp --dport 22222 -j ACCEPT
    iptables -A INPUT -p tcp --dport 22222 -j ACCEPT
    
    # Allow RTP port range
    iptables -A INPUT -p udp --dport ${RTP_START_PORT}:${RTP_END_PORT} -j ACCEPT
    
    # Allow monitoring ports
    iptables -A INPUT -p tcp --dport 9100 -j ACCEPT  # Node exporter
    iptables -A INPUT -p tcp --dport 8080 -j ACCEPT  # RTPEngine stats
    
    # Save iptables rules
    if command -v netfilter-persistent >/dev/null 2>&1; then
        netfilter-persistent save
    elif command -v iptables-save >/dev/null 2>&1; then
        iptables-save > /etc/iptables/rules.v4
    fi
    
    # Configure instance-specific settings
    log "Running instance configuration"
    /opt/rtpengine/system/configure-instance.sh
    
    # Setup logging
    log "Configuring logging"
    /opt/rtpengine/system/setup-logging.sh
    
    # Start services
    log "Starting RTPEngine service"
    systemctl daemon-reload
    systemctl enable rtpengine
    systemctl start rtpengine
    
    # Enable monitoring services
    systemctl enable node_exporter 2>/dev/null || true
    systemctl start node_exporter 2>/dev/null || true
    
    log "Startup configuration complete"
    
    # Run health check
    sleep 5
    /opt/rtpengine/system/health-check.sh || log "WARNING: Initial health check failed"
}

# Run main function
main "$@"