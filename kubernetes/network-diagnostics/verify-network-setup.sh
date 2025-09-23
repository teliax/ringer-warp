#!/bin/bash
# Verify complete network setup for GKE cluster

echo "=== GKE Network Setup Verification ==="
echo "Date: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
    fi
}

echo "1. Checking GKE Cluster Status:"
echo "--------------------------------"
kubectl cluster-info > /dev/null 2>&1
check_status $?
kubectl get nodes -o wide | grep -E "(NAME|Ready)"
echo ""

echo "2. Cloud SQL Connectivity Test:"
echo "--------------------------------"
echo -n "Testing connection to Cloud SQL (10.126.0.3:5432): "
kubectl run test-sql-verify --image=busybox --restart=Never --rm -i \
  --command -- timeout 3 nc -zv 10.126.0.3 5432 2>&1 | grep -q "open" 
check_status $?
echo ""

echo "3. LoadBalancer Services Status:"
echo "--------------------------------"
echo "Services with External IPs:"
kubectl get svc -A | grep LoadBalancer | grep -v "<pending>" | wc -l | xargs echo "Count:"
echo ""
echo "Service Details:"
kubectl get svc -A | grep -E "(NAMESPACE|LoadBalancer)" | grep -E "(kamailio|NAMESPACE)"
echo ""

echo "4. VPC Peering Status:"
echo "--------------------------------"
PEERING_STATUS=$(gcloud compute networks peerings list --network=warp-vpc --project=ringer-warp-v01 --format="value(state)" | grep ACTIVE | wc -l)
echo -n "Service Networking Peering: "
if [ $PEERING_STATUS -gt 0 ]; then
    echo -e "${GREEN}ACTIVE${NC}"
else
    echo -e "${RED}NOT ACTIVE${NC}"
fi
echo ""

echo "5. Firewall Rules Check:"
echo "--------------------------------"
echo "Rules allowing GKE traffic:"
gcloud compute firewall-rules list --filter="network:warp-vpc AND (sourceRanges:10.1.0.0/16 OR sourceRanges:10.0.0.0/24)" \
  --project=ringer-warp-v01 --format="table(name,sourceRanges,allowed[].ports)" | head -10
echo ""

echo "6. DNS Resolution Test:"
echo "--------------------------------"
kubectl run test-dns-verify --image=busybox --restart=Never --rm -i \
  --command -- sh -c "
    echo -n 'Kubernetes DNS: '
    nslookup kubernetes.default > /dev/null 2>&1 && echo 'OK' || echo 'FAIL'
    echo -n 'External DNS: '
    nslookup google.com > /dev/null 2>&1 && echo 'OK' || echo 'FAIL'
  " 2>/dev/null
echo ""

echo "7. Pod Health Status:"
echo "--------------------------------"
echo "Kamailio Pods:"
kubectl get pods -A | grep kamailio | grep -v "test-" | awk '{print $1"/"$2": "$4}'
echo ""

echo "8. Network Endpoints:"
echo "--------------------------------"
kubectl get endpoints -A | grep kamailio | head -10
echo ""

echo "=== Summary ==="
echo "---------------"
ISSUES=0

# Check for pending LoadBalancers
PENDING_LB=$(kubectl get svc -A | grep LoadBalancer | grep "<pending>" | wc -l)
if [ $PENDING_LB -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $PENDING_LB LoadBalancer services still pending${NC}"
    ISSUES=$((ISSUES + 1))
fi

# Check for CrashLooping pods
CRASH_PODS=$(kubectl get pods -A | grep kamailio | grep -E "(CrashLoop|Error)" | wc -l)
if [ $CRASH_PODS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $CRASH_PODS pods in error state${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ All network components are properly configured!${NC}"
else
    echo -e "${YELLOW}⚠ Found $ISSUES issues that need attention${NC}"
fi

echo ""
echo "External IPs for SIP services:"
echo "------------------------------"
kubectl get svc -A | grep -E "(kamailio-sip|EXTERNAL-IP)" | grep -v "<" | awk '{if(NF>4) print $2": "$5; else print $0}'