#!/bin/bash
# Configure RTPEngine after installation

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VM_NUMBER=$(hostname | grep -o '[0-9]*$' || echo "1")
INTERNAL_IP=$(hostname -I | awk '{print $1}')

echo -e "${YELLOW}Configuring RTPEngine on VM $VM_NUMBER...${NC}"

# Create directories if needed
sudo mkdir -p /etc/rtpengine /var/run/rtpengine /var/log/rtpengine /var/spool/rtpengine

# Create rtpengine user if not exists
sudo useradd -r -s /bin/false rtpengine 2>/dev/null || true

# Set permissions
sudo chown rtpengine:rtpengine /var/run/rtpengine /var/log/rtpengine /var/spool/rtpengine

# Create configuration
echo -e "${YELLOW}Creating configuration file...${NC}"
sudo tee /etc/rtpengine/rtpengine.conf > /dev/null <<EOF
[rtpengine]
interface = ${INTERNAL_IP}
listen-ng = 0.0.0.0:22222
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
final-timeout = 10800

tos = 184
num-threads = $(nproc)
delete-delay = 30

codec-accept-opus = yes
codec-accept-g722 = yes
codec-accept-g729 = yes
codec-accept-g723 = yes
codec-accept-amr = yes
codec-accept-amr-wb = yes
EOF

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
sudo tee /etc/systemd/system/rtpengine.service > /dev/null <<'EOF'
[Unit]
Description=RTPEngine media proxy
After=network.target syslog.target

[Service]
Type=forking
PIDFile=/var/run/rtpengine/rtpengine.pid
ExecStart=/usr/local/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --pidfile=/var/run/rtpengine/rtpengine.pid
ExecStop=/bin/kill -TERM $MAINPID
Restart=always
RestartSec=10
User=rtpengine
Group=rtpengine
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# Apply kernel optimizations
echo -e "${YELLOW}Applying kernel optimizations...${NC}"
sudo tee /etc/sysctl.d/99-rtpengine.conf > /dev/null <<EOF
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
sudo sysctl -p /etc/sysctl.d/99-rtpengine.conf

# Start service
echo -e "${YELLOW}Starting RTPEngine service...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable rtpengine
sudo systemctl start rtpengine

sleep 3

echo -e "${GREEN}RTPEngine configuration complete!${NC}"
sudo systemctl status rtpengine --no-pager

echo -e "\n${BLUE}RTPEngine running on:${NC}"
echo -e "  VM: $VM_NUMBER"
echo -e "  IP: $INTERNAL_IP"
echo -e "  Control Port: 22222"
echo -e "  RTP Ports: 30000-40000"