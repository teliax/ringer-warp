#!/bin/bash
# Setup logging and monitoring for RTPEngine

set -euo pipefail

LOG_FILE="/var/log/rtpengine-logging-setup.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $@" | tee -a "${LOG_FILE}"
}

# Configure rsyslog for RTPEngine
configure_rsyslog() {
    log "Configuring rsyslog for RTPEngine"
    
    cat > /etc/rsyslog.d/50-rtpengine.conf <<'EOF'
# RTPEngine Logging Configuration

# Define RTPEngine log template
template(name="RTPEngineLogFormat" type="list") {
    constant(value="/var/log/rtpengine/")
    property(name="programname" securepath="replace")
    constant(value="/")
    property(name="programname" securepath="replace")
    constant(value=".log")
}

# RTPEngine main logs
if $programname == 'rtpengine' then {
    # Main log file
    local0.* /var/log/rtpengine/rtpengine.log
    
    # CDR logs
    local1.* /var/log/rtpengine/rtpengine-cdr.log
    
    # RTCP logs
    local2.* /var/log/rtpengine/rtpengine-rtcp.log
    
    # Forward to Google Cloud Logging if available
    if $msg contains 'ERROR' or $msg contains 'CRITICAL' then {
        action(type="omfwd"
               Target="127.0.0.1"
               Port="514"
               Protocol="udp"
               queue.type="LinkedList"
               action.resumeRetryCount="3"
               action.resumeInterval="10"
               queue.size="10000"
               queue.discardmark="9500"
               queue.highwatermark="8000"
               queue.lowwatermark="2000"
               queue.maxdiskspace="1g"
               queue.saveonshutdown="on"
               queue.type="LinkedList"
               queue.filename="rtpengine_error_fwd")
    }
    
    stop
}

# System logs for RTPEngine scripts
if $programname == 'rtpengine-startup' then /var/log/rtpengine/startup.log
if $programname == 'rtpengine-health' then /var/log/rtpengine/health.log
& stop
EOF
    
    # Configure log rotation
    cat > /etc/logrotate.d/rtpengine <<EOF
/var/log/rtpengine/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 rtpengine adm
    sharedscripts
    postrotate
        /bin/kill -HUP \$(cat /var/run/rsyslogd.pid 2> /dev/null) 2> /dev/null || true
        # Send rotation event to monitoring
        logger -t rtpengine-logrotate "Log rotation completed"
    endscript
}
EOF
    
    # Restart rsyslog
    systemctl restart rsyslog
}

# Configure Google Cloud Logging agent
configure_cloud_logging() {
    log "Configuring Google Cloud Logging"
    
    # Check if Ops Agent is installed
    if command -v google-cloud-ops-agent >/dev/null 2>&1; then
        log "Google Cloud Ops Agent detected"
        
        # Configure Ops Agent for RTPEngine
        cat > /etc/google-cloud-ops-agent/config.d/rtpengine.yaml <<EOF
logging:
  receivers:
    rtpengine_logs:
      type: files
      paths:
        - /var/log/rtpengine/rtpengine.log
      exclude_paths:
        - /var/log/rtpengine/rtpengine-cdr.log
    rtpengine_cdr:
      type: files
      paths:
        - /var/log/rtpengine/rtpengine-cdr.log
    rtpengine_health:
      type: files
      paths:
        - /var/log/rtpengine/health.log
    syslog_rtpengine:
      type: syslog
      protocol:
        transport: udp
        address: "127.0.0.1:514"
  
  processors:
    rtpengine_parser:
      type: parse_regex
      regex: '^\[(?<timestamp>[^\]]+)\]\s+\[(?<level>\w+)\]\s+(?<message>.*)'
      time_key: timestamp
      time_format: "%Y-%m-%d %H:%M:%S"
    
    rtpengine_severity:
      type: modify_fields
      fields:
        severity:
          move_from: jsonPayload.level
          map_values:
            CRITICAL: "CRITICAL"
            ERROR: "ERROR"
            WARNING: "WARNING"
            INFO: "INFO"
            DEBUG: "DEBUG"
  
  service:
    pipelines:
      rtpengine_pipeline:
        receivers: [rtpengine_logs]
        processors: [rtpengine_parser, rtpengine_severity]
        exporters: [google_cloud_logging]
      
      rtpengine_cdr_pipeline:
        receivers: [rtpengine_cdr]
        exporters: [google_cloud_logging]
      
      rtpengine_health_pipeline:
        receivers: [rtpengine_health]
        processors: [rtpengine_parser]
        exporters: [google_cloud_logging]

metrics:
  receivers:
    rtpengine_metrics:
      type: prometheus
      config:
        scrape_configs:
          - job_name: rtpengine
            scrape_interval: 30s
            static_configs:
              - targets: ['localhost:9100']
                labels:
                  service: 'rtpengine'
                  instance: '$(hostname)'
  
  service:
    pipelines:
      rtpengine_metrics:
        receivers: [rtpengine_metrics]
        exporters: [google_cloud_monitoring]
EOF
        
        # Restart Ops Agent
        systemctl restart google-cloud-ops-agent
        
    elif command -v google-fluentd >/dev/null 2>&1; then
        log "Legacy Stackdriver Logging Agent detected"
        
        # Configure legacy Fluentd
        cat > /etc/google-fluentd/config.d/rtpengine.conf <<EOF
<source>
  @type tail
  path /var/log/rtpengine/rtpengine.log
  pos_file /var/lib/google-fluentd/pos/rtpengine.log.pos
  tag rtpengine
  <parse>
    @type regexp
    expression /^\[(?<timestamp>[^\]]+)\]\s+\[(?<level>\w+)\]\s+(?<message>.*)/
    time_key timestamp
    time_format %Y-%m-%d %H:%M:%S
  </parse>
