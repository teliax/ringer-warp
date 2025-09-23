#!/bin/bash

# LoadBalancer Status Check Script
# Purpose: Quick check of current LoadBalancer status before cleanup
# Date: 2025-09-23

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo "LoadBalancer Status Check"
echo "Date: $(date)"
echo "================================================"

# Check all LoadBalancers
echo -e "\n${BLUE}All LoadBalancer Services:${NC}"
kubectl get svc --all-namespaces -o wide | grep -E "(NAMESPACE|LoadBalancer)" | awk '{printf "%-20s %-25s %-12s %-15s %-15s\n", $1, $2, $3, $5, $6}'

# Check for duplicates
echo -e "\n${YELLOW}Checking for Duplicate Kamailio Services:${NC}"
echo "Primary (keep):"
kubectl get svc -n ringer-warp-v01 | grep -E "(NAME|kamailio)" || echo "  Not found in ringer-warp-v01"

echo -e "\nDuplicates (remove):"
kubectl get svc -n warp-core 2>/dev/null | grep -E "(NAME|kamailio)" || echo "  No duplicates found in warp-core"

# Check for monitoring LoadBalancers
echo -e "\n${YELLOW}Checking for Monitoring LoadBalancers (should use Ingress):${NC}"
monitoring_count=$(kubectl get svc --all-namespaces | grep LoadBalancer | grep -cE "(prometheus|grafana|alertmanager|loki)" || echo 0)
if [ "$monitoring_count" -gt 0 ]; then
    kubectl get svc --all-namespaces | grep LoadBalancer | grep -E "(prometheus|grafana|alertmanager|loki)"
else
    echo -e "${GREEN}✓ No monitoring LoadBalancers found (correct - they should use Ingress)${NC}"
fi

# Check for API gateway LoadBalancers
echo -e "\n${YELLOW}Checking for API Gateway LoadBalancers:${NC}"
api_count=$(kubectl get svc --all-namespaces | grep -i "api-gateway" | grep -c LoadBalancer || echo 0)
if [ "$api_count" -gt 0 ]; then
    kubectl get svc --all-namespaces | grep -i "api-gateway" | grep LoadBalancer
else
    echo -e "${GREEN}✓ No API gateway LoadBalancers found${NC}"
fi

# Summary
echo -e "\n${BLUE}Summary:${NC}"
total_lb=$(kubectl get svc --all-namespaces | grep -c LoadBalancer || echo 0)
echo "Total LoadBalancers: $total_lb"

echo -e "\n${GREEN}Expected to keep (3):${NC}"
echo "  1. ingress-nginx/ingress-nginx-controller"
echo "  2. ringer-warp-v01/kamailio-sip-tcp"
echo "  3. ringer-warp-v01/kamailio-sip-udp"

to_remove=$((total_lb - 3))
if [ $to_remove -lt 0 ]; then
    to_remove=0
fi

echo -e "\n${RED}Expected to remove: $to_remove${NC}"
echo "Potential monthly savings: ~\$$(($to_remove * 30))"

# Check ingress routes
echo -e "\n${BLUE}Current Ingress Routes (using NGINX):${NC}"
kubectl get ingress --all-namespaces | head -10

echo -e "\n================================================"
echo "Run './cleanup-loadbalancers.sh --dry-run' to see what would be deleted"
echo "Run './cleanup-loadbalancers.sh' to perform actual cleanup"
echo "================================================"