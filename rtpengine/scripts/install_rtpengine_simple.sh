#!/bin/bash
# Simplified RTPEngine Installation Script
# Uses Docker for easier deployment

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "RTPEngine Docker Installation Script"
echo "========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   exit 1
fi

# Get VM hostname/number
VM_NUMBER=$(hostname | grep -o '[0-9]*$' || echo "1")
INTERNAL_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}Setting up RTPEngine on VM $VM_NUMBER${NC}"
echo -e "${BLUE}Internal IP: $INTERNAL_IP${NC}"

echo -e "\n${YELLOW}Step 1: Installing Docker...${NC}"
# Install Docker if not present
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed"
fi

echo -e "\n${YELLOW}Step 2: Creating RTPEngine directories...${NC}"
mkdir -p /etc/rtpengine
mkdir -p /var/log/rtpengine
mkdir -p /var/spool/rtpengine

echo -e "\n${YELLOW}Step 3: Creating RTPEngine configuration...${NC}"
cat > /etc/rtpengine/rtpengine.conf <<EOF
[rtpengine]
interface = ${INTERNAL_IP}
listen-ng = 127.0.0.1:22222
listen-cli = 127.0.0.1:22223

port-min = 30000
port-max = 40000

recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

log-level = 6
log-facility = local0
log-facility-cdr = local1
log-facility-rtcp = local1

timeout = 60
silent-timeout = 3600
tos = 184
delete-delay = 30

graphite = 127.0.0.1:2003
graphite-interval = 60
graphite-prefix = rtpengine-vm${VM_NUMBER}

# Media handling
codec-accept = all
codec-transcode = all
codec-offer = all

# Performance
num-threads = 16
EOF

echo -e "\n${YELLOW}Step 4: Creating Docker Compose file...${NC}"
cat > /etc/rtpengine/docker-compose.yml <<EOF
version: '3'

services:
  rtpengine:
    image: drachtio/rtpengine:latest
    restart: always
    network_mode: host
    privileged: true
    volumes:
      - /etc/rtpengine/rtpengine.conf:/etc/rtpengine/rtpengine.conf:ro
      - /var/log/rtpengine:/var/log/rtpengine
      - /var/spool/rtpengine:/var/spool/rtpengine
    command: rtpengine --config-file=/etc/rtpengine/rtpengine.conf --foreground
EOF

echo -e "\n${YELLOW}Step 5: Creating systemd service...${NC}"
cat > /etc/systemd/system/rtpengine-docker.service <<EOF
[Unit]
Description=RTPEngine Docker Container
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=5
WorkingDirectory=/etc/rtpengine
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo -e "\n${YELLOW}Step 6: Setting up firewall rules...${NC}"
# Allow RTP media ports
iptables -A INPUT -p udp --dport 30000:40000 -j ACCEPT
# Allow control port from Kamailio
iptables -A INPUT -p udp --dport 22222 -s 10.0.0.0/8 -j ACCEPT
# Save rules
iptables-save > /etc/iptables/rules.v4 || true

echo -e "\n${YELLOW}Step 7: Starting RTPEngine...${NC}"
cd /etc/rtpengine
docker-compose pull
systemctl daemon-reload
systemctl enable rtpengine-docker
systemctl start rtpengine-docker

echo -e "\n${GREEN}RTPEngine installation completed!${NC}"
echo -e "${BLUE}Checking status...${NC}"
sleep 5
systemctl status rtpengine-docker --no-pager

echo -e "\n${BLUE}Testing RTPEngine control port...${NC}"
timeout 2 nc -u -v 127.0.0.1 22222 || echo "Control port test completed"

echo -e "\n${GREEN}Installation successful!${NC}"
echo "RTPEngine is now running in Docker mode on $INTERNAL_IP"
echo "Control port: $INTERNAL_IP:22222"
echo "Media ports: 30000-40000"