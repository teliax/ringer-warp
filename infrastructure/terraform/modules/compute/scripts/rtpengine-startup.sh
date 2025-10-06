#!/bin/bash
set -e

# RTPEngine and Consul startup script for GCP VMs
# This script configures and starts RTPEngine with Consul service discovery

# Variables from Terraform
CONSUL_SERVERS="${consul_servers}"
DATACENTER="${datacenter}"
INSTANCE_INDEX="${instance_index}"
EXTERNAL_IP="${external_ip}"
RTP_PORT_MIN="${rtp_port_min}"
RTP_PORT_MAX="${rtp_port_max}"
REDIS_HOST="${redis_host}"
REDIS_PORT="${redis_port}"
PROJECT_ID="${project_id}"
LOG_LEVEL="${log_level}"

# Get instance metadata
INSTANCE_NAME=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/name)
INSTANCE_ZONE=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone | cut -d'/' -f4)
INTERNAL_IP=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y \
    curl \
    gnupg \
    lsb-release \
    unzip \
    dnsutils \
    net-tools \
    redis-tools \
    jq

# Install Consul
CONSUL_VERSION="1.17.1"
curl -Lo /tmp/consul.zip "https://releases.hashicorp.com/consul/$${CONSUL_VERSION}/consul_$${CONSUL_VERSION}_linux_amd64.zip"
unzip /tmp/consul.zip -d /usr/local/bin/
chmod +x /usr/local/bin/consul

# Create Consul user and directories
useradd --system --home /etc/consul.d --shell /bin/false consul || true
mkdir -p /etc/consul.d /opt/consul
chown -R consul:consul /etc/consul.d /opt/consul

# Configure Consul client
cat > /etc/consul.d/consul.hcl <<EOF
datacenter = "$${DATACENTER}"
data_dir = "/opt/consul"
log_level = "INFO"
node_name = "$${INSTANCE_NAME}"
server = false
encrypt = "$(consul keygen)"

bind_addr = "$${INTERNAL_IP}"
client_addr = "127.0.0.1"

retry_join = [$(echo "$${CONSUL_SERVERS}" | sed 's/,/","/g' | sed 's/^/"/;s/$/"/')]

services {
  id = "rtpengine-$${INSTANCE_INDEX}"
  name = "rtpengine"
  tags = ["gcp", "$${INSTANCE_ZONE}", "production"]
  port = 2223
  address = "$${EXTERNAL_IP}"

  meta = {
    external_ip = "$${EXTERNAL_IP}"
    internal_ip = "$${INTERNAL_IP}"
    capacity = "10000"
    rtp_port_min = "$${RTP_PORT_MIN}"
    rtp_port_max = "$${RTP_PORT_MAX}"
    instance_index = "$${INSTANCE_INDEX}"
    zone = "$${INSTANCE_ZONE}"
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
    },
    {
      id = "rtpengine-port-availability"
      name = "RTP Port Range Availability"
      script = "/usr/local/bin/check-rtp-ports.sh"
      interval = "60s"
      timeout = "10s"
    }
  ]
}

telemetry {
  prometheus_retention_time = "60s"
  disable_hostname = false
  metrics_prefix = "consul"
}
EOF

# Create systemd service for Consul
cat > /etc/systemd/system/consul.service <<EOF
[Unit]
Description=Consul
Documentation=https://www.consul.io/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=/etc/consul.d/consul.hcl

[Service]
Type=notify
User=consul
Group=consul
ExecStart=/usr/local/bin/consul agent -config-dir=/etc/consul.d/
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=process
Restart=on-failure
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Install RTPEngine
echo "deb https://deb.sipwise.com/spce/mr11.5.1 bullseye main" > /etc/apt/sources.list.d/sipwise.list
wget -q -O - https://deb.sipwise.com/spce/sipwise.gpg | apt-key add -
apt-get update
apt-get install -y ngcp-rtpengine

