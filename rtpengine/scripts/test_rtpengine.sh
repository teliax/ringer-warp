#!/bin/bash
# Test RTPEngine functionality

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Testing RTPEngine on $(hostname)...${NC}\n"

# Test 1: Check if process is running
echo -e "${YELLOW}1. Process Check:${NC}"
if pgrep -x rtpengine > /dev/null; then
    echo -e "${GREEN}✓ RTPEngine process is running${NC}"
    ps aux | grep "[r]tpengine" | head -1
else
    echo -e "${RED}✗ RTPEngine process not found${NC}"
fi

# Test 2: Check control port
echo -e "\n${YELLOW}2. Control Port Test:${NC}"
if timeout 2 nc -u -z 127.0.0.1 22222 2>/dev/null; then
    echo -e "${GREEN}✓ Control port 22222 is open${NC}"
else
    echo -e "${RED}✗ Control port 22222 not responding${NC}"
fi

# Test 3: Send ping command
echo -e "\n${YELLOW}3. Ping Test:${NC}"
RESPONSE=$(echo -n "1 ping" | timeout 2 nc -u -w1 127.0.0.1 22222 2>/dev/null)
if [[ $RESPONSE == *"pong"* ]]; then
    echo -e "${GREEN}✓ RTPEngine responded: $RESPONSE${NC}"
else
    echo -e "${YELLOW}No pong response (this is sometimes normal)${NC}"
fi

# Test 4: Check RTPEngine version
echo -e "\n${YELLOW}4. Version Check:${NC}"
if command -v rtpengine &> /dev/null; then
    rtpengine --version 2>&1 | head -1
fi

# Test 5: Check listening ports
echo -e "\n${YELLOW}5. Listening Ports:${NC}"
sudo ss -tuln | grep -E ":(22222|22223)" | while read line; do
    echo "  $line"
done

# Test 6: Check firewall rules
echo -e "\n${YELLOW}6. Firewall Rules:${NC}"
sudo iptables -L INPUT -n | grep -E "(22222|30000:40000)" | while read line; do
    echo "  ✓ $line"
done

# Test 7: Memory and CPU usage
echo -e "\n${YELLOW}7. Resource Usage:${NC}"
PID=$(pgrep rtpengine)
if [ -n "$PID" ]; then
    ps -p $PID -o pid,vsz,rss,pcpu,comm | tail -1
fi

# Test 8: Check log file
echo -e "\n${YELLOW}8. Recent Log Entries:${NC}"
if [ -f /var/log/syslog ]; then
    sudo grep "rtpengine" /var/log/syslog | tail -3
elif journalctl -u rtpengine &> /dev/null; then
    sudo journalctl -u rtpengine -n 3 --no-pager
fi

echo -e "\n${GREEN}Test complete!${NC}"