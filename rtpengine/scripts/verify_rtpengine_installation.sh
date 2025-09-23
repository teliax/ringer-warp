#!/bin/bash
# Verify RTPEngine installation and clean up old artifacts

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}=== RTPEngine Installation Verification ===${NC}\n"

# Find all RTPEngine binaries
echo -e "${BLUE}1. Looking for RTPEngine binaries:${NC}"
echo "System-wide search:"
sudo find / -name "rtpengine" -type f 2>/dev/null | grep -v "/proc" | head -20

echo -e "\n${BLUE}2. Check installed packages:${NC}"
dpkg -l | grep -i rtpengine || echo "No RTPEngine packages found via dpkg"

echo -e "\n${BLUE}3. Check current binary:${NC}"
which_rtpengine=$(which rtpengine 2>/dev/null || echo "not found")
echo "which rtpengine: $which_rtpengine"
if [ -f "/usr/local/bin/rtpengine" ]; then
    echo "/usr/local/bin/rtpengine exists:"
    ls -la /usr/local/bin/rtpengine
    echo "Version:"
    /usr/local/bin/rtpengine --version 2>&1 | head -5 || true
fi

echo -e "\n${BLUE}4. Check for other RTPEngine installations:${NC}"
# Check common locations
for path in /usr/bin/rtpengine /usr/sbin/rtpengine /opt/rtpengine/bin/rtpengine; do
    if [ -f "$path" ]; then
        echo "Found: $path"
        ls -la "$path"
        $path --version 2>&1 | head -1 || true
    fi
done

echo -e "\n${BLUE}5. Check systemd service files:${NC}"
echo "Active service file:"
if [ -f /etc/systemd/system/rtpengine.service ]; then
    echo "/etc/systemd/system/rtpengine.service:"
    grep "ExecStart" /etc/systemd/system/rtpengine.service
fi

echo -e "\nOther service files:"
sudo find /etc/systemd /lib/systemd -name "*rtpengine*.service" -type f 2>/dev/null

echo -e "\n${BLUE}6. Check configuration files:${NC}"
sudo find /etc -name "*rtpengine*" -type f 2>/dev/null | grep -v ".service"

echo -e "\n${BLUE}7. Check for Docker images:${NC}"
if command -v docker &> /dev/null; then
    sudo docker images | grep -i rtpengine || echo "No RTPEngine Docker images"
fi

echo -e "\n${BLUE}8. Check current processes (should be none):${NC}"
ps auxw | grep "[r]tpengine" || echo "No RTPEngine processes running"

echo -e "\n${BLUE}9. Check what's in /usr/local/src:${NC}"
if [ -d /usr/local/src/rtpengine ]; then
    echo "Source directory exists:"
    cd /usr/local/src/rtpengine
    git status | head -5
    git log --oneline -1
fi

echo -e "\n${YELLOW}=== Summary ===${NC}"
echo "Primary binary: /usr/local/bin/rtpengine (built from source)"
echo "Config file: /etc/rtpengine/rtpengine.conf"
echo "Service file: /etc/systemd/system/rtpengine.service"

# Ask for cleanup confirmation
echo -e "\n${YELLOW}Do you want to remove old/duplicate RTPEngine installations?${NC}"
echo "This will keep only /usr/local/bin/rtpengine (v14.0.0.0)"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}Cleaning up old installations...${NC}"
    
    # Remove package-installed versions
    sudo apt-get remove --purge ngcp-rtpengine rtpengine 2>/dev/null || true
    
    # Remove other binaries (keeping /usr/local/bin)
    sudo rm -f /usr/bin/rtpengine /usr/sbin/rtpengine /opt/rtpengine/bin/rtpengine
    
    # Remove old service files
    sudo rm -f /lib/systemd/system/ngcp-rtpengine-daemon.service
    sudo rm -f /etc/init.d/ngcp-rtpengine-daemon
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
else
    echo "Skipping cleanup"
fi