</source>

<source>
  @type tail
  path /var/log/rtpengine/rtpengine-cdr.log
  pos_file /var/lib/google-fluentd/pos/rtpengine-cdr.log.pos
  tag rtpengine.cdr
  <parse>
    @type none
  </parse>
</source>

<filter rtpengine>
  @type record_transformer
  <record>
    severity \${record["level"]}
    service rtpengine
    instance \${hostname}
  </record>
</filter>

<match rtpengine.**>
  @type google_cloud
  use_metadata_service true
  detect_subservice false
</match>
EOF
        
        # Restart Fluentd
        systemctl restart google-fluentd
    else
        log "No Google Cloud logging agent found, skipping cloud logging setup"
    fi
}

# Configure structured logging
configure_structured_logging() {
    log "Setting up structured logging helpers"
    
    # Create structured logging wrapper
    cat > /usr/local/bin/rtpengine-log <<'EOF'
#!/bin/bash
# Structured logging helper for RTPEngine

SEVERITY="${1:-INFO}"
COMPONENT="${2:-rtpengine}"
MESSAGE="${3:-No message provided}"
shift 3

# Additional fields
EXTRA_FIELDS=""
while [[ $# -gt 0 ]]; do
    key="$1"
    value="$2"
    EXTRA_FIELDS="${EXTRA_FIELDS}, \"$key\": \"$value\""
    shift 2
done

# Get instance info
if [[ -f /etc/rtpengine/instance.conf ]]; then
    source /etc/rtpengine/instance.conf
fi

# Create structured log entry
cat <<JSON | logger -t rtpengine-${COMPONENT} -p local0.info
{
  "@timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "severity": "$SEVERITY",
  "component": "$COMPONENT",
  "instance": "${INSTANCE_NAME:-unknown}",
  "instance_id": "${INSTANCE_ID:-unknown}",
  "message": "$MESSAGE"${EXTRA_FIELDS}
}
JSON
EOF
    chmod +x /usr/local/bin/rtpengine-log
}

# Configure metrics collection
configure_metrics_collection() {
    log "Configuring metrics collection"
    
    # Create metrics collection script
    cat > /usr/local/bin/rtpengine-metrics-collector <<'EOF'
#!/bin/bash
# Collect and export RTPEngine metrics

METRICS_DIR="/var/lib/prometheus/node-exporter"
STATS_FILE="$METRICS_DIR/rtpengine.prom"

# Load instance config
if [[ -f /etc/rtpengine/instance.conf ]]; then
    source /etc/rtpengine/instance.conf
fi

# Collect system metrics
collect_system_metrics() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local mem_usage=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk -F', ' '{print $1}')
    
    cat >> "$STATS_FILE.tmp" <<EOF
# System metrics
rtpengine_cpu_usage_percent{instance="$INSTANCE_NAME"} $cpu_usage
rtpengine_memory_usage_percent{instance="$INSTANCE_NAME"} $mem_usage
rtpengine_load_average{instance="$INSTANCE_NAME"} $load_avg
EOF
}

# Collect RTPEngine metrics
collect_rtpengine_metrics() {
    if [[ -x /usr/bin/rtpengine-ctl ]]; then
        local stats=$(rtpengine-ctl -p /var/run/rtpengine/rtpengine.pid stats 2>/dev/null)
        if [[ -n "$stats" ]]; then
            echo "$stats" | awk -v instance="$INSTANCE_NAME" '
                /Current sessions/ { 
                    print "rtpengine_sessions_active{instance=\"" instance "\"} " $3
                }
                /Total managed sessions/ { 
                    print "rtpengine_sessions_total{instance=\"" instance "\"} " $4
                }
                /Current streams/ { 
                    print "rtpengine_streams_active{instance=\"" instance "\"} " $3
                }
                /Total RTP packets/ { 
                    print "rtpengine_rtp_packets_total{instance=\"" instance "\"} " $4
                }
                /Total RTCP packets/ { 
                    print "rtpengine_rtcp_packets_total{instance=\"" instance "\"} " $4
                }
                /Packets relayed/ { 
                    print "rtpengine_packets_relayed_total{instance=\"" instance "\"} " $3
                }
                /Packet errors/ { 
                    print "rtpengine_packet_errors_total{instance=\"" instance "\"} " $3
                }
            ' >> "$STATS_FILE.tmp"
        fi
    fi
}

# Collect network metrics
collect_network_metrics() {
    local interface="${NETWORK_INTERFACE:-eth0}"
    if [[ -f /sys/class/net/$interface/statistics/rx_bytes ]]; then
        local rx_bytes=$(cat /sys/class/net/$interface/statistics/rx_bytes)
        local tx_bytes=$(cat /sys/class/net/$interface/statistics/tx_bytes)
        local rx_packets=$(cat /sys/class/net/$interface/statistics/rx_packets)
        local tx_packets=$(cat /sys/class/net/$interface/statistics/tx_packets)
        local rx_errors=$(cat /sys/class/net/$interface/statistics/rx_errors)
        local tx_errors=$(cat /sys/class/net/$interface/statistics/tx_errors)
        
        cat >> "$STATS_FILE.tmp" <<EOF
# Network metrics
rtpengine_network_rx_bytes_total{instance="$INSTANCE_NAME",interface="$interface"} $rx_bytes
rtpengine_network_tx_bytes_total{instance="$INSTANCE_NAME",interface="$interface"} $tx_bytes
rtpengine_network_rx_packets_total{instance="$INSTANCE_NAME",interface="$interface"} $rx_packets
rtpengine_network_tx_packets_total{instance="$INSTANCE_NAME",interface="$interface"} $tx_packets
rtpengine_network_rx_errors_total{instance="$INSTANCE_NAME",interface="$interface"} $rx_errors
rtpengine_network_tx_errors_total{instance="$INSTANCE_NAME",interface="$interface"} $tx_errors
EOF
    fi
}

# Main collection loop
mkdir -p "$METRICS_DIR"

echo "# RTPEngine Metrics - $(date)" > "$STATS_FILE.tmp"
echo "# Instance: ${INSTANCE_NAME:-unknown}" >> "$STATS_FILE.tmp"

collect_system_metrics
collect_rtpengine_metrics
collect_network_metrics

# Add timestamp
echo "rtpengine_metrics_last_update{instance=\"$INSTANCE_NAME\"} $(date +%s)" >> "$STATS_FILE.tmp"

# Atomic update
mv "$STATS_FILE.tmp" "$STATS_FILE"
EOF
    chmod +x /usr/local/bin/rtpengine-metrics-collector
    
    # Create cron job for metrics collection
    cat > /etc/cron.d/rtpengine-metrics <<EOF
# Collect RTPEngine metrics every minute
* * * * * rtpengine /usr/local/bin/rtpengine-metrics-collector
EOF
}

