#!/bin/bash
# Debug RTPEngine issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}RTPEngine Debug Information${NC}\n"

# Check current configuration
echo -e "${BLUE}1. Current Configuration:${NC}"
if [ -f /etc/rtpengine/rtpengine.conf ]; then
    echo "Configuration file exists at /etc/rtpengine/rtpengine.conf"
    echo "Key settings:"
    grep -E "^(interface|listen-ng|listen-cli|port-min|port-max)" /etc/rtpengine/rtpengine.conf || echo "No key settings found"
else
    echo -e "${RED}Configuration file missing!${NC}"
fi

# Check what ports RTPEngine is actually listening on
echo -e "\n${BLUE}2. Actual Listening Ports:${NC}"
sudo ss -tuln | grep -E "rtpengine|22222|22223" || echo "No RTPEngine ports found"
echo -e "\nAll UDP ports:"
sudo ss -uln | grep -v "127.0.0.53" | head -10

# Check process details
echo -e "\n${BLUE}3. Process Command Line:${NC}"
ps aux | grep "[r]tpengine" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}'

# Check for errors in logs
echo -e "\n${BLUE}4. Recent Error Messages:${NC}"
sudo journalctl -u rtpengine -n 20 --no-pager | grep -E "(error|fail|warn|critical)" || echo "No errors in recent logs"

# Check full recent logs
echo -e "\n${BLUE}5. Last 10 Log Lines:${NC}"
sudo journalctl -u rtpengine -n 10 --no-pager

# Try to restart with foreground mode to see errors
echo -e "\n${BLUE}6. Testing Configuration:${NC}"
echo "Checking if configuration file is valid..."
sudo /usr/local/bin/rtpengine --config-file=/etc/rtpengine/rtpengine.conf --foreground --log-level=7 &
TEST_PID=$!
sleep 2
if kill -0 $TEST_PID 2>/dev/null; then
    echo -e "${GREEN}Configuration appears valid${NC}"
    sudo kill $TEST_PID
else
    echo -e "${RED}Configuration test failed${NC}"
fi

# Check if old PID file exists
echo -e "\n${BLUE}7. PID File Status:${NC}"
if [ -f /var/run/rtpengine/rtpengine.pid ]; then
    echo "PID file exists: $(cat /var/run/rtpengine/rtpengine.pid)"
    if [ -d /proc/$(cat /var/run/rtpengine/rtpengine.pid) ]; then
        echo -e "${GREEN}Process is running${NC}"
    else
        echo -e "${RED}Stale PID file - process not running${NC}"
    fi
else
    echo "No PID file found"
fi