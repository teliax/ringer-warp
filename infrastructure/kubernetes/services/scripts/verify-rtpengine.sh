#!/bin/bash
# RTPEngine Verification Script
# Run this after deployment to verify everything is working correctly

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RTPENGINE_VMS=(
    "34.123.38.31"
    "35.222.101.214"
    "35.225.65.80"
)
KAMAILIO_HOST="your-kamailio-host"  # Update this
REDIS_HOST="10.0.0.100"

echo "========================================="
echo "RTPEngine Verification Script"
echo "========================================="

# Function to check a single RTPEngine instance
check_rtpengine_instance() {
    local VM_IP=$1
    local VM_INDEX=$2
    local ERRORS=0
    
    echo -e "\n${BLUE}Checking RTPEngine on VM${VM_INDEX} (${VM_IP})...${NC}"
    
    # 1. Check control port connectivity
    echo -n "1. Control port (22222) connectivity: "
    if nc -zv -w 2 ${VM_IP} 22222 &> /dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        ((ERRORS++))
    fi
    
    # 2. Check Prometheus metrics endpoint
    echo -n "2. Prometheus metrics (9103) endpoint: "
    if curl -s http://${VM_IP}:9103/metrics | grep -q "rtpengine_"; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        ((ERRORS++))
    fi
    
    # 3. Test RTPEngine control protocol
    echo -n "3. RTPEngine control protocol test: "
    # Send a ping command to RTPEngine
    RESPONSE=$(echo -n "d2:ope4:ping4:tags0:e" | nc -u -w 2 ${VM_IP} 22222 2>/dev/null || true)
    if [[ "$RESPONSE" == *"result"* ]]; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        ((ERRORS++))
    fi
    
    # 4. Check RTP port range accessibility (spot check)
    echo -n "4. RTP port range (testing 30000): "
    if nc -zu -w 1 ${VM_IP} 30000 &> /dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}WARN${NC} (may be normal if no active calls)"
    fi
    
    return $ERRORS
}

# Function to test Redis connectivity
check_redis() {
    echo -e "\n${BLUE}Checking Redis connectivity...${NC}"
    
    echo -n "Redis server ($REDIS_HOST:6379): "
    if redis-cli -h $REDIS_HOST -p 6379 ping | grep -q "PONG"; then
        echo -e "${GREEN}OK${NC}"
        
        # Check if RTPEngine keys exist
        echo -n "RTPEngine Redis keys: "
        KEY_COUNT=$(redis-cli -h $REDIS_HOST -p 6379 -n 1 keys 'rtpengine:*' | wc -l)
        if [ $KEY_COUNT -gt 0 ]; then
            echo -e "${GREEN}Found $KEY_COUNT keys${NC}"
        else
            echo -e "${YELLOW}No keys found (normal if no active calls)${NC}"
        fi
    else
        echo -e "${RED}FAILED${NC}"
    fi
}

# Function to test Kamailio integration
check_kamailio() {
    echo -e "\n${BLUE}Checking Kamailio integration...${NC}"
    
    # This would need to be run on the Kamailio server
    cat << 'KAMAILIO_TEST'
# Run these commands on your Kamailio server:

# 1. Check if rtpengine module is loaded
kamcmd core.modules | grep rtpengine

# 2. Check RTPEngine socket status
kamcmd rtpengine.show all

# 3. Test with a SIP OPTIONS ping through RTPEngine
# (This requires a test SIP client or sipp)

KAMAILIO_TEST
}

# Function to generate test call script
generate_test_call_script() {
    cat > /tmp/rtpengine-test-call.sh << 'EOF'
#!/bin/bash
# Test call script for RTPEngine
# This creates a simulated RTP session

# Create an offer
OFFER=$(cat << 'OFFER_END'
d3:sdp311:v=0
o=- 1545997027 1 IN IP4 198.51.100.1
s=tester
t=0 0
m=audio 30000 RTP/AVP 0 8 18
c=IN IP4 198.51.100.1
a=sendrecv
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:18 G729/8000
10:ICE-remove4:truee7:call-id16:test123456789016:from-tag8:tag123454:tags0:e
OFFER_END
)

echo "Sending offer to RTPEngine..."
echo -n "$OFFER" | nc -u -w 2 $1 22222

EOF
    chmod +x /tmp/rtpengine-test-call.sh
    echo -e "${GREEN}Generated test call script at: /tmp/rtpengine-test-call.sh${NC}"
}

# Function to check system resources
check_system_resources() {
    echo -e "\n${BLUE}System resource recommendations:${NC}"
    
    cat << 'RESOURCES'
Recommended system resources for RTPEngine:
- CPU: 4+ cores (16 threads configured)
- RAM: 8GB minimum, 16GB recommended
- Network: 1Gbps minimum
- Disk: 50GB for recordings (if enabled)

Current usage can be monitored via:
- Prometheus metrics at http://VM_IP:9103/metrics
- System commands: top, htop, iotop, iftop
- RTPEngine CLI: rtpengine-ctl statistics
RESOURCES
}

# Main verification process
echo -e "\n${YELLOW}Starting RTPEngine verification...${NC}"

TOTAL_ERRORS=0

# Check each RTPEngine instance
for i in "${!RTPENGINE_VMS[@]}"; do
    VM_INDEX=$((i + 1))
    check_rtpengine_instance "${RTPENGINE_VMS[$i]}" "$VM_INDEX"
    TOTAL_ERRORS=$((TOTAL_ERRORS + $?))
done

# Check Redis
check_redis

# Show Kamailio test instructions
check_kamailio

# Generate test call script
generate_test_call_script

# Show resource recommendations
check_system_resources

# Summary
echo -e "\n${BLUE}=========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}=========================================${NC}"

if [ $TOTAL_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All basic checks passed!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Run the Kamailio integration tests"
    echo "2. Perform a test call through the system"
    echo "3. Monitor logs during the test call:"
    echo "   - RTPEngine: journalctl -u rtpengine -f"
    echo "   - Kamailio: tail -f /var/log/kamailio/kamailio.log"
    echo "4. Check Prometheus metrics for performance data"
    echo "5. Set up Grafana dashboards for monitoring"
else
    echo -e "${RED}✗ Found $TOTAL_ERRORS errors during verification${NC}"
    echo -e "\n${YELLOW}Troubleshooting steps:${NC}"
    echo "1. Check service status: systemctl status rtpengine"
    echo "2. Review logs: journalctl -u rtpengine -n 100"
    echo "3. Verify firewall rules: iptables -L -n"
    echo "4. Check configuration: cat /etc/rtpengine/rtpengine.conf"
    echo "5. Test network connectivity between components"
fi

echo -e "\n${BLUE}Monitoring commands:${NC}"
echo "- Real-time stats: watch -n 1 'rtpengine-ctl statistics'"
echo "- Active sessions: rtpengine-ctl list"
echo "- Network traffic: tcpdump -i any -n portrange 30000-40000"
echo "- Process info: ps aux | grep rtpengine"