#!/bin/bash
# RTPEngine Manual Deployment Guide
# Execute these commands on each RTPEngine VM

set -e

# Configuration
RTPENGINE_VM1="34.123.38.31"
RTPENGINE_VM2="35.222.101.214"
RTPENGINE_VM3="35.225.65.80"
REDIS_HOST="10.0.0.100"
HOMER_HOST="10.0.0.200"

echo "========================================="
echo "RTPEngine Manual Deployment Commands"
echo "========================================="
echo ""
echo "Execute these commands on each RTPEngine VM:"
echo ""

cat << 'EOF'
# ============================================
# PART 1: System Preparation (Run as root)
# ============================================

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y \
    build-essential git curl libavcodec-dev libavformat-dev \
    libavutil-dev libcurl4-openssl-dev libglib2.0-dev \
    libhiredis-dev libjson-glib-dev libpcap-dev libpcre3-dev \
    libssl-dev libsystemd-dev libxmlrpc-core-c3-dev markdown \
    zlib1g-dev libspandsp-dev libwebsockets-dev libopus-dev \
    libmosquitto-dev libmariadb-dev libiptc-dev libmnl-dev \
    libevent-dev redis-tools

# ============================================
# PART 2: RTPEngine Installation
# ============================================

# Add Sipwise repository
echo "deb https://deb.sipwise.com/spce/mr11.5.1 bullseye main" > /etc/apt/sources.list.d/sipwise.list
curl -fsSL https://deb.sipwise.com/spce/sipwise-keyring-bootstrap.gpg | apt-key add -
apt-get update

# Install RTPEngine
apt-get install -y ngcp-rtpengine

# Create directories and user
useradd -r -s /bin/false rtpengine || true
mkdir -p /etc/rtpengine /var/run/rtpengine /var/log/rtpengine /var/spool/rtpengine
chown -R rtpengine:rtpengine /var/run/rtpengine /var/log/rtpengine /var/spool/rtpengine

# ============================================
# PART 3: Kernel Optimization
# ============================================

# Load kernel modules
modprobe xt_RTPENGINE || echo "xt_RTPENGINE module not available"
echo "xt_RTPENGINE" >> /etc/modules-load.d/rtpengine.conf || true

# Configure sysctl
cat > /etc/sysctl.d/99-rtpengine.conf <<SYSCTL_EOF
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192
net.core.netdev_max_backlog = 5000
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max = 65536
SYSCTL_EOF

sysctl -p /etc/sysctl.d/99-rtpengine.conf

# ============================================
# PART 4: SSL Certificate Generation
# ============================================

# Generate self-signed certificate for DTLS
openssl req -x509 -newkey rsa:2048 -keyout /etc/rtpengine/key.pem \
    -out /etc/rtpengine/cert.pem -days 365 -nodes \
    -subj '/CN=rtpengine.warp.com'
chown rtpengine:rtpengine /etc/rtpengine/*.pem
chmod 600 /etc/rtpengine/key.pem

# ============================================
# PART 5: Firewall Configuration
# ============================================

# Allow RTPEngine control ports
iptables -A INPUT -p udp --dport 22222 -j ACCEPT
iptables -A INPUT -p tcp --dport 22222 -j ACCEPT

# Allow RTP/RTCP port range
iptables -A INPUT -p udp --dport 30000:40000 -j ACCEPT

# Allow Prometheus metrics
iptables -A INPUT -p tcp --dport 9103 -j ACCEPT

# Save firewall rules (Debian/Ubuntu)
apt-get install -y iptables-persistent
netfilter-persistent save

# ============================================
# PART 6: Log Rotation Setup
# ============================================

cat > /etc/logrotate.d/rtpengine <<LOGROTATE_EOF
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
LOGROTATE_EOF

# ============================================
# PART 7: Test Redis Connectivity
# ============================================

echo "Testing Redis connectivity..."
redis-cli -h 10.0.0.100 -p 6379 ping || echo "Redis connection failed - check network/firewall"

EOF

echo ""
echo "========================================="
echo "VM-SPECIFIC CONFIGURATION FILES"
echo "========================================="
echo ""
echo "After running the above commands, copy the appropriate config file to each VM:"
echo ""
echo "For VM1 ($RTPENGINE_VM1):"
echo "  Copy: rtpengine/config/rtpengine-vm1.conf"
echo "  To:   /etc/rtpengine/rtpengine.conf"
echo ""
echo "For VM2 ($RTPENGINE_VM2):"
echo "  Copy: rtpengine/config/rtpengine-vm2.conf"
echo "  To:   /etc/rtpengine/rtpengine.conf"
echo ""
echo "For VM3 ($RTPENGINE_VM3):"
echo "  Copy: rtpengine/config/rtpengine-vm3.conf"
echo "  To:   /etc/rtpengine/rtpengine.conf"
echo ""

cat << 'EOF'
# ============================================
# PART 8: Systemd Service Setup
# ============================================

# Create systemd service file
cat > /etc/systemd/system/rtpengine.service <<SERVICE_EOF
[Unit]
Description=RTPEngine media proxy
After=network.target
After=redis.service
Wants=redis.service

[Service]
Type=forking
PIDFile=/var/run/rtpengine/rtpengine.pid
ExecStartPre=/bin/mkdir -p /var/run/rtpengine
ExecStartPre=/bin/chown rtpengine:rtpengine /var/run/rtpengine
ExecStart=/usr/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --pidfile=/var/run/rtpengine/rtpengine.pid
ExecReload=/bin/kill -HUP $MAINPID
ExecStop=/bin/kill -TERM $MAINPID
Restart=on-failure
RestartSec=5s
User=rtpengine
Group=rtpengine
LimitNOFILE=65535
LimitNPROC=65535

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Reload systemd and start service
systemctl daemon-reload
systemctl enable rtpengine
systemctl start rtpengine

# ============================================
# PART 9: Verification
# ============================================

# Check service status
systemctl status rtpengine

# Check if listening on control port
netstat -tlnup | grep 22222

# Test CLI access
rtpengine-ctl list

# Check logs
tail -f /var/log/rtpengine/rtpengine.log

EOF

echo ""
echo "========================================="
echo "KAMAILIO INTEGRATION"
echo "========================================="
echo ""
echo "Update your Kamailio configuration with the RTPEngine integration"
echo "from: rtpengine/config/kamailio-rtpengine.cfg"
echo ""
echo "Key configuration points:"
echo "1. Load rtpengine module"
echo "2. Configure rtpengine_sock for all three instances"
echo "3. Add RTPENGINE route block"
echo "4. Call route(RTPENGINE) in appropriate places"
echo "5. Restart Kamailio after configuration"
echo ""

echo "========================================="
echo "USEFUL COMMANDS"
echo "========================================="
echo ""
echo "# Service management:"
echo "systemctl status rtpengine"
echo "systemctl restart rtpengine"
echo "journalctl -u rtpengine -f"
echo ""
echo "# CLI commands:"
echo "rtpengine-ctl list                    # List active sessions"
echo "rtpengine-ctl statistics              # Show statistics"
echo "rtpengine-ctl sessions                # Detailed session info"
echo ""
echo "# Testing:"
echo "netstat -tlnup | grep rtpengine       # Check listening ports"
echo "tcpdump -i any -n port 30000:40000   # Monitor RTP traffic"
echo ""
echo "# Monitoring:"
echo "curl http://localhost:9103/metrics    # Prometheus metrics"
echo "