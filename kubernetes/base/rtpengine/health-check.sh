#!/bin/bash

# RTPEngine Health Check Script
# This script verifies RTPEngine instances are healthy and properly configured

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# RTPEngine instances
INSTANCES=(
    "34.123.38.31"
    "35.222.101.214"
    "35.225.65.80"
)

# Redis configuration
REDIS_HOST="10.206.200.36"
REDIS_PORT="6379"

echo -e "${GREEN}=== RTPEngine Health Check ===${NC}"
echo ""

# Function to check RTPEngine control port
check_control_port() {
    local IP=$1
    echo -n "Checking control port on ${IP}... "
    
    # Send ping command to RTPEngine
    RESPONSE=$(echo -n "d3:ping" | timeout 2 nc -u ${IP} 2223 2>/dev/null)
    
    if [[ "$RESPONSE" == *"pong"* ]]; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Function to check Prometheus metrics
check_metrics_endpoint() {
    local IP=$1
    echo -n "Checking metrics endpoint on ${IP}... "
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://${IP}:9101/metrics)
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        echo -e "${GREEN}✓ OK${NC}"
        
        # Get some basic metrics
        SESSIONS=$(curl -s http://${IP}:9101/metrics | grep "^rtpengine_sessions_total" | awk '{print $2}' | head -1)
        echo "  Active sessions: ${SESSIONS:-0}"
        return 0
    else
        echo -e "${RED}✗ FAILED (HTTP ${HTTP_CODE})${NC}"
        return 1
    fi
}

# Function to check Redis connectivity from script location
check_redis() {
    echo -n "Checking Redis connectivity... "
    
    if command -v redis-cli &> /dev/null; then
        REDIS_RESPONSE=$(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping 2>/dev/null)
        
        if [[ "$REDIS_RESPONSE" == "PONG" ]]; then
            echo -e "${GREEN}✓ OK${NC}"
            
            # Check Redis memory usage
            REDIS_INFO=$(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
            echo "  Redis memory usage: ${REDIS_INFO}"
            return 0
        else
            echo -e "${RED}✗ FAILED${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ redis-cli not installed${NC}"
        return 2
    fi
}

# Function to check Consul service registration
check_consul_registration() {
    local IP=$1
    echo -n "Checking Consul registration for ${IP}... "
    
    if command -v consul &> /dev/null; then
        SERVICE_COUNT=$(consul catalog services | grep -c rtpengine 2>/dev/null)
        
        if [[ "$SERVICE_COUNT" -gt 0 ]]; then
            echo -e "${GREEN}✓ Registered${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Not found in Consul${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ consul not installed${NC}"
        return 2
    fi
}

# Function to test RTP port connectivity
check_rtp_ports() {
    local IP=$1
    echo -n "Checking RTP port range on ${IP}... "
    
    # Test a sample port from the RTP range
    timeout 1 bash -c "echo >/dev/tcp/${IP}/30000" 2>/dev/null
    
    if [[ $? -eq 0 ]] || [[ $? -eq 1 ]]; then
        # Connection refused (1) is OK - means port is reachable but no service
        # Timeout (124) means firewall is blocking
        echo -e "${GREEN}✓ Reachable${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ May be blocked by firewall${NC}"
        return 1
    fi
}

# Main health check loop
TOTAL_CHECKS=0
PASSED_CHECKS=0

echo -e "${YELLOW}Checking Redis backend...${NC}"
check_redis && ((PASSED_CHECKS++))
((TOTAL_CHECKS++))

echo ""

for IP in "${INSTANCES[@]}"; do
    echo -e "${YELLOW}Checking RTPEngine instance: ${IP}${NC}"
    
    check_control_port ${IP} && ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
    
    check_metrics_endpoint ${IP} && ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
    
    check_consul_registration ${IP} && ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
    
    check_rtp_ports ${IP} && ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
    
    echo ""
done

# Summary
echo -e "${GREEN}=== Health Check Summary ===${NC}"
echo "Total checks: ${TOTAL_CHECKS}"
echo "Passed: ${PASSED_CHECKS}"
echo "Failed: $((TOTAL_CHECKS - PASSED_CHECKS))"

if [[ ${PASSED_CHECKS} -eq ${TOTAL_CHECKS} ]]; then
    echo -e "${GREEN}✓ All health checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some health checks failed!${NC}"
    exit 1
fi