#!/bin/bash
# Check RTPEngine logs for configuration issues

YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}Checking RTPEngine logs and configuration...${NC}\n"

# Get RTPEngine PID
PID=$(pgrep rtpengine)
if [ -n "$PID" ]; then
    echo -e "${GREEN}RTPEngine is running with PID: $PID${NC}"
else
    echo -e "${RED}RTPEngine is not running${NC}"
    exit 1
fi

# Check what command line was actually used
echo -e "\n${BLUE}Command line used:${NC}"
cat /proc/$PID/cmdline | tr '\0' ' ' && echo

# Check environment
echo -e "\n${BLUE}Environment variables:${NC}"
sudo cat /proc/$PID/environ | tr '\0' '\n' | grep -E "(RTPENGINE|CONFIG)" || echo "No relevant env vars"

# Check actual logs from syslog
echo -e "\n${BLUE}RTPEngine startup logs from syslog:${NC}"
sudo grep -i rtpengine /var/log/syslog | grep -E "(config|listen|bind|port|error)" | tail -20

# Check if there's a different config being used
echo -e "\n${BLUE}Checking for other config files:${NC}"
sudo find /etc -name "rtpengine*" -type f 2>/dev/null

# Check the actual binary
echo -e "\n${BLUE}RTPEngine binary location:${NC}"
which rtpengine
ls -la $(which rtpengine)

# Try to get RTPEngine to show its config
echo -e "\n${BLUE}Testing direct command:${NC}"
sudo timeout 2 /usr/local/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --print-config 2>&1 | head -20 || true

# Check if port 2223 is actually RTPEngine
echo -e "\n${BLUE}What's listening on port 2223:${NC}"
sudo lsof -i :2223 2>/dev/null || sudo ss -ulnp | grep 2223

# Check systemd service file
echo -e "\n${BLUE}Current systemd service:${NC}"
sudo cat /etc/systemd/system/rtpengine.service | grep -v "^#" | grep -v "^$"