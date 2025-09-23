#!/bin/bash
#
# System Optimization Script for RTPEngine
# Applies kernel and system optimizations for production use
#

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Backup existing sysctl configuration
backup_sysctl() {
    log_info "Backing up current sysctl configuration..."
    
    if [[ -f /etc/sysctl.conf ]]; then
        cp /etc/sysctl.conf "/etc/sysctl.conf.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    log_success "Sysctl configuration backed up"
}

# Apply kernel optimizations
apply_kernel_optimizations() {
    log_info "Applying kernel optimizations for RTPEngine..."
    
    cat > /etc/sysctl.d/99-rtpengine.conf << 'EOF'
# RTPEngine Kernel Optimizations

# Core Network Settings
# Increase network buffer sizes for better RTP performance
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 33554432
net.core.wmem_default = 33554432
net.core.netdev_max_backlog = 65536
net.core.optmem_max = 33554432

# Increase the maximum number of network connections
net.core.somaxconn = 65535

# Network device budget for packet processing
net.core.netdev_budget = 600
net.core.netdev_budget_usecs = 20000

# Enable busy polling for lower latency
net.core.busy_poll = 50
net.core.busy_read = 50

# IPv4 TCP Settings
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_base_mss = 1024
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_notsent_lowat = 16384

# UDP Memory Settings
net.ipv4.udp_rmem_min = 134217728
net.ipv4.udp_wmem_min = 134217728

# Enable TCP Fast Open
net.ipv4.tcp_fastopen = 3

# Connection tracking for NAT scenarios
net.netfilter.nf_conntrack_max = 1048576
net.netfilter.nf_conntrack_buckets = 262144
net.netfilter.nf_conntrack_tcp_timeout_established = 600
net.netfilter.nf_conntrack_udp_timeout = 30
net.netfilter.nf_conntrack_udp_timeout_stream = 180

# Disable connection tracking helpers
net.netfilter.nf_conntrack_helper = 0

# ARP Settings
net.ipv4.neigh.default.gc_thresh1 = 4096
net.ipv4.neigh.default.gc_thresh2 = 8192
net.ipv4.neigh.default.gc_thresh3 = 16384
net.ipv4.neigh.default.gc_stale_time = 120

# Enable IP forwarding
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1

# Disable IPv6 if not needed
# net.ipv6.conf.all.disable_ipv6 = 1
# net.ipv6.conf.default.disable_ipv6 = 1

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Enable SYN cookies for DDoS protection
net.ipv4.tcp_syncookies = 1

# Increase number of incoming connections
net.ipv4.tcp_max_syn_backlog = 8192

# Local port range
net.ipv4.ip_local_port_range = 1024 65535

# Enable timestamps for better RTT estimation
net.ipv4.tcp_timestamps = 1

# Enable window scaling
net.ipv4.tcp_window_scaling = 1

# Enable selective acknowledgments
net.ipv4.tcp_sack = 1

# Enable Forward RTO-Recovery
net.ipv4.tcp_frto = 2

# File System Settings
fs.file-max = 2097152
fs.nr_open = 2097152

# Virtual Memory Settings
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.overcommit_memory = 1

# Enable memory compaction
vm.compact_memory = 1
vm.compact_unevictable_allowed = 1

# Kernel Settings
kernel.pid_max = 4194304
kernel.threads-max = 600000

# Enable NUMA balancing for multi-socket systems
kernel.numa_balancing = 1

# Core dumps for debugging (disable in production if not needed)
kernel.core_uses_pid = 1
kernel.core_pattern = /var/crash/core-%e-%p-%t

# Security hardening
kernel.kptr_restrict = 1
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1

# Disable magic sysrq key
kernel.sysrq = 0
EOF
    
    # Apply the settings
    sysctl -p /etc/sysctl.d/99-rtpengine.conf
    
    log_success "Kernel optimizations applied"
}

