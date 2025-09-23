#!/bin/bash

# RTPEngine VM Setup Script
# This script configures RTPEngine on GCP VM instances

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Configuration
REDIS_HOST="10.206.200.36"
REDIS_PORT="6379"
HOMER_HOST="10.0.0.100"  # Update with actual Homer IP
CONSUL_HOST="10.0.0.10"  # Update with actual Consul IP

echo -e "${GREEN}Starting RTPEngine VM setup...${NC}"

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
apt-get install -y \
    build-essential \
    git \
    curl \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libcurl4-openssl-dev \
    libglib2.0-dev \
    libhiredis-dev \
    libiptc-dev \
    libjson-glib-dev \
    libpcap-dev \
    libssl-dev \
    libsystemd-dev \
    libxmlrpc-core-c3-dev \
    markdown \
    pkg-config \
    zlib1g-dev \
    libopus-dev \
    libwebsockets-dev \
    libmariadb-dev \
    libspandsp-dev \
    libsrtp2-dev \
    libjansson-dev

# Install kernel modules for transcoding
echo -e "${YELLOW}Installing kernel modules...${NC}"
apt-get install -y dkms linux-headers-$(uname -r)

# Clone and build RTPEngine
echo -e "${YELLOW}Building RTPEngine from source...${NC}"
cd /usr/local/src
if [ ! -d "rtpengine" ]; then
    git clone https://github.com/sipwise/rtpengine.git
fi
cd rtpengine
git checkout mr11.5  # Use stable branch

# Build daemon
cd daemon
make
make install
cd ..

# Build iptables module
cd iptables-extension
make
make install
cd ..

# Build kernel module
cd kernel-module
make
make install
cd ..

# Create RTPEngine user
echo -e "${YELLOW}Creating RTPEngine user...${NC}"
useradd -r -s /bin/false rtpengine || true

# Create directories
mkdir -p /etc/rtpengine
mkdir -p /var/spool/rtpengine
mkdir -p /var/run/rtpengine
mkdir -p /var/log/rtpengine

# Set permissions
chown -R rtpengine:rtpengine /var/spool/rtpengine
chown -R rtpengine:rtpengine /var/run/rtpengine
chown -R rtpengine:rtpengine /var/log/rtpengine

# Get instance metadata
INSTANCE_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)

# Generate RTPEngine configuration
echo -e "${YELLOW}Generating RTPEngine configuration...${NC}"
cat > /etc/rtpengine/rtpengine.conf << EOF
[rtpengine]
table = 0
no-fallback = false

# Network interfaces
interface = private/${INSTANCE_IP}
interface = public/${EXTERNAL_IP}

# Listen addresses
listen-ng = 0.0.0.0:2223
listen-cli = 127.0.0.1:9900

# Port ranges for RTP
port-min = 30000
port-max = 40000

# TOS values
tos = 184

# Timeout settings
timeout = 60
silent-timeout = 3600
final-timeout = 10800

# Redis configuration
redis = redis://${REDIS_HOST}:${REDIS_PORT}/1
redis-write = redis://${REDIS_HOST}:${REDIS_PORT}/1
redis-num-threads = 8
redis-expires = 86400
redis-allowed-errors = -1
redis-disable-time = 10
redis-cmd-timeout = 0
redis-connect-timeout = 1000

# Recording options
recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

# DTLS support for WebRTC
dtls-passive = false

# Log levels
log-level = 6
log-facility = local1
log-facility-cdr = local2
log-facility-rtcp = local3

# Homer/HEP integration
homer = ${HOMER_HOST}:9060
homer-protocol = udp
homer-id = 2001

# Prometheus metrics
prometheus-port = 9101

# Maximum sessions
max-sessions = 50000

# Delete delay
delete-delay = 30

# Codec support
transcode = opus
transcode = g722
transcode = g711
transcode = gsm
transcode = amr
transcode = amr-wb

# SRTP support
sip-source = true
EOF

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
cat > /etc/systemd/system/rtpengine.service << 'EOF'
[Unit]
Description=RTPEngine media proxy
After=network.target
After=redis.service
Wants=redis.service

