#!/bin/bash
# Updated RTPEngine Installation Script - Builds from source
# Works on Debian 11+ and Ubuntu 20.04+

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "RTPEngine Installation from Source"
echo "========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   exit 1
fi

# Get VM info
VM_NUMBER=$(hostname | grep -o '[0-9]*$' || echo "1")
INTERNAL_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}Setting up RTPEngine on VM $VM_NUMBER${NC}"
echo -e "${BLUE}Internal IP: $INTERNAL_IP${NC}"

echo -e "\n${YELLOW}Step 1: Installing build dependencies...${NC}"
apt-get update
apt-get install -y \
    build-essential git curl wget \
    libavcodec-dev libavfilter-dev libavformat-dev libavutil-dev \
    libcurl4-gnutls-dev libglib2.0-dev libhiredis-dev \
    libjson-glib-dev libpcap-dev libpcre3-dev libssl-dev \
    libxmlrpc-core-c3-dev zlib1g-dev libsystemd-dev \
    libip4tc-dev libip6tc-dev libiptc-dev libxtables-dev \
    libmnl-dev libnftnl-dev libnftables-dev \
    libmariadb-dev default-libmysqlclient-dev \
    libspandsp-dev libopus-dev libwebsockets-dev \
    libevent-dev libpcap0.8-dev \
    ffmpeg

echo -e "\n${YELLOW}Step 2: Installing Perl dependencies...${NC}"
apt-get install -y \
    libbencode-perl libcrypt-rijndael-perl libdigest-crc-perl \
    libdigest-hmac-perl libio-socket-inet6-perl libjson-perl \
    libnet-interface-perl libsocket6-perl libsystemd-dev \
    libconfig-tiny-perl

echo -e "\n${YELLOW}Step 3: Cloning RTPEngine repository...${NC}"
cd /usr/local/src
if [ -d "rtpengine" ]; then
    echo "RTPEngine directory exists, updating..."
    cd rtpengine
    git fetch --all
    git reset --hard origin/master
else
    git clone https://github.com/sipwise/rtpengine.git
    cd rtpengine
fi

# Get the latest stable tag
LATEST_TAG=$(git describe --tags --abbrev=0)
echo -e "${BLUE}Using RTPEngine version: $LATEST_TAG${NC}"
git checkout $LATEST_TAG

echo -e "\n${YELLOW}Step 4: Building RTPEngine...${NC}"
# Build with optimizations for production
make clean || true
CFLAGS="-O3" make -j$(nproc)

echo -e "\n${YELLOW}Step 5: Installing RTPEngine...${NC}"
make install

echo -e "\n${YELLOW}Step 6: Creating RTPEngine user and directories...${NC}"
# Create rtpengine user if not exists
useradd -r -s /bin/false rtpengine 2>/dev/null || true

# Create directories
mkdir -p /etc/rtpengine
mkdir -p /var/run/rtpengine
mkdir -p /var/log/rtpengine
mkdir -p /var/spool/rtpengine
mkdir -p /proc/rtpengine

# Set permissions
chown rtpengine:rtpengine /var/run/rtpengine
chown rtpengine:rtpengine /var/log/rtpengine
chown rtpengine:rtpengine /var/spool/rtpengine

echo -e "\n${YELLOW}Step 7: Creating RTPEngine configuration...${NC}"
cat > /etc/rtpengine/rtpengine.conf <<EOF
[rtpengine]
# Network interfaces
interface = ${INTERNAL_IP}
listen-ng = 127.0.0.1:22222
listen-cli = 127.0.0.1:22223

# Port range for RTP
port-min = 30000
port-max = 40000

# Recording settings
recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

# Logging
log-level = 6
log-facility = local0
log-facility-cdr = local1
log-facility-rtcp = local1

# Timeouts
timeout = 60
silent-timeout = 3600
final-timeout = 10800

# TOS/QoS
tos = 184

