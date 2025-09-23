#!/bin/bash
# Clean up ALL RTPEngine processes and start fresh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}=== RTPEngine Complete Cleanup ===${NC}\n"

# Show current RTPEngine processes
echo -e "${BLUE}Current RTPEngine processes:${NC}"
ps auxw | grep "[r]tpengine" || echo "No RTPEngine processes found"

# Stop systemd service
echo -e "\n${YELLOW}Stopping systemd service...${NC}"
sudo systemctl stop rtpengine 2>/dev/null || echo "Service not running"
sudo systemctl stop rtpengine-docker 2>/dev/null || echo "Docker service not running"

# Kill ALL rtpengine processes
echo -e "\n${YELLOW}Killing all RTPEngine processes...${NC}"
sudo pkill -9 -f rtpengine || echo "No processes to kill"
sleep 2

# Verify all processes are gone
echo -e "\n${YELLOW}Verifying cleanup...${NC}"
if pgrep -f rtpengine; then
    echo -e "${RED}Warning: Some processes still running!${NC}"
    sudo killall -9 rtpengine 2>/dev/null || true
else
    echo -e "${GREEN}✓ All RTPEngine processes terminated${NC}"
fi

# Clean up PID files
echo -e "\n${YELLOW}Cleaning up PID files...${NC}"
sudo rm -f /var/run/rtpengine/rtpengine.pid
sudo rm -f /run/rtpengine/rtpengine.pid
sudo rm -f /tmp/rtpengine.pid

# Clean up any Docker containers
echo -e "\n${YELLOW}Checking for Docker containers...${NC}"
if command -v docker &> /dev/null; then
    sudo docker ps -a | grep rtpengine && sudo docker rm -f $(sudo docker ps -a | grep rtpengine | awk '{print $1}') || echo "No Docker containers"
fi

# Remove old service files
echo -e "\n${YELLOW}Cleaning up old service files...${NC}"
sudo systemctl disable rtpengine-docker 2>/dev/null || true
sudo rm -f /etc/systemd/system/rtpengine-docker.service

# Show what's listening on relevant ports
echo -e "\n${YELLOW}Checking ports 2223, 22222, 22223:${NC}"
sudo ss -tuln | grep -E "(2223|22222|22223)" || echo "No listeners on RTPEngine ports"

# Create clean configuration
INTERNAL_IP=$(hostname -I | awk '{print $1}')
echo -e "\n${YELLOW}Creating clean configuration...${NC}"
sudo tee /etc/rtpengine/rtpengine.conf > /dev/null <<EOF
[rtpengine]
# Network interfaces
interface = ${INTERNAL_IP}
listen-ng = ${INTERNAL_IP}:22222
listen-cli = 127.0.0.1:22223

# RTP port range  
port-min = 30000
port-max = 40000

# Directories
recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

# Logging
log-level = 6
log-facility = daemon
log-stderr = no

# Timeouts
timeout = 60
silent-timeout = 3600
final-timeout = 10800

# Other settings
tos = 184
delete-delay = 30
num-threads = $(nproc)

# Disable kernel module (userspace mode)
table = -1

# Codecs
codec-accept-opus = yes
codec-accept-g722 = yes
codec-accept-g729 = yes
codec-accept-g723 = yes
codec-accept-amr = yes
codec-accept-amr-wb = yes
EOF

# Create clean systemd service
echo -e "\n${YELLOW}Creating clean systemd service...${NC}"
sudo tee /etc/systemd/system/rtpengine.service > /dev/null <<'EOF'
[Unit]
Description=RTPEngine media proxy
After=network.target
Requires=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --foreground
Restart=always
RestartSec=5
User=rtpengine
Group=rtpengine
LimitNOFILE=65535

RuntimeDirectory=rtpengine
RuntimeDirectoryMode=0755

StandardOutput=journal
StandardError=journal
SyslogIdentifier=rtpengine

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo -e "\n${YELLOW}Reloading systemd...${NC}"
sudo systemctl daemon-reload

# Final verification
echo -e "\n${BLUE}=== Cleanup Complete ===${NC}"
echo -e "${GREEN}✓ All old processes killed${NC}"
echo -e "${GREEN}✓ Configuration cleaned${NC}"
echo -e "${GREEN}✓ Service file updated${NC}"
echo ""
echo -e "${YELLOW}Ready to start fresh. Run:${NC}"
echo "  sudo systemctl start rtpengine"
echo "  sudo systemctl status rtpengine"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Control port: ${INTERNAL_IP}:22222"
echo "  CLI port: 127.0.0.1:22223"
echo "  RTP ports: 30000-40000"