[Service]
Type=forking
PIDFile=/var/run/rtpengine/rtpengine.pid
Environment="CONFIG_FILE=/etc/rtpengine/rtpengine.conf"
Environment="RUNTIME_DIR=/var/run/rtpengine"

ExecStartPre=/bin/mkdir -p /var/run/rtpengine
ExecStartPre=/bin/chown rtpengine:rtpengine /var/run/rtpengine
ExecStartPre=/sbin/modprobe xt_RTPENGINE

ExecStart=/usr/local/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --pidfile=/var/run/rtpengine/rtpengine.pid
ExecReload=/bin/kill -HUP $MAINPID
ExecStop=/bin/kill -TERM $MAINPID

Restart=on-failure
RestartSec=5

User=root
Group=root

LimitNOFILE=65535
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
EOF

# Configure rsyslog for RTPEngine
echo -e "${YELLOW}Configuring rsyslog...${NC}"
cat > /etc/rsyslog.d/rtpengine.conf << 'EOF'
# RTPEngine logging
local1.*    /var/log/rtpengine/rtpengine.log
local2.*    /var/log/rtpengine/cdr.log
local3.*    /var/log/rtpengine/rtcp.log

# Stop processing after logging
& stop
EOF

# Restart rsyslog
systemctl restart rsyslog

# Install Consul agent for service discovery
echo -e "${YELLOW}Installing Consul agent...${NC}"
CONSUL_VERSION="1.16.1"
curl -Lo /tmp/consul.zip "https://releases.hashicorp.com/consul/${CONSUL_VERSION}/consul_${CONSUL_VERSION}_linux_amd64.zip"
unzip -o /tmp/consul.zip -d /usr/local/bin/
chmod +x /usr/local/bin/consul

# Create Consul configuration
mkdir -p /etc/consul.d
cat > /etc/consul.d/rtpengine.json << EOF
{
  "service": {
    "name": "rtpengine",
    "tags": ["media", "rtp", "srtp", "webrtc"],
    "address": "${INSTANCE_IP}",
    "port": 2223,
    "meta": {
      "external_ip": "${EXTERNAL_IP}",
      "version": "11.5.0"
    },
    "check": {
      "tcp": "localhost:2223",
      "interval": "10s",
      "timeout": "2s"
    }
  }
}
EOF

# Create Consul systemd service
cat > /etc/systemd/system/consul.service << EOF
[Unit]
Description=Consul
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/local/bin/consul agent -data-dir=/opt/consul -config-dir=/etc/consul.d -retry-join=${CONSUL_HOST}
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
echo -e "${YELLOW}Starting services...${NC}"
systemctl daemon-reload
systemctl enable consul
systemctl start consul
systemctl enable rtpengine
systemctl start rtpengine

# Configure kernel parameters for RTP
echo -e "${YELLOW}Configuring kernel parameters...${NC}"
cat >> /etc/sysctl.conf << 'EOF'

# RTPEngine optimizations
net.ipv4.ip_local_port_range = 1024 65535
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192
net.core.netdev_max_backlog = 5000
EOF

sysctl -p

# Setup log rotation
echo -e "${YELLOW}Setting up log rotation...${NC}"
cat > /etc/logrotate.d/rtpengine << 'EOF'
/var/log/rtpengine/*.log {
    daily
    rotate 7
    missingok
    notifempty
    compress
    delaycompress
    postrotate
        systemctl reload rtpengine >/dev/null 2>&1 || true
    endscript
}
EOF

# Install monitoring agent
echo -e "${YELLOW}Installing monitoring agent...${NC}"
# Add Google Cloud Ops agent installation here if needed

echo -e "${GREEN}RTPEngine setup completed!${NC}"
echo -e "${GREEN}Instance IP: ${INSTANCE_IP}${NC}"
echo -e "${GREEN}External IP: ${EXTERNAL_IP}${NC}"

# Check service status
systemctl status rtpengine --no-pager