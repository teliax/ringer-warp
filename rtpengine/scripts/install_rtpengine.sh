#!/bin/bash
# RTPEngine Installation Script for Debian/Ubuntu
# Supports installation from official repositories

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "RTPEngine Installation Script"
echo "========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   exit 1
fi

# Detect OS
if [ -f /etc/debian_version ]; then
    OS="debian"
    VERSION=$(cat /etc/debian_version)
    echo -e "${GREEN}Detected Debian/Ubuntu system${NC}"
else
    echo -e "${RED}This script only supports Debian/Ubuntu systems${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

echo -e "\n${YELLOW}Step 2: Installing dependencies...${NC}"
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
    libjson-glib-dev \
    libpcap-dev \
    libpcre3-dev \
    libssl-dev \
    libsystemd-dev \
    libxmlrpc-core-c3-dev \
    markdown \
    zlib1g-dev \
    libspandsp-dev \
    libwebsockets-dev \
    libopus-dev \
    libmosquitto-dev \
    libmariadb-dev \
    libiptc-dev \
    libmnl-dev \
    libevent-dev

echo -e "\n${YELLOW}Step 3: Adding Sipwise RTPEngine repository...${NC}"
# Add Sipwise repository for RTPEngine
echo "deb https://deb.sipwise.com/spce/mr11.5.1 bullseye main" > /etc/apt/sources.list.d/sipwise.list

# Add repository key
curl -fsSL https://deb.sipwise.com/spce/sipwise-keyring-bootstrap.gpg | apt-key add -

# Update package list
apt-get update

echo -e "\n${YELLOW}Step 4: Installing RTPEngine...${NC}"
apt-get install -y ngcp-rtpengine

# Alternative: Build from source
# echo -e "\n${YELLOW}Alternative: Building from source...${NC}"
# cd /usr/local/src
# git clone https://github.com/sipwise/rtpengine.git
# cd rtpengine
# make
# make install

echo -e "\n${YELLOW}Step 5: Creating RTPEngine user and directories...${NC}"
# Create rtpengine user if it doesn't exist
if ! id -u rtpengine >/dev/null 2>&1; then
    useradd -r -s /bin/false rtpengine
fi

# Create necessary directories
mkdir -p /etc/rtpengine
mkdir -p /var/run/rtpengine
mkdir -p /var/log/rtpengine
mkdir -p /var/spool/rtpengine

# Set permissions
chown -R rtpengine:rtpengine /var/run/rtpengine
chown -R rtpengine:rtpengine /var/log/rtpengine
chown -R rtpengine:rtpengine /var/spool/rtpengine

echo -e "\n${YELLOW}Step 6: Setting up kernel modules...${NC}"
# Load required kernel modules
modprobe xt_RTPENGINE || echo "xt_RTPENGINE module not available (OK for user-space mode)"

# Make it persistent
echo "xt_RTPENGINE" >> /etc/modules-load.d/rtpengine.conf || true

echo -e "\n${YELLOW}Step 7: Configuring sysctl parameters...${NC}"
# Optimize kernel parameters for RTP
cat > /etc/sysctl.d/99-rtpengine.conf <<EOF
# RTPEngine kernel optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192
net.core.netdev_max_backlog = 5000
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max = 65536
EOF

# Apply sysctl settings
sysctl -p /etc/sysctl.d/99-rtpengine.conf

echo -e "\n${YELLOW}Step 8: Setting up log rotation...${NC}"
cat > /etc/logrotate.d/rtpengine <<EOF
/var/log/rtpengine/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 rtpengine rtpengine
    sharedscripts
    postrotate
        /bin/kill -HUP \$(cat /var/run/rtpengine/rtpengine.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
EOF

echo -e "\n${GREEN}RTPEngine installation completed!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo "1. Copy configuration file: cp /path/to/rtpengine.conf /etc/rtpengine/"
echo "2. Start RTPEngine: systemctl start rtpengine"
echo "3. Enable auto-start: systemctl enable rtpengine"
echo "4. Check status: systemctl status rtpengine"