# Threading
num-threads = $(nproc)

# Homer integration (optional)
# homer = 127.0.0.1:9060
# homer-protocol = udp
# homer-id = 2001

# Graphite metrics (optional)
# graphite = 127.0.0.1:2003
# graphite-interval = 60
# graphite-prefix = rtpengine-vm${VM_NUMBER}

# Security
delete-delay = 30

# Codecs
codec-accept-opus = yes
codec-accept-g722 = yes
codec-accept-g729 = yes
codec-accept-g723 = yes
codec-accept-amr = yes
codec-accept-amr-wb = yes
EOF

echo -e "\n${YELLOW}Step 8: Creating systemd service...${NC}"
cat > /etc/systemd/system/rtpengine.service <<'EOF'
[Unit]
Description=RTPEngine media proxy
After=network.target
After=syslog.target

[Service]
Type=forking
PIDFile=/var/run/rtpengine/rtpengine.pid
ExecStart=/usr/local/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --pidfile=/var/run/rtpengine/rtpengine.pid
ExecStop=/bin/kill -TERM $MAINPID
Restart=on-failure
RestartSec=10
User=rtpengine
Group=rtpengine
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

echo -e "\n${YELLOW}Step 9: Setting kernel parameters...${NC}"
# Kernel optimization for RTP
cat > /etc/sysctl.d/99-rtpengine.conf <<EOF
# RTPEngine kernel optimizations
net.core.rmem_max = 33554432
net.core.wmem_max = 33554432
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.core.netdev_max_backlog = 5000
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max = 100000
net.ipv4.ip_forward = 1
EOF

sysctl -p /etc/sysctl.d/99-rtpengine.conf

echo -e "\n${YELLOW}Step 10: Setting up firewall rules...${NC}"
# Configure firewall
iptables -A INPUT -p udp --dport 30000:40000 -j ACCEPT
iptables -A INPUT -p tcp --dport 22222 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p udp --dport 22222 -s 10.0.0.0/8 -j ACCEPT

# Save rules
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

echo -e "\n${YELLOW}Step 11: Setting up log rotation...${NC}"
cat > /etc/logrotate.d/rtpengine <<EOF
/var/log/rtpengine/*.log {
    daily
    rotate 14
    missingok
    compress
    delaycompress
    notifempty
    create 0644 rtpengine rtpengine
    sharedscripts
    postrotate
        systemctl reload rtpengine > /dev/null 2>&1 || true
    endscript
}
EOF

echo -e "\n${YELLOW}Step 12: Starting RTPEngine service...${NC}"
systemctl daemon-reload
systemctl enable rtpengine
systemctl start rtpengine

echo -e "\n${GREEN}Waiting for RTPEngine to start...${NC}"
sleep 5

echo -e "\n${YELLOW}Checking RTPEngine status...${NC}"
systemctl status rtpengine --no-pager

echo -e "\n${YELLOW}Testing RTPEngine control port...${NC}"
if command -v nc >/dev/null 2>&1; then
    echo "ping" | timeout 2 nc -u 127.0.0.1 22222 && echo -e "${GREEN}Control port is responding${NC}" || echo -e "${YELLOW}Control port test timeout (this might be normal)${NC}"
fi

echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}RTPEngine installation completed!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo -e "${BLUE}Version: $LATEST_TAG${NC}"
echo -e "${BLUE}Control: $INTERNAL_IP:22222${NC}"
echo -e "${BLUE}RTP Ports: 30000-40000${NC}"
echo -e "${BLUE}Config: /etc/rtpengine/rtpengine.conf${NC}"
echo -e "${BLUE}Logs: /var/log/rtpengine/${NC}"
echo ""
echo "Commands:"
echo "  systemctl status rtpengine    # Check status"
echo "  systemctl restart rtpengine   # Restart service"
echo "  journalctl -u rtpengine -f    # View logs"
echo "  rtpengine-ctl list totals     # Show statistics"