# Configure alerting
configure_alerting() {
    log "Setting up alerting configuration"
    
    # Create alert script
    cat > /usr/local/bin/rtpengine-alert <<'EOF'
#!/bin/bash
# Send RTPEngine alerts

ALERT_TYPE="${1:-unknown}"
ALERT_MESSAGE="${2:-No message}"
SEVERITY="${3:-warning}"

# Load instance config
if [[ -f /etc/rtpengine/instance.conf ]]; then
    source /etc/rtpengine/instance.conf
fi

# Log alert
/usr/local/bin/rtpengine-log "$SEVERITY" "alert" "$ALERT_MESSAGE" \
    "alert_type" "$ALERT_TYPE" \
    "instance" "$INSTANCE_NAME"

# Send to monitoring system
case "$SEVERITY" in
    critical|error)
        # For critical alerts, also log to system journal
        logger -t rtpengine-alert -p daemon.err "[$SEVERITY] $ALERT_TYPE: $ALERT_MESSAGE"
        ;;
    *)
        logger -t rtpengine-alert -p daemon.warning "[$SEVERITY] $ALERT_TYPE: $ALERT_MESSAGE"
        ;;
esac

# If webhook URL is configured, send alert
if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
    curl -X POST "$ALERT_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"severity\": \"$SEVERITY\",
            \"type\": \"$ALERT_TYPE\",
            \"message\": \"$ALERT_MESSAGE\",
            \"instance\": \"$INSTANCE_NAME\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }" 2>/dev/null || true
fi
EOF
    chmod +x /usr/local/bin/rtpengine-alert
}

# Main setup function
main() {
    log "Starting logging and monitoring setup"
    
    # Create necessary directories
    mkdir -p /var/log/rtpengine
    mkdir -p /var/lib/prometheus/node-exporter
    mkdir -p /etc/google-cloud-ops-agent/config.d
    
    # Set permissions
    chown -R rtpengine:adm /var/log/rtpengine
    chmod 750 /var/log/rtpengine
    
    # Configure components
    configure_rsyslog
    configure_cloud_logging
    configure_structured_logging
    configure_metrics_collection
    configure_alerting
    
    log "Logging and monitoring setup complete"
    
    # Test structured logging
    /usr/local/bin/rtpengine-log "INFO" "setup" "Logging configuration completed successfully"
}

# Run main function
main "$@"