#!/bin/bash
# Instance-specific configuration script for golden image RTPEngine deployments
# This script runs on startup to configure instance-specific settings

set -e

# Variables from Terraform
INSTANCE_NUM="${instance_num}"
INSTANCE_NAME="${instance_name}"
INTERNAL_IP="${internal_ip}"
EXTERNAL_IP="${external_ip}"
CONSUL_SERVERS="${consul_servers}"
DATACENTER="${datacenter}"
REDIS_HOST="${redis_host}"
REDIS_PORT="${redis_port}"
RTP_PORT_MIN="${rtp_port_min}"
RTP_PORT_MAX="${rtp_port_max}"

# Log startup
echo "Starting instance-specific configuration for $${INSTANCE_NAME}..." | tee -a /var/log/rtpengine-deploy.log

# Set hostname
hostnamectl set-hostname "$${INSTANCE_NAME}"

# Update RTPEngine configuration with instance-specific settings
if [ -f /etc/rtpengine/rtpengine.conf ]; then
    echo "Updating RTPEngine configuration..." | tee -a /var/log/rtpengine-deploy.log
    
    # Backup original config
    cp /etc/rtpengine/rtpengine.conf /etc/rtpengine/rtpengine.conf.bak
    
    # Update network interfaces
    sed -i "s/interface = .*/interface = $${EXTERNAL_IP}/" /etc/rtpengine/rtpengine.conf
    
    # Add internal interface if not exists
    if ! grep -q "interface = $${INTERNAL_IP}" /etc/rtpengine/rtpengine.conf; then
        sed -i "/interface = $${EXTERNAL_IP}/a interface = $${INTERNAL_IP}" /etc/rtpengine/rtpengine.conf
    fi
    
    # Update port range
    sed -i "s/port-min = .*/port-min = $${RTP_PORT_MIN}/" /etc/rtpengine/rtpengine.conf
    sed -i "s/port-max = .*/port-max = $${RTP_PORT_MAX}/" /etc/rtpengine/rtpengine.conf
    
    # Update Redis configuration
    sed -i "s/redis = .*/redis = $${REDIS_HOST}:$${REDIS_PORT}\/5/" /etc/rtpengine/rtpengine.conf
    sed -i "s/redis-write = .*/redis-write = $${REDIS_HOST}:$${REDIS_PORT}\/5/" /etc/rtpengine/rtpengine.conf
    
    # Update graphite prefix
    sed -i "s/graphite-prefix = .*/graphite-prefix = rtpengine.$${INSTANCE_NAME}/" /etc/rtpengine/rtpengine.conf
fi

# Configure Consul if not already configured
if [ ! -f /etc/consul.d/consul.hcl ]; then
    echo "Configuring Consul..." | tee -a /var/log/rtpengine-deploy.log
    
    # Create Consul directories
    mkdir -p /etc/consul.d /opt/consul
    
    # Create Consul configuration
    cat > /etc/consul.d/consul.hcl <<EOF
datacenter = "$${DATACENTER}"
data_dir = "/opt/consul"
log_level = "INFO"
node_name = "$${INSTANCE_NAME}"
server = false

bind_addr = "$${INTERNAL_IP}"
client_addr = "127.0.0.1"

retry_join = [$(echo "$${CONSUL_SERVERS}" | sed 's/,/","/g' | sed 's/^/"/;s/$/"/')]

services {
  id = "rtpengine-$${INSTANCE_NUM}"
  name = "rtpengine"
  tags = ["gcp", "production", "golden-image"]
  port = 2223
  address = "$${EXTERNAL_IP}"

  meta = {
    external_ip = "$${EXTERNAL_IP}"
    internal_ip = "$${INTERNAL_IP}"
    capacity = "10000"
    rtp_port_min = "$${RTP_PORT_MIN}"
    rtp_port_max = "$${RTP_PORT_MAX}"
    instance_index = "$${INSTANCE_NUM}"
  }

  checks = [
    {
      id = "rtpengine-control-tcp"
      name = "RTPEngine Control Protocol TCP"
      tcp = "localhost:2223"
      interval = "10s"
      timeout = "3s"
    },
    {
      id = "rtpengine-process"
      name = "RTPEngine Process Check"
      args = ["/bin/systemctl", "is-active", "rtpengine"]
      interval = "30s"
      timeout = "5s"
    }
  ]
}

telemetry {
  prometheus_retention_time = "60s"
  disable_hostname = false
  metrics_prefix = "consul"
}
EOF
    
    # Set ownership
    chown -R consul:consul /etc/consul.d /opt/consul || true
fi

# Restart services
echo "Restarting services..." | tee -a /var/log/rtpengine-deploy.log

# Start Consul if not running
if systemctl is-enabled consul 2>/dev/null; then
    systemctl restart consul
else
    systemctl enable consul || true
    systemctl start consul || true
fi

# Wait for network and Consul
sleep 10

# Restart RTPEngine
if systemctl is-enabled rtpengine 2>/dev/null; then
    systemctl restart rtpengine
elif systemctl is-enabled ngcp-rtpengine-daemon 2>/dev/null; then
    systemctl restart ngcp-rtpengine-daemon
else
    echo "RTPEngine service not found, may need manual configuration" | tee -a /var/log/rtpengine-deploy.log
fi

# Update Consul KV with instance information
if command -v consul >/dev/null 2>&1; then
    consul kv put "rtpengine/instances/$${INSTANCE_NAME}/status" "ready" || true
    consul kv put "rtpengine/instances/$${INSTANCE_NAME}/external_ip" "$${EXTERNAL_IP}" || true
    consul kv put "rtpengine/instances/$${INSTANCE_NAME}/internal_ip" "$${INTERNAL_IP}" || true
    consul kv put "rtpengine/instances/$${INSTANCE_NAME}/rtp_ports" "$${RTP_PORT_MIN}-$${RTP_PORT_MAX}" || true
fi

# Log completion
echo "RTPEngine instance $${INSTANCE_NAME} configured successfully at $(date)" | tee -a /var/log/rtpengine-deploy.log