# Configure system limits
configure_limits() {
    log_info "Configuring system limits..."
    
    # Add rtpengine user limits
    cat > /etc/security/limits.d/rtpengine.conf << 'EOF'
# Limits for rtpengine user
rtpengine    soft    nofile      1048576
rtpengine    hard    nofile      1048576
rtpengine    soft    nproc       32768
rtpengine    hard    nproc       32768
rtpengine    soft    memlock     unlimited
rtpengine    hard    memlock     unlimited
rtpengine    soft    rtprio      99
rtpengine    hard    rtprio      99
rtpengine    soft    nice        -20
rtpengine    hard    nice        -20
EOF
    
    # Add default limits for all users
    cat > /etc/security/limits.d/99-default.conf << 'EOF'
# Default limits
*    soft    nofile      65536
*    hard    nofile      65536
EOF
    
    log_success "System limits configured"
}

# Configure CPU governor for performance
configure_cpu_governor() {
    log_info "Configuring CPU governor..."
    
    # Check if cpufrequtils is installed
    if ! command -v cpufreq-set &> /dev/null; then
        apt-get install -y cpufrequtils
    fi
    
    # Set performance governor for all CPUs
    for cpu in /sys/devices/system/cpu/cpu[0-9]*; do
        cpu_num=$(basename "$cpu" | sed 's/cpu//')
        if [[ -f "$cpu/cpufreq/scaling_governor" ]]; then
            echo "performance" > "$cpu/cpufreq/scaling_governor"
            cpufreq-set -c "$cpu_num" -g performance 2>/dev/null || true
        fi
    done
    
    # Make it persistent
    cat > /etc/default/cpufrequtils << 'EOF'
GOVERNOR="performance"
EOF
    
    log_success "CPU governor set to performance mode"
}

# Disable unnecessary services
disable_unnecessary_services() {
    log_info "Disabling unnecessary services..."
    
    # List of services to consider disabling (customize based on your needs)
    services=(
        "bluetooth.service"
        "cups.service"
        "cups-browsed.service"
        "ModemManager.service"
        "thermald.service"
    )
    
    for service in "${services[@]}"; do
        if systemctl is-enabled "$service" &> /dev/null; then
            systemctl disable "$service" 2>/dev/null || true
            systemctl stop "$service" 2>/dev/null || true
            log_info "Disabled $service"
        fi
    done
    
    log_success "Unnecessary services disabled"
}

# Configure IRQ affinity for network interfaces
configure_irq_affinity() {
    log_info "Configuring IRQ affinity..."
    
    # Create IRQ balance configuration
    cat > /etc/default/irqbalance << 'EOF'
# IRQ Balance configuration for RTPEngine
ENABLED="1"
ONESHOT="0"
# Ban IRQs from CPU 0 to leave it for system tasks
IRQBALANCE_BANNED_CPUS="0"
# Use NUMA node hinting
IRQBALANCE_ARGS="--hintpolicy=subset"
EOF
    
    # Restart irqbalance
    systemctl restart irqbalance || true
    
    log_success "IRQ affinity configured"
}

# Configure huge pages
configure_hugepages() {
    log_info "Configuring huge pages..."
    
    # Calculate number of huge pages (2MB each)
    # Reserve 4GB for huge pages (adjust based on your system)
    HUGEPAGES=2048
    
    # Configure huge pages
    echo "$HUGEPAGES" > /proc/sys/vm/nr_hugepages
    
    # Make it persistent
    echo "vm.nr_hugepages = $HUGEPAGES" >> /etc/sysctl.d/99-rtpengine.conf
    
    # Create hugetlbfs mount point
    mkdir -p /mnt/huge
    
    # Add to fstab if not already present
    if ! grep -q hugetlbfs /etc/fstab; then
        echo "hugetlbfs /mnt/huge hugetlbfs defaults,pagesize=2M 0 0" >> /etc/fstab
        mount /mnt/huge
    fi
    
    log_success "Huge pages configured"
}

