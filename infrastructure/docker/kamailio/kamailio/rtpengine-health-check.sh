#!/bin/bash

# RTPEngine Health Check Script
# This script verifies RTPEngine is running correctly on all VMs

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="ringer-warp-v01"
REDIS_HOST="10.206.200.36"
REDIS_PORT="6379"

# VM details
declare -A VMS
VMS[warp-rtpengine-1]="34.123.38.31"
VMS[warp-rtpengine-2]="35.222.101.214"
VMS[warp-rtpengine-3]="35.225.65.80"

echo -e "${BLUE}=== RTPEngine Health Check ===${NC}"
echo -e "${BLUE}Checking RTPEngine status on all VMs...${NC}\n"

# Function to get instance info
get_instance_info() {
    local IP=$1
    local INFO=$(gcloud compute instances list --project=${PROJECT_ID} --filter="EXTERNAL_IP=${IP}" --format="value(name,zone)")
    echo "${INFO}"
}

# Function to check a single VM
check_vm_health() {
    local VM_NAME=$1
    local EXTERNAL_IP=$2
    
    echo -e "${YELLOW}=== Checking ${VM_NAME} (${EXTERNAL_IP}) ===${NC}"
    
    # Get instance name and zone
    local INSTANCE_INFO=$(get_instance_info ${EXTERNAL_IP})
    local INSTANCE_NAME=$(echo "${INSTANCE_INFO}" | awk '{print $1}')
    local INSTANCE_ZONE=$(echo "${INSTANCE_INFO}" | awk '{print $2}')
    
    if [ -z "${INSTANCE_NAME}" ]; then
        echo -e "${RED}✗ Could not find instance with IP ${EXTERNAL_IP}${NC}"
        return 1
    fi
    
    # Check RTPEngine service status
    echo -n "  Service Status: "
    if gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="sudo systemctl is-active rtpengine" 2>/dev/null | grep -q "active"; then
        echo -e "${GREEN}✓ Running${NC}"
    else
        echo -e "${RED}✗ Not Running${NC}"
        return 1
    fi
    
    # Check RTPEngine control port
    echo -n "  Control Port (2223): "
    if gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="sudo netstat -tuln | grep -q :2223" 2>/dev/null; then
        echo -e "${GREEN}✓ Listening${NC}"
    else
        echo -e "${RED}✗ Not Listening${NC}"
    fi
    
    # Check metrics port
    echo -n "  Metrics Port (9101): "
    if gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="sudo netstat -tuln | grep -q :9101" 2>/dev/null; then
        echo -e "${GREEN}✓ Listening${NC}"
    else
        echo -e "${RED}✗ Not Listening${NC}"
    fi
    
    # Get internal IP
    echo -n "  Internal IP: "
    local INTERNAL_IP=$(gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip" 2>/dev/null)
    echo -e "${BLUE}${INTERNAL_IP}${NC}"
    
    # Check Redis connectivity
    echo -n "  Redis Connectivity: "
    if gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="timeout 2 redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping 2>/dev/null | grep -q PONG" 2>/dev/null; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${YELLOW}⚠ Could not verify (redis-cli may not be installed)${NC}"
    fi
    
    # Get RTPEngine version
    echo -n "  RTPEngine Version: "
    local VERSION=$(gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="sudo /usr/local/bin/rtpengine --version 2>&1 | head -1" 2>/dev/null || echo "Unknown")
    echo -e "${BLUE}${VERSION}${NC}"
    
    # Check kernel module
    echo -n "  Kernel Module: "
    if gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="lsmod | grep -q xt_RTPENGINE" 2>/dev/null; then
        echo -e "${GREEN}✓ Loaded${NC}"
    else
        echo -e "${YELLOW}⚠ Not Loaded${NC}"
    fi
    
    # Get active sessions count
    echo -n "  Active Sessions: "
    local SESSIONS=$(gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="curl -s http://localhost:9101/metrics 2>/dev/null | grep 'rtpengine_sessions_total' | grep -v '#' | awk '{print \$2}'" 2>/dev/null || echo "0")
    echo -e "${BLUE}${SESSIONS}${NC}"
    
    echo
}

# Function to test RTPEngine control protocol
test_rtpengine_control() {
    local VM_NAME=$1
    local EXTERNAL_IP=$2
    
    echo -e "${YELLOW}Testing RTPEngine control protocol on ${VM_NAME}...${NC}"
    
    # Get instance info
    local INSTANCE_INFO=$(get_instance_info ${EXTERNAL_IP})
    local INSTANCE_NAME=$(echo "${INSTANCE_INFO}" | awk '{print $1}')
    local INSTANCE_ZONE=$(echo "${INSTANCE_INFO}" | awk '{print $2}')
    
    # Create a simple ping test
    cat > /tmp/rtpengine-ping.sh << 'EOF'
#!/bin/bash
# Test RTPEngine ng control protocol
echo -n "1 ping" | nc -u -w1 localhost 2223
EOF
    
    # Copy and execute test
    gcloud compute scp \
        /tmp/rtpengine-ping.sh \
        ${INSTANCE_NAME}:/tmp/rtpengine-ping.sh \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --quiet
    
    local RESPONSE=$(gcloud compute ssh ${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --zone=${INSTANCE_ZONE} \
        --command="chmod +x /tmp/rtpengine-ping.sh && /tmp/rtpengine-ping.sh" 2>/dev/null || echo "No response")
    
    echo -n "  Control Protocol Response: "
    if [[ "${RESPONSE}" =~ "pong" ]]; then
        echo -e "${GREEN}✓ Working${NC}"
    else
        echo -e "${RED}✗ Not responding${NC}"
    fi
    
    rm -f /tmp/rtpengine-ping.sh
}

# Main health check loop
TOTAL_HEALTHY=0
TOTAL_VMS=${#VMS[@]}

for VM_NAME in "${!VMS[@]}"; do
    if check_vm_health ${VM_NAME} ${VMS[${VM_NAME}]}; then
        ((TOTAL_HEALTHY++))
        test_rtpengine_control ${VM_NAME} ${VMS[${VM_NAME}]}
    fi
    echo
done

# Summary
echo -e "${BLUE}=== Health Check Summary ===${NC}"
echo -e "Total VMs: ${TOTAL_VMS}"
echo -e "Healthy VMs: ${TOTAL_HEALTHY}"

if [ ${TOTAL_HEALTHY} -eq ${TOTAL_VMS} ]; then
    echo -e "\n${GREEN}✓ All RTPEngine instances are healthy!${NC}"
else
    echo -e "\n${RED}✗ Some RTPEngine instances need attention${NC}"
    exit 1
fi

# Check Redis connectivity from local
echo -e "\n${BLUE}=== Checking Redis from local ===${NC}"
if command -v redis-cli &> /dev/null; then
    echo -n "Redis Ping: "
    if timeout 2 redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping 2>/dev/null | grep -q PONG; then
        echo -e "${GREEN}✓ Connected${NC}"
        
        # Check for RTPEngine keys in Redis
        echo -n "RTPEngine Keys in Redis: "
        local KEY_COUNT=$(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} --scan --pattern "rtpengine:*" 2>/dev/null | wc -l)
        echo -e "${BLUE}${KEY_COUNT}${NC}"
    else
        echo -e "${RED}✗ Could not connect to Redis${NC}"
    fi
else
    echo -e "${YELLOW}⚠ redis-cli not installed locally${NC}"
fi