#!/bin/bash
# WARP Platform Quick Health Check
# Run this after deployment to verify all services are running

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏥 WARP Platform Health Check"
echo "============================="
echo ""

# Function to check service health
check_service() {
    local namespace=$1
    local service=$2
    local port=$3
    
    echo -n "Checking $service in $namespace... "
    
    # Check if pods are running
    PODS=$(kubectl get pods -n $namespace -l app=$service -o jsonpath='{.items[*].status.phase}' 2>/dev/null || echo "")
    
    if echo "$PODS" | grep -q "Running"; then
        echo -e "${GREEN}✓ Running${NC}"
        
        # Check service endpoint
        SVC_IP=$(kubectl get svc $service -n $namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        if [ -n "$SVC_IP" ]; then
            echo "  └─ External IP: $SVC_IP:$port"
        fi
    elif [ -z "$PODS" ]; then
        echo -e "${RED}✗ Not found${NC}"
    else
        echo -e "${YELLOW}⚠ Status: $PODS${NC}"
    fi
}

# Check GKE cluster connection
echo "1. Kubernetes Cluster"
echo "--------------------"
if kubectl cluster-info &>/dev/null; then
    echo -e "${GREEN}✓ Connected to cluster${NC}"
    NODES=$(kubectl get nodes -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}')
    NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
    echo "  └─ Nodes: $NODE_COUNT (Status: $NODES)"
else
    echo -e "${RED}✗ Cannot connect to cluster${NC}"
    exit 1
fi

echo ""
echo "2. Core Telecom Services"
echo "------------------------"
check_service "telecom" "kamailio" "5060"
check_service "messaging" "jasmin-smsc" "2775"
check_service "messaging" "rabbitmq" "5672"

echo ""
echo "3. Monitoring Stack"
echo "-------------------"
check_service "monitoring" "prometheus" "9090"
check_service "monitoring" "grafana" "3000"
check_service "homer" "homer-webapp" "80"
check_service "monitoring" "business-metrics-exporter" "8080"

echo ""
echo "4. Database Connectivity"
echo "------------------------"
# Check if we can access Cloud SQL through the proxy
PROXY_POD=$(kubectl get pods -n warp -l app=cloudsql-proxy -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -n "$PROXY_POD" ]; then
    echo -e "${GREEN}✓ Cloud SQL Proxy running${NC}"
else
    echo -e "${YELLOW}⚠ Cloud SQL Proxy not found${NC}"
fi

echo ""
echo "5. External Services"
echo "--------------------"
# Check RTPEngine connectivity (from terraform output)
echo -n "RTPEngine instances... "
if [ -d "warp/terraform/environments/dev" ]; then
    cd warp/terraform/environments/dev > /dev/null
    RTPENGINE_IPS=$(terraform output -json rtpengine_ips 2>/dev/null | jq -r '.[]' 2>/dev/null || echo "")
    cd - > /dev/null
    if [ -n "$RTPENGINE_IPS" ]; then
        echo -e "${GREEN}✓ Available${NC}"
        for ip in $RTPENGINE_IPS; do
            echo "  └─ $ip"
        done
    else
        echo -e "${YELLOW}⚠ Cannot retrieve IPs${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Terraform directory not found${NC}"
fi

echo ""
echo "6. Service Endpoints Summary"
echo "----------------------------"
echo "To access services locally, use port-forwarding:"
echo ""
echo "# Grafana Dashboard"
echo "kubectl port-forward -n monitoring svc/grafana 3000:3000"
echo ""
echo "# Prometheus"
echo "kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo ""
echo "# Homer SIP Capture"
echo "kubectl port-forward -n homer svc/homer-webapp 8080:80"
echo ""
echo "# RabbitMQ Management"
echo "kubectl port-forward -n messaging svc/rabbitmq 15672:15672"
echo ""

# Check for any pods in error state
echo "7. Pod Health Summary"
echo "---------------------"
ERROR_PODS=$(kubectl get pods --all-namespaces | grep -E "(Error|CrashLoopBackOff|Pending)" || true)
if [ -z "$ERROR_PODS" ]; then
    echo -e "${GREEN}✓ All pods healthy${NC}"
else
    echo -e "${RED}✗ Pods in error state:${NC}"
    echo "$ERROR_PODS"
fi

echo ""
echo "============================="
echo "Health check complete!"
echo ""

# Quick connectivity test command
echo "Test SIP connectivity:"
echo "sipsak -s sip:test@[KAMAILIO_IP]"
echo ""
echo "Test SMPP connectivity:"
echo "telnet [JASMIN_IP] 2775"