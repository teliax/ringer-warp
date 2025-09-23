#!/bin/bash
# Fix RTPEngine service configuration

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}Fixing RTPEngine service...${NC}"

# Stop current service
echo "Stopping current RTPEngine..."
sudo systemctl stop rtpengine || true

# Remove stale PID file if exists
sudo rm -f /var/run/rtpengine/rtpengine.pid

# Update systemd service to remove --foreground flag conflict
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

[Install]
WantedBy=multi-user.target
EOF

# Ensure proper config format
INTERNAL_IP=$(hostname -I | awk '{print $1}')
sudo tee /etc/rtpengine/rtpengine.conf > /dev/null <<EOF
[rtpengine]
# Interfaces - bind to all for control port
interface = ${INTERNAL_IP}
listen-ng = 0.0.0.0:22222
listen-cli = 127.0.0.1:22223

# RTP port range
port-min = 30000
port-max = 40000

# Directories
recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = raw

# Logging
log-level = 7
log-facility = daemon
log-facility-cdr = local1
log-facility-rtcp = local1

# Timeouts
timeout = 60
silent-timeout = 3600
final-timeout = 10800

# Other settings
tos = 184
delete-delay = 30
num-threads = $(nproc)

# Codecs
codec-accept-opus = yes
codec-accept-g722 = yes
codec-accept-g729 = yes
codec-accept-g723 = yes
codec-accept-amr = yes
codec-accept-amr-wb = yes
EOF

# Reload systemd and start service
echo -e "${YELLOW}Restarting service...${NC}"
sudo systemctl daemon-reload
sudo systemctl start rtpengine
sleep 3

# Check status
echo -e "\n${YELLOW}Checking status...${NC}"
sudo systemctl status rtpengine --no-pager

# Test control port
echo -e "\n${YELLOW}Testing control port...${NC}"
if timeout 2 nc -u -z 0.0.0.0 22222 2>/dev/null; then
    echo -e "${GREEN}✓ Control port 22222 is now open${NC}"
else
    echo "Checking with netstat..."
    sudo netstat -uln | grep 22222 || echo "Port 22222 not found"
fi

echo -e "\n${GREEN}Service reconfigured!${NC}"