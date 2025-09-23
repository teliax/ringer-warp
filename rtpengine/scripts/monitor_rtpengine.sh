#!/bin/bash
# RTPEngine Monitoring Script
# Provides real-time monitoring of RTPEngine instances

set -e

# Configuration
RTPENGINE_VMS=(
    "34.123.38.31"
    "35.222.101.214"
    "35.225.65.80"
)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check RTPEngine status
check_rtpengine() {
    local HOST=$1
    local PORT=${2:-22222}
    
    # Use rtpengine-ctl or netcat to check
    if command -v rtpengine-ctl &> /dev/null; then
        rtpengine-ctl -h $HOST:$PORT list totals 2>/dev/null
    else
        echo "ping" | nc -u -w1 $HOST $PORT 2>/dev/null
    fi
}

# Function to get Prometheus metrics
get_metrics() {
    local HOST=$1
    curl -s http://$HOST:9103/metrics 2>/dev/null | grep -E "^rtpengine_"
}

# Main monitoring loop
while true; do
    clear
    echo "========================================="
    echo "RTPEngine Real-Time Monitor"
    echo "Time: $(date)"
    echo "========================================="
    
    for vm in "${RTPENGINE_VMS[@]}"; do
        echo -e "\n${YELLOW}VM: $vm${NC}"
        echo "-----------------------------------"
        
        # Check if RTPEngine is responding
        echo -n "Status: "
        if check_rtpengine $vm > /dev/null 2>&1; then
            echo -e "${GREEN}ONLINE${NC}"
            
            # Get statistics
            if command -v rtpengine-ctl &> /dev/null; then
                echo -e "\n${BLUE}Statistics:${NC}"
                rtpengine-ctl -h $vm:22222 list totals 2>/dev/null | head -20
            fi
            
            # Get key metrics
            echo -e "\n${BLUE}Key Metrics:${NC}"
            metrics=$(get_metrics $vm)
            if [ ! -z "$metrics" ]; then
                echo "$metrics" | grep -E "(sessions|streams|packets|bytes)" | head -10
            else
                echo "Metrics endpoint not available"
            fi
        else
            echo -e "${RED}OFFLINE${NC}"
        fi
    done
    
    echo -e "\n${YELLOW}Press Ctrl+C to exit${NC}"
    sleep 5
done