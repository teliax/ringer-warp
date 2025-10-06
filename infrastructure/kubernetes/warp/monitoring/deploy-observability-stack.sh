#!/bin/bash

# Complete Observability Stack Deployment Script
# This script deploys the entire monitoring stack for Warp

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_ID="ringer-472421"
CLUSTER_NAME="warp-gke-cluster"
REGION="us-central1"

echo -e "${GREEN}🚀 Deploying Complete Observability Stack${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if kubectl is configured
    if ! kubectl cluster-info &>/dev/null; then
        echo -e "${RED}❌ Error: kubectl is not configured or cluster is not accessible${NC}"
        echo "Please run: gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID"
        exit 1
    fi
    
    # Check if Helm is installed
    if ! command -v helm &> /dev/null; then
        echo -e "${RED}❌ Error: Helm is not installed${NC}"
        echo "Please install Helm: https://helm.sh/docs/intro/install/"
        exit 1
    fi
    
    # Check if htpasswd is installed
    if ! command -v htpasswd &> /dev/null; then
        echo -e "${YELLOW}⚠️  Warning: htpasswd not found, installing...${NC}"
        sudo apt-get update && sudo apt-get install -y apache2-utils
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to wait for cluster readiness
wait_for_cluster() {
    echo -e "${YELLOW}Waiting for GKE cluster to be ready...${NC}"
    
    # Check if nodes are ready
    while true; do
        READY_NODES=$(kubectl get nodes --no-headers | grep -c "Ready" || true)
        if [[ $READY_NODES -ge 3 ]]; then
            echo -e "${GREEN}✅ Cluster has $READY_NODES ready nodes${NC}"
            break
        fi
        echo "Waiting for nodes to be ready (currently $READY_NODES)..."
        sleep 10
    done
    
    # Check if essential namespaces exist
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace warp-core --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace warp-api --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace homer --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace consul --dry-run=client -o yaml | kubectl apply -f -
}

# Function to deploy Prometheus
deploy_prometheus() {
    echo -e "${YELLOW}Deploying Prometheus monitoring stack...${NC}"
    
    # Execute Prometheus deployment script
    bash /home/daldworth/repos/ringer-warp/warp/k8s/monitoring/deploy-prometheus.sh
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Prometheus deployed successfully${NC}"
    else
        echo -e "${RED}❌ Prometheus deployment failed${NC}"
        return 1
    fi
}

# Function to deploy Homer
deploy_homer() {
    echo -e "${YELLOW}Deploying Homer SIP capture...${NC}"
    
    # Execute Homer deployment script
    bash /home/daldworth/repos/ringer-warp/warp/k8s/homer/deploy.sh
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Homer deployed successfully${NC}"
    else
        echo -e "${RED}❌ Homer deployment failed${NC}"
        return 1
    fi
}

# Function to deploy business metrics exporter
deploy_business_metrics() {
    echo -e "${YELLOW}Deploying business metrics exporter...${NC}"
    
    # Build and push the exporter image
    echo "Building business metrics exporter image..."
    cd /home/daldworth/repos/ringer-warp/src/exporters/business-metrics
    
    # Configure Docker for GCR
    gcloud auth configure-docker us-central1-docker.pkg.dev
    
    # Build and push image
    docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/warp-core/business-metrics-exporter:latest .
    docker push us-central1-docker.pkg.dev/$PROJECT_ID/warp-core/business-metrics-exporter:latest
    
    # Deploy to Kubernetes
    kubectl apply -f /home/daldworth/repos/ringer-warp/warp/k8s/monitoring/business-metrics-exporter.yaml
    
    echo -e "${GREEN}✅ Business metrics exporter deployed${NC}"
    cd -
}

# Function to apply alerting rules
deploy_alerting() {
    echo -e "${YELLOW}Configuring alerting rules...${NC}"
    
    kubectl apply -f /home/daldworth/repos/ringer-warp/warp/k8s/alerting/prometheus-rules.yaml
    
    echo -e "${GREEN}✅ Alerting rules configured${NC}"
}

# Function to import Grafana dashboards
import_dashboards() {
    echo -e "${YELLOW}Importing Grafana dashboards...${NC}"
    
    # Wait for Grafana to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n monitoring --timeout=300s
    
    # Import dashboards
    bash /home/daldworth/repos/ringer-warp/warp/k8s/grafana/import-dashboards.sh
    
    echo -e "${GREEN}✅ Dashboards imported successfully${NC}"
}

# Function to verify Consul
verify_consul() {
    echo -e "${YELLOW}Verifying Consul service mesh...${NC}"
    
    # Check if Consul is deployed via Terraform
    if gcloud compute instances list --project=$PROJECT_ID --filter="name:consul-server" --format="value(name)" | grep -q consul; then
        echo -e "${GREEN}✅ Consul servers found in GCE${NC}"
        
        # Get Consul server IPs
        CONSUL_IPS=$(gcloud compute instances list --project=$PROJECT_ID --filter="name:consul-server" --format="value(networkInterfaces[0].networkIP)")
        echo "Consul server IPs: $CONSUL_IPS"
    else
        echo -e "${YELLOW}⚠️  Consul servers not found, they should be deployed via Terraform${NC}"
    fi
}

# Function to display access information
display_access_info() {
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Observability Stack Deployment Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📊 Monitoring Access Information:${NC}"
    echo ""
    
    # Get Prometheus password
    PROM_PASS=$(kubectl get secret prometheus-auth -n monitoring -o jsonpath='{.data.auth}' | base64 -d | cut -d: -f2)
    echo "Prometheus: https://prometheus.warp.io"
    echo "  Username: admin"
    echo "  Password: $PROM_PASS"
    echo ""
    
    # Get Grafana password
    GRAFANA_PASS=$(kubectl get secret --namespace monitoring prometheus-operator-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
    echo "Grafana: https://grafana.warp.io"
    echo "  Username: admin"
    echo "  Password: $GRAFANA_PASS"
    echo ""
    
    # Get Homer info
    HOMER_PASS=$(kubectl get secret homer-basic-auth -n homer -o jsonpath='{.data.auth}' | base64 -d | cut -d: -f2)
    HEP_IP=$(kubectl get svc homer-hep-lb -n homer -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending...")
    echo "Homer: https://homer.warp.io"
    echo "  Username: admin"
    echo "  Password: $HOMER_PASS"
    echo "  HEP Endpoint: $HEP_IP:9060 (UDP)"
    echo ""
    
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Update Kamailio config to send HEP to: $HEP_IP:9060"
    echo "2. Configure RTPEngine to send RTCP to: $HEP_IP:9060"
    echo "3. Access Grafana and view the dashboards"
    echo "4. Set up alert notification channels in AlertManager"
    echo ""
    echo -e "${YELLOW}📖 Documentation:${NC}"
    echo "Monitoring endpoints: /home/daldworth/repos/ringer-warp/docs/monitoring-endpoints.md"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Save all credentials securely!${NC}"
}

# Main execution
main() {
    check_prerequisites
    wait_for_cluster
    
    # Deploy components
    deploy_prometheus
    deploy_homer
    deploy_business_metrics
    deploy_alerting
    import_dashboards
    verify_consul
    
    # Display final information
    display_access_info
    
    # Notify completion
    npx claude-flow@alpha hooks notify --message "Observability stack fully deployed"
    npx claude-flow@alpha hooks post-task --task-id "observability"
}

# Run main function
main