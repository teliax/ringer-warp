#!/bin/bash
# RTPEngine Status Check Script
# This script checks the current state of RTPEngine on the VMs

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "RTPEngine Status Check Script"
echo "========================================="

# Function to check RTPEngine on a single host
check_rtpengine() {
    local HOST=$1
    echo -e "\n${YELLOW}Checking RTPEngine on ${HOST}...${NC}"
    
    # Check if RTPEngine is installed
    echo -n "RTPEngine installed: "
    if command -v rtpengine &> /dev/null; then
        echo -e "${GREEN}YES${NC}"
        rtpengine --version 2>/dev/null || echo "Version check failed"
    else
        echo -e "${RED}NO${NC}"
    fi
    
    # Check if service is running
    echo -n "RTPEngine service status: "
    if systemctl is-active --quiet rtpengine; then
        echo -e "${GREEN}RUNNING${NC}"
        systemctl status rtpengine --no-pager | head -n 5
    else
        echo -e "${RED}NOT RUNNING${NC}"
    fi
    
    # Check OS information
    echo -e "\nOS Information:"
    cat /etc/os-release | grep -E "^(NAME|VERSION)="
    
    # Check kernel version
    echo -e "\nKernel Version:"
    uname -r
    
    # Check network interfaces
    echo -e "\nNetwork Interfaces:"
    ip -4 addr show | grep -E "^[0-9]+:|inet "
    
    # Check firewall rules for RTP ports
    echo -e "\nFirewall Status (RTP ports):"
    if command -v iptables &> /dev/null; then
        sudo iptables -L -n | grep -E "(30000:40000|udp|RTP)" || echo "No RTP-specific rules found"
    fi
    
    # Check for existing config
    echo -e "\nConfiguration Files:"
    if [ -f /etc/rtpengine/rtpengine.conf ]; then
        echo "Found: /etc/rtpengine/rtpengine.conf"
        echo "Current configuration:"
        grep -v "^#" /etc/rtpengine/rtpengine.conf | grep -v "^$" | head -20
    else
        echo "No configuration file found at /etc/rtpengine/rtpengine.conf"
    fi
    
    # Check memory and CPU
    echo -e "\nSystem Resources:"
    free -h | grep -E "^Mem:"
    nproc
}

# Run the check
check_rtpengine "localhost"