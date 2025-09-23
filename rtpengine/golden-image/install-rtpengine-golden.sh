#!/bin/bash
#
# RTPEngine mr13.4.1 Installation Script
# Clean, reproducible installation for Debian 11/Ubuntu 20.04+
#

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation configuration
RTPENGINE_VERSION="mr13.4.1"
RTPENGINE_REPO="https://github.com/sipwise/rtpengine.git"
INSTALL_PREFIX="/usr/local"
BUILD_DIR="/tmp/rtpengine-build"
CPU_CORES=$(nproc)

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

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        log_error "Cannot detect OS"
        exit 1
    fi
    
    log_info "Detected OS: $OS $VER"
}

# Install build dependencies
install_dependencies() {
    log_info "Installing build dependencies..."
    
    # Update package lists
    apt-get update
    
    # Essential build tools
    apt-get install -y \
        build-essential \
        git \
        cmake \
        automake \
        autoconf \
        libtool \
        pkg-config \
        ca-certificates \
        curl \
        wget
    
    # Development libraries
    apt-get install -y \
        libglib2.0-dev \
        libssl-dev \
        libpcre3-dev \
        libxmlrpc-core-c3-dev \
        libhiredis-dev \
        libevent-dev \
        libjson-glib-dev \
        libcurl4-openssl-dev \
        libpcap-dev \
        libncurses5-dev \
        libiptc-dev \
        libmnl-dev \
        libnftnl-dev \
        libsystemd-dev \
        libwebsockets-dev \
        libmariadb-dev \
        libpq-dev \
        libsqlite3-dev \
        libavcodec-dev \
        libavformat-dev \
        libavutil-dev \
        libswresample-dev \
        libavfilter-dev \
        libspandsp-dev \
        libopus-dev \
        libsrtp2-dev \
        libbcg729-dev \
        zlib1g-dev
    
    # Kernel module dependencies
    apt-get install -y \
        linux-headers-$(uname -r) \
        dkms
    
    # Additional tools
    apt-get install -y \
        iptables \
        netcat-openbsd \
        htop \
        sysstat \
        net-tools
    
    log_success "Dependencies installed"
}

# Clone and prepare source
prepare_source() {
    log_info "Cloning RTPEngine source..."
    
    # Clean up any existing build directory
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    
    # Clone specific version
    git clone --depth 1 --branch "$RTPENGINE_VERSION" "$RTPENGINE_REPO" rtpengine
    cd rtpengine
    
    # Initialize submodules
    git submodule update --init --recursive
    
    log_success "Source prepared"
}

# Build kernel module
build_kernel_module() {
    log_info "Building kernel module..."
    
    cd "$BUILD_DIR/rtpengine/kernel-module"
    
    # Build kernel module
    make -j"$CPU_CORES"
    
    # Install kernel module
    make install
    
    # Load the module
    modprobe xt_RTPENGINE
    
    # Ensure module loads on boot
    echo "xt_RTPENGINE" >> /etc/modules-load.d/rtpengine.conf
    
    log_success "Kernel module built and loaded"
}

# Build RTPEngine daemon
build_daemon() {
    log_info "Building RTPEngine daemon..."
    
    cd "$BUILD_DIR/rtpengine/daemon"
    
    # Configure build
    make -j"$CPU_CORES" \
        with_transcoding=yes \
        with_iptables_option=yes
    
    # Install daemon
    make install DESTDIR="" PREFIX="$INSTALL_PREFIX"
    
    log_success "RTPEngine daemon built and installed"
}

# Build CLI tools
build_cli_tools() {
    log_info "Building CLI tools..."
    
    # rtpengine-ctl
    cd "$BUILD_DIR/rtpengine/utils/rtpengine-ctl"
    make
    cp rtpengine-ctl "$INSTALL_PREFIX/bin/"
    chmod +x "$INSTALL_PREFIX/bin/rtpengine-ctl"
    
    # rtpengine-recording
    cd "$BUILD_DIR/rtpengine/recording-daemon"
    make -j"$CPU_CORES"
    make install DESTDIR="" PREFIX="$INSTALL_PREFIX"
    
    log_success "CLI tools built and installed"
}