# Configure systemd optimizations
configure_systemd() {
    log_info "Configuring systemd optimizations..."
    
    # Increase systemd limits
    mkdir -p /etc/systemd/system.conf.d
    cat > /etc/systemd/system.conf.d/99-rtpengine.conf << 'EOF'
[Manager]
DefaultLimitNOFILE=1048576
DefaultLimitNPROC=32768
DefaultLimitCORE=infinity
DefaultTasksMax=infinity
EOF
    
    # Reload systemd configuration
    systemctl daemon-reload
    
    log_success "Systemd optimizations configured"
}

# Configure network interface optimizations
configure_network_interfaces() {
    log_info "Configuring network interface optimizations..."
    
    # Get primary network interface
    PRIMARY_IF=$(ip route | grep default | awk '{print $5}' | head -n1)
    
    if [[ -n "$PRIMARY_IF" ]]; then
        # Increase ring buffer sizes
        ethtool -G "$PRIMARY_IF" rx 4096 tx 4096 2>/dev/null || true
        
        # Enable offloading features
        ethtool -K "$PRIMARY_IF" rx on tx on sg on tso on gso on gro on lro on 2>/dev/null || true
        
        # Set interrupt coalescing
        ethtool -C "$PRIMARY_IF" adaptive-rx on adaptive-tx on rx-usecs 50 tx-usecs 50 2>/dev/null || true
        
        # Enable pause frames
        ethtool -A "$PRIMARY_IF" rx on tx on 2>/dev/null || true
        
        log_success "Network interface $PRIMARY_IF optimized"
    else
        log_warning "Could not detect primary network interface"
    fi
}

# Create performance monitoring script
create_monitoring_script() {
    log_info "Creating performance monitoring script..."
    
    cat > /usr/local/bin/rtpengine-monitor.sh << 'EOF'
#!/bin/bash
# RTPEngine Performance Monitor

echo "=== RTPEngine Performance Monitor ==="
echo "Time: $(date)"
echo

# Check RTPEngine status
echo "=== RTPEngine Status ==="
systemctl status rtpengine --no-pager | head -n 10
echo

# Show RTPEngine statistics
echo "=== RTPEngine Statistics ==="
timeout 2 echo "list totals" | nc -N 127.0.0.1 9900 2>/dev/null || echo "Could not connect to CLI"
echo

# CPU and Memory usage
echo "=== System Resources ==="
top -bn1 | grep -E "^(%Cpu|MiB Mem)" | head -n 2
echo
ps aux | grep -E "(rtpengine|PID)" | grep -v grep | head -n 5
echo

# Network statistics
echo "=== Network Statistics ==="
ss -s
echo

# Kernel module info
echo "=== Kernel Module ==="
lsmod | grep -E "(xt_RTPENGINE|Module)" | head -n 2
echo

# Connection tracking
echo "=== Connection Tracking ==="
conntrack -C 2>/dev/null || echo "conntrack not available"
echo

# System load
echo "=== System Load ==="
uptime
echo

# Disk usage for recordings
echo "=== Recording Storage ==="
df -h /var/spool/rtpengine
echo

# Recent log entries
echo "=== Recent Log Entries ==="
journalctl -u rtpengine --no-pager | tail -n 10
EOF
    
    chmod +x /usr/local/bin/rtpengine-monitor.sh
    
    log_success "Monitoring script created"
}

# Apply all optimizations
apply_all_optimizations() {
    log_info "Starting system optimization for RTPEngine..."
    
    check_root
    backup_sysctl
    
    # Apply optimizations
    apply_kernel_optimizations
    configure_limits
    configure_cpu_governor
    disable_unnecessary_services
    configure_irq_affinity
    configure_hugepages
    configure_systemd
    configure_network_interfaces
    create_monitoring_script
    
    log_success "All optimizations applied successfully!"
    log_warning "A system reboot is recommended to ensure all optimizations take effect"
    log_info "You can monitor performance with: /usr/local/bin/rtpengine-monitor.sh"
}

# Main
apply_all_optimizations