# Configure RTPEngine
cat > /etc/rtpengine/rtpengine.conf <<EOF
[rtpengine]
# Network interfaces
interface = $${EXTERNAL_IP}
interface = $${INTERNAL_IP}

# Control protocols
listen-ng = 0.0.0.0:2223
listen-cli = 127.0.0.1:9900

# RTP port range
port-min = $${RTP_PORT_MIN}
port-max = $${RTP_PORT_MAX}

# Redis for shared state
redis = $${REDIS_HOST}:$${REDIS_PORT}/5
redis-write = $${REDIS_HOST}:$${REDIS_PORT}/5
redis-num-threads = 8
redis-expires = 86400
redis-allowed-errors = -1
redis-disable-time = 10

# Logging
log-level = $${LOG_LEVEL}
log-facility = local1
log-facility-cdr = local2
log-facility-rtcp = local3

# Performance
num-threads = 16
thread-stack = 2048
homer = no
homer-protocol = udp
homer-id = 2000

# Media handling
tos = 184
delete-delay = 30
timeout = 60
silent-timeout = 3600
final-timeout = 10800

# Security
dtls-passive = no

# Recording
recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

# Statistics
graphite = 127.0.0.1:2003
graphite-interval = 60
graphite-prefix = rtpengine.$${INSTANCE_NAME}

# Kernel module
table = 0
no-fallback = no
EOF

# Create RTP port availability check script
cat > /usr/local/bin/check-rtp-ports.sh <<'SCRIPT'
#!/bin/bash
# Check if RTP ports are available
netstat -uln | grep -q ":$${RTP_PORT_MIN}" || exit 1
echo "RTP ports available"
exit 0
SCRIPT
chmod +x /usr/local/bin/check-rtp-ports.sh

# Configure kernel parameters for RTPEngine
cat >> /etc/sysctl.conf <<EOF
# RTPEngine optimizations
net.ipv4.ip_local_port_range = 1024 65535
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.udp_rmem_min = 2097152
net.ipv4.udp_wmem_min = 2097152
net.core.netdev_max_backlog = 5000
net.ipv4.ip_forward = 1
EOF
sysctl -p

# Load kernel module for RTPEngine
modprobe xt_RTPENGINE || true
echo "xt_RTPENGINE" >> /etc/modules

# Enable and start services
systemctl daemon-reload
systemctl enable consul
systemctl start consul

# Wait for Consul to be ready
sleep 10

systemctl enable ngcp-rtpengine-daemon
systemctl start ngcp-rtpengine-daemon

# Configure Google Cloud Ops Agent for monitoring
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install

# Configure Ops Agent for RTPEngine metrics
cat > /etc/google-cloud-ops-agent/config.yaml <<EOF
metrics:
  receivers:
    rtpengine:
      type: prometheus
      config:
        scrape_configs:
          - job_name: rtpengine
            scrape_interval: 30s
            static_configs:
              - targets: ['localhost:9103']
  service:
    pipelines:
      rtpengine:
        receivers:
          - rtpengine
logging:
  receivers:
    syslog:
      type: files
      include_paths:
        - /var/log/syslog
        - /var/log/rtpengine/*.log
  service:
    pipelines:
      default:
        receivers:
          - syslog
EOF

systemctl restart google-cloud-ops-agent

# Log successful startup
logger -t rtpengine-startup "RTPEngine instance $${INSTANCE_NAME} successfully configured and started"
echo "RTPEngine startup complete for instance $${INSTANCE_NAME}" | tee /var/log/rtpengine-startup.log

# Send startup notification to Consul KV
consul kv put "rtpengine/instances/$${INSTANCE_NAME}/status" "ready"
consul kv put "rtpengine/instances/$${INSTANCE_NAME}/external_ip" "$${EXTERNAL_IP}"
consul kv put "rtpengine/instances/$${INSTANCE_NAME}/internal_ip" "$${INTERNAL_IP}"
consul kv put "rtpengine/instances/$${INSTANCE_NAME}/capacity" "10000"