# Create user and directories
setup_user_and_directories() {
    log_info "Setting up user and directories..."
    
    # Create rtpengine user
    if ! id -u rtpengine >/dev/null 2>&1; then
        useradd -r -s /bin/false rtpengine
    fi
    
    # Create directories
    mkdir -p /etc/rtpengine
    mkdir -p /var/run/rtpengine
    mkdir -p /var/spool/rtpengine
    mkdir -p /var/log/rtpengine
    mkdir -p /var/lib/rtpengine
    
    # Set permissions
    chown -R rtpengine:rtpengine /var/run/rtpengine
    chown -R rtpengine:rtpengine /var/spool/rtpengine
    chown -R rtpengine:rtpengine /var/log/rtpengine
    chown -R rtpengine:rtpengine /var/lib/rtpengine
    
    log_success "User and directories created"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/rtpengine.service << 'EOF'
[Unit]
Description=RTPEngine media proxy daemon
Documentation=https://github.com/sipwise/rtpengine
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
PIDFile=/var/run/rtpengine/rtpengine.pid
RuntimeDirectory=rtpengine
User=rtpengine
Group=rtpengine
ExecStartPre=/sbin/modprobe xt_RTPENGINE
ExecStartPre=/bin/mkdir -p /var/run/rtpengine
ExecStartPre=/bin/chown rtpengine:rtpengine /var/run/rtpengine
ExecStart=/usr/local/bin/rtpengine \
    --config-file /etc/rtpengine/rtpengine.conf \
    --pidfile /var/run/rtpengine/rtpengine.pid
ExecReload=/bin/kill -HUP $MAINPID
ExecStop=/bin/kill -TERM $MAINPID
TimeoutSec=10
Restart=on-failure
RestartSec=5
LimitNOFILE=65536
LimitNPROC=8192
LimitCORE=infinity

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/run/rtpengine /var/spool/rtpengine /var/log/rtpengine /var/lib/rtpengine
ProtectKernelTunables=true
ProtectKernelModules=false
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK
RestrictNamespaces=true
RestrictSUIDSGID=true
RemoveIPC=true

[Install]
WantedBy=multi-user.target
EOF
    
    # Create recording service
    cat > /etc/systemd/system/rtpengine-recording.service << 'EOF'
[Unit]
Description=RTPEngine recording daemon
Documentation=https://github.com/sipwise/rtpengine
After=network-online.target rtpengine.service
Wants=network-online.target

[Service]
Type=simple
User=rtpengine
Group=rtpengine
ExecStart=/usr/local/bin/rtpengine-recording \
    --config-section recording \
    --config-file /etc/rtpengine/rtpengine.conf
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    systemctl daemon-reload
    
    log_success "Systemd services created"
}

# Create default configuration
create_default_config() {
    log_info "Creating default configuration..."
    
    # Copy the template if it doesn't exist
    if [[ ! -f /etc/rtpengine/rtpengine.conf ]]; then
        cp rtpengine.conf.template /etc/rtpengine/rtpengine.conf
        chown rtpengine:rtpengine /etc/rtpengine/rtpengine.conf
        chmod 640 /etc/rtpengine/rtpengine.conf
    fi
    
    log_success "Default configuration created"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check if binary exists
    if [[ ! -f "$INSTALL_PREFIX/bin/rtpengine" ]]; then
        log_error "RTPEngine binary not found"
        return 1
    fi
    
    # Check version
    "$INSTALL_PREFIX/bin/rtpengine" --version
    
    # Check kernel module
    if lsmod | grep -q xt_RTPENGINE; then
        log_success "Kernel module loaded"
    else
        log_error "Kernel module not loaded"
        return 1
    fi
    
    # Check systemd service
    if systemctl list-unit-files | grep -q rtpengine.service; then
        log_success "Systemd service installed"
    else
        log_error "Systemd service not found"
        return 1
    fi
    
    log_success "Installation verified"
}

# Cleanup build directory
cleanup() {
    log_info "Cleaning up build directory..."
    rm -rf "$BUILD_DIR"
    log_success "Cleanup complete"
}

# Main installation function
main() {
    log_info "Starting RTPEngine $RTPENGINE_VERSION installation"
    
    check_root
    detect_os
    
    # Install dependencies
    install_dependencies
    
    # Build and install
    prepare_source
    build_kernel_module
    build_daemon
    build_cli_tools
    
    # Setup system
    setup_user_and_directories
    create_systemd_service
    create_default_config
    
    # Verify and cleanup
    verify_installation
    cleanup
    
    log_success "RTPEngine $RTPENGINE_VERSION installation complete!"
    log_info "Next steps:"
    log_info "  1. Review and edit /etc/rtpengine/rtpengine.conf"
    log_info "  2. Run ./optimize-system.sh for kernel optimizations"
    log_info "  3. Start RTPEngine: systemctl start rtpengine"
    log_info "  4. Test with: ./test-rtpengine.sh"
}

# Run main function
main "$@"