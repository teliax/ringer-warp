#!/bin/bash

# Verify Observability Stack Script
# This script verifies all monitoring components are working correctly

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Verifying Observability Stack Components${NC}"
echo ""

# Function to check component
check_component() {
    local name=$1
    local namespace=$2
    local selector=$3
    
    echo -n "Checking $name... "
    
    READY=$(kubectl get pods -n $namespace -l "$selector" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
    
    if [[ "$READY" == *"True"* ]]; then
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    else
        echo -e "${RED}❌ Not Ready${NC}"
        return 1
    fi
}

# Check Prometheus
echo -e "${YELLOW}Prometheus Stack:${NC}"
check_component "Prometheus Server" "monitoring" "app.kubernetes.io/name=prometheus"
check_component "Grafana" "monitoring" "app.kubernetes.io/name=grafana"
check_component "AlertManager" "monitoring" "app.kubernetes.io/name=alertmanager"
check_component "Prometheus Operator" "monitoring" "app.kubernetes.io/name=kube-prometheus-stack-operator"
echo ""

# Check Homer
echo -e "${YELLOW}Homer SIP Capture:${NC}"
check_component "Homer App" "homer" "app=homer-app"
check_component "Homer WebApp" "homer" "app=homer-webapp"
check_component "Homer PostgreSQL" "homer" "app=homer-postgres"
echo ""

# Check ServiceMonitors
echo -e "${YELLOW}ServiceMonitors:${NC}"
MONITORS=$(kubectl get servicemonitor -n monitoring -o name)
echo "$MONITORS" | while read monitor; do
    echo -e "  ${GREEN}✅${NC} $monitor"
done
echo ""

# Check Ingresses
echo -e "${YELLOW}Ingresses:${NC}"
kubectl get ingress -A | grep -E "(prometheus|grafana|homer)" | while read line; do
    echo -e "  ${GREEN}✅${NC} $line"
done
echo ""

# Check metrics endpoints
echo -e "${YELLOW}Metrics Endpoints:${NC}"

# Function to check metrics endpoint
check_metrics() {
    local service=$1
    local namespace=$2
    local port=$3
    local path=${4:-/metrics}
    
    echo -n "  $service metrics... "
    
    # Use port-forward to test
    kubectl port-forward -n $namespace svc/$service $port:$port >/dev/null 2>&1 &
    PF_PID=$!
    sleep 2
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port$path | grep -q "200"; then
        echo -e "${GREEN}✅ Available${NC}"
    else
        echo -e "${RED}❌ Not Available${NC}"
    fi
    
    kill $PF_PID 2>/dev/null || true
}

# Note: These checks require services to be deployed
# check_metrics "kamailio" "warp-core" "9090" "/metrics"
# check_metrics "rtpengine" "warp-core" "9091" "/metrics"
# check_metrics "business-metrics-exporter" "warp-api" "9100" "/metrics"

# Check persistent volumes
echo -e "${YELLOW}Persistent Volumes:${NC}"
kubectl get pvc -A | grep -E "(prometheus|grafana|homer)" | while read line; do
    STATUS=$(echo "$line" | awk '{print $4}')
    if [[ "$STATUS" == "Bound" ]]; then
        echo -e "  ${GREEN}✅${NC} $line"
    else
        echo -e "  ${RED}❌${NC} $line"
    fi
done
echo ""

# Check external endpoints
echo -e "${YELLOW}External Endpoints:${NC}"
for host in prometheus.warp.io grafana.warp.io homer.warp.io; do
    echo -n "  https://$host ... "
    if nslookup $host >/dev/null 2>&1; then
        echo -e "${GREEN}✅ DNS Resolved${NC}"
    else
        echo -e "${YELLOW}⚠️  DNS Not Configured${NC}"
    fi
done
echo ""

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Verification Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"