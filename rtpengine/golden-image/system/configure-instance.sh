#!/bin/bash
# Configure RTPEngine instance-specific settings

set -euo pipefail

# Load instance configuration
source /etc/rtpengine/instance.conf

LOG_FILE="/var/log/rtpengine-configure.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $@" | tee -a "${LOG_FILE}"
}

# Generate RTPEngine configuration
generate_rtpengine_config() {
    local config_file="/etc/rtpengine/rtpengine.conf"
    
    log "Generating RTPEngine configuration for instance $INSTANCE_NUMBER"
    
    # Determine IPs to use
    local sig_ip="${SIGNALING_IP:-$INTERNAL_IP}"
    local media_ip="${MEDIA_IP:-$INTERNAL_IP}"
    local advertise_ip="${EXTERNAL_IP:-$INTERNAL_IP}"
    
    # Calculate port ranges per instance
    local ports_per_instance=10000
    local instance_offset=$((($INSTANCE_NUMBER - 1) * $ports_per_instance))
    local min_port=$((RTP_START_PORT + instance_offset))
    local max_port=$((min_port + ports_per_instance - 1))
    
    # Ensure we don't exceed the configured range
    if [[ $max_port -gt $RTP_END_PORT ]]; then
        max_port=$RTP_END_PORT
    fi
    
    log "Port range for instance $INSTANCE_NUMBER: $min_port-$max_port"
    
    cat > "$config_file" <<EOF
[rtpengine]
# Instance: $INSTANCE_NAME
# Generated: $(date)

# Network Configuration
interface = ${sig_ip}
listen-ng = ${sig_ip}:22222
listen-tcp = ${sig_ip}:22222
listen-udp = ${sig_ip}:22222

# Media Configuration
interface = ${media_ip}
advertised-ip = ${advertise_ip}

# Port Range (Instance-specific)
port-min = ${min_port}
port-max = ${max_port}

# Homer/HEP Integration
homer = 127.0.0.1:9060
homer-protocol = udp
homer-id = ${INSTANCE_NUMBER}

# Logging
log-level = 6
log-facility = local0
log-facility-cdr = local1
log-facility-rtcp = local2

# Performance
num-threads = 16
delete-delay = 30
timeout = 60
silent-timeout = 3600
final-timeout = 10800

# Features
tos = 184
control-tos = 184
graphite = 127.0.0.1:2003
graphite-interval = 60
graphite-prefix = rtpengine.${INSTANCE_NAME//-/.}

# Recording (if enabled)
recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

# Table management
table = 0
no-fallback = false

# Redis Configuration (for distributed setup)
redis = 127.0.0.1:6379
redis-db = ${INSTANCE_NUMBER}
subscribe-keyspace = 1
EOF

    # Create table entries for iptables
    log "Configuring kernel forwarding table"
    local table_num=$((INSTANCE_NUMBER - 1))
    echo "add $table_num" > /proc/rtpengine/control || true
}

# Generate systemd service override
generate_systemd_override() {
    local override_dir="/etc/systemd/system/rtpengine.service.d"
    mkdir -p "$override_dir"
    
    log "Creating systemd service override"
    
    cat > "$override_dir/10-instance.conf" <<EOF
[Service]
# Instance-specific overrides
Environment="INSTANCE=$INSTANCE_NUMBER"
Environment="INSTANCE_NAME=$INSTANCE_NAME"

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768
LimitCORE=infinity

# CPU affinity (distribute instances across cores)
CPUAffinity=$((($INSTANCE_NUMBER - 1) % $(nproc)))

# Restart policy
Restart=always
RestartSec=5s

# Health monitoring
ExecStartPost=/opt/rtpengine/system/health-check.sh --startup
EOF
}

# Configure kernel modules
configure_kernel_modules() {
    log "Loading required kernel modules"
    
    modprobe xt_RTPENGINE 2>/dev/null || true
    modprobe iptable_filter
    modprobe ip_tables
    modprobe x_tables
    
    # Ensure modules load on boot
    cat > /etc/modules-load.d/rtpengine.conf <<EOF
xt_RTPENGINE
iptable_filter
ip_tables
x_tables
EOF
}

# Configure Redis for session storage
configure_redis() {
    log "Configuring Redis for session storage"
    
    if command -v redis-cli >/dev/null 2>&1; then
        # Set Redis configuration
        cat >> /etc/redis/redis.conf <<EOF

# RTPEngine Configuration
maxmemory 2gb
maxmemory-policy allkeys-lru
save ""
appendonly no
EOF
        
        systemctl restart redis-server || true
        
        # Create instance-specific database
        redis-cli SELECT ${INSTANCE_NUMBER} 2>/dev/null || true
    fi
}

# Configure monitoring
configure_monitoring() {
    log "Configuring monitoring endpoints"
    
    # Create Prometheus metrics endpoint
    mkdir -p /var/lib/prometheus/node-exporter
    
    # RTPEngine stats collector script
    cat > /usr/local/bin/rtpengine-exporter <<'EOF'
#!/bin/bash
# Export RTPEngine stats for Prometheus

while true; do
    if stats=$(rtpengine-ctl -p /var/run/rtpengine/rtpengine.pid stats); then
        echo "$stats" | awk '
            /Current sessions/ { print "rtpengine_sessions_current " $3 }
            /Total managed sessions/ { print "rtpengine_sessions_total " $4 }
            /Current streams/ { print "rtpengine_streams_current " $3 }
            /Current transcoded media/ { print "rtpengine_transcoded_current " $4 }
            /Total call duration/ { print "rtpengine_call_duration_total " $4 }
        ' > /var/lib/prometheus/node-exporter/rtpengine.prom.$$
        mv /var/lib/prometheus/node-exporter/rtpengine.prom.$$ \
           /var/lib/prometheus/node-exporter/rtpengine.prom
    fi
    sleep 15
done
EOF
    chmod +x /usr/local/bin/rtpengine-exporter
    
    # Create systemd service for exporter
    cat > /etc/systemd/system/rtpengine-exporter.service <<EOF
[Unit]
Description=RTPEngine Prometheus Exporter
After=rtpengine.service

[Service]
Type=simple
ExecStart=/usr/local/bin/rtpengine-exporter
Restart=always
User=rtpengine

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable rtpengine-exporter
    systemctl start rtpengine-exporter
}

# Main configuration
main() {
    log "Starting instance-specific configuration"
    
    # Create necessary directories
    mkdir -p /etc/rtpengine
    mkdir -p /var/spool/rtpengine
    mkdir -p /var/log/rtpengine
    mkdir -p /var/run/rtpengine
    
    # Set permissions
    useradd -r -s /bin/false rtpengine 2>/dev/null || true
    chown -R rtpengine:rtpengine /var/spool/rtpengine
    chown -R rtpengine:rtpengine /var/log/rtpengine
    chown -R rtpengine:rtpengine /var/run/rtpengine
    
    # Configure components
    configure_kernel_modules
    generate_rtpengine_config
    generate_systemd_override
    configure_redis
    configure_monitoring
    
    log "Instance configuration complete"
}

# Run main function
main "$@"