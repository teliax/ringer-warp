#!/bin/bash

# Pre-deployment Checklist Script for Monitoring Stack
# This script verifies all prerequisites before deploying monitoring

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-ringer-472421}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-warp-gke-cluster}"
REGION="${GCP_REGION:-us-central1}"

echo -e "${BLUE}📋 Pre-deployment Checklist for Monitoring Stack${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check item
check_item() {
    local description=$1
    local command=$2
    local required=${3:-true}
    
    echo -n "Checking $description... "
    
    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        if [[ "$required" == "true" ]]; then
            echo -e "${RED}❌ FAIL${NC}"
            ((CHECKS_FAILED++))
        else
            echo -e "${YELLOW}⚠️  WARNING${NC}"
        fi
        return 1
    fi
}

echo -e "${YELLOW}1. Environment & Tools${NC}"
check_item "kubectl installed" "command -v kubectl"
check_item "helm installed" "command -v helm"
check_item "gcloud installed" "command -v gcloud"
check_item "htpasswd installed" "command -v htpasswd"
check_item "jq installed" "command -v jq"
check_item "openssl installed" "command -v openssl"

echo ""
echo -e "${YELLOW}2. GCP Configuration${NC}"
check_item "GCP project set" "gcloud config get-value project | grep -q $PROJECT_ID"
check_item "GCP authenticated" "gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q @"
check_item "Container registry access" "gcloud auth configure-docker us-central1-docker.pkg.dev 2>&1 | grep -q 'already configured'"

echo ""
echo -e "${YELLOW}3. Kubernetes Cluster${NC}"
check_item "kubectl context" "kubectl config current-context | grep -q $CLUSTER_NAME"
check_item "cluster accessible" "kubectl cluster-info"
check_item "nodes ready" "kubectl get nodes --no-headers | grep -c Ready | grep -qE '[3-9]|[1-9][0-9]+'"
check_item "ingress controller" "kubectl get deployment -n ingress-nginx ingress-nginx-controller" false

echo ""
echo -e "${YELLOW}4. Namespaces${NC}"
for ns in monitoring warp-core warp-api homer consul; do
    check_item "namespace $ns" "kubectl get namespace $ns" false
done

echo ""
echo -e "${YELLOW}5. Storage Classes${NC}"
check_item "standard-rwo storage class" "kubectl get storageclass standard-rwo"

echo ""
echo -e "${YELLOW}6. Required Files${NC}"
check_item "prometheus rules" "test -f /home/daldworth/repos/ringer-warp/warp/k8s/alerting/prometheus-rules.yaml"
check_item "monitoring scripts" "test -f /home/daldworth/repos/ringer-warp/warp/k8s/monitoring/deploy-prometheus.sh"
check_item "homer deploy script" "test -f /home/daldworth/repos/ringer-warp/warp/k8s/homer/deploy.sh"
check_item "grafana dashboards" "ls /home/daldworth/repos/ringer-warp/warp/k8s/grafana/*.json 2>/dev/null | grep -q json" false

echo ""
echo -e "${YELLOW}7. Network & DNS${NC}"
if kubectl get svc -n ingress-nginx ingress-nginx-controller &>/dev/null; then
    INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [[ -n "$INGRESS_IP" ]]; then
        echo -e "  ${GREEN}✅${NC} Ingress IP: $INGRESS_IP"
        echo -e "  ${YELLOW}📌${NC} Ensure DNS records point to this IP:"
        for subdomain in prometheus grafana homer alertmanager; do
            echo -e "     - $subdomain.warp.io → $INGRESS_IP"
        done
    else
        echo -e "  ${YELLOW}⚠️${NC} Ingress IP not yet assigned"
    fi
else
    echo -e "  ${YELLOW}⚠️${NC} Ingress controller not deployed"
fi

echo ""
echo -e "${YELLOW}8. Optional Components${NC}"
check_item "cert-manager" "kubectl get deployment -n cert-manager cert-manager" false
check_item "business metrics source" "test -d /home/daldworth/repos/ringer-warp/src/exporters/business-metrics" false

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "  Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "  Checks Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [[ $CHECKS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All required checks passed! Ready to deploy.${NC}"
    echo ""
    echo -e "${YELLOW}To deploy the monitoring stack:${NC}"
    echo "  ./deploy-monitoring-stack.sh"
    exit 0
else
    echo -e "${RED}❌ Some required checks failed. Please fix these issues before deploying.${NC}"
    echo ""
    echo -e "${YELLOW}Common fixes:${NC}"
    echo "  - Configure kubectl: gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID"
    echo "  - Install Helm: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    echo "  - Install htpasswd: sudo apt-get install apache2-utils"
    exit 1
fi