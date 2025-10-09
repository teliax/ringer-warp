#!/bin/bash
# Restart RTPEngine with correct configuration

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Fixing RTPEngine configuration and restarting...${NC}\n"

# First, kill the old process that's using wrong port
echo -e "${YELLOW}Stopping old RTPEngine process...${NC}"
sudo systemctl stop rtpengine || true
sudo pkill -f rtpengine || true
sleep 2

# Remove any stale PID files
sudo rm -f /var/run/rtpengine/rtpengine.pid
sudo rm -f /run/rtpengine/rtpengine.pid

# Fix the configuration - ensure correct port
INTERNAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${YELLOW}Creating correct configuration...${NC}"
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

# Update systemd service for simple mode
echo -e "${YELLOW}Updating systemd service...${NC}"
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

# Runtime directory
RuntimeDirectory=rtpengine
RuntimeDirectoryMode=0755

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload and start
echo -e "${YELLOW}Starting RTPEngine...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable rtpengine
sudo systemctl start rtpengine

# Wait for startup
echo -e "${YELLOW}Waiting for startup...${NC}"
sleep 5

# Check status
echo -e "\n${YELLOW}Service status:${NC}"
sudo systemctl status rtpengine --no-pager | head -20

# Check listening ports
echo -e "\n${YELLOW}Checking listening ports:${NC}"
sudo ss -uln | grep -E "(22222|22223)" || echo -e "${RED}Control ports not found!${NC}"

# Test control port
echo -e "\n${YELLOW}Testing control port:${NC}"
if echo -n "0 ping" | timeout 2 nc -u ${INTERNAL_IP} 22222 | grep -q "pong"; then
    echo -e "${GREEN}✓ RTPEngine is responding on port 22222!${NC}"
else
    echo -e "${YELLOW}Testing with direct connection...${NC}"
    echo -n "0 ping" | nc -u -w1 ${INTERNAL_IP} 22222 || echo "No response"
fi

# Show logs
echo -e "\n${YELLOW}Recent logs:${NC}"
sudo journalctl -u rtpengine -n 10 --no-pager | grep -v "PIDFile="

echo -e "\n${GREEN}RTPEngine restart complete!${NC}"
echo -e "Control endpoint: ${INTERNAL_IP}:22222"