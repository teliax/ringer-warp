#!/bin/bash
# WARP Phase 2 Deployment Script
# Resolves critical blockers and executes deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
CLUSTER_NAME="warp-cluster"

echo -e "${GREEN}🚀 WARP Phase 2 Deployment Script${NC}"
echo "=================================="
echo "This script will:"
echo "1. Install and configure kubectl"
echo "2. Set up Kubernetes secrets"
echo "3. Initialize the database"
echo "4. Deploy all services"
echo "5. Verify deployment"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Step 1: Check and install kubectl
echo -e "\n${YELLOW}Step 1: Checking kubectl installation${NC}"
if ! command -v kubectl &> /dev/null; then
    echo "kubectl not found. Installing..."
    gcloud components install kubectl
else
    echo -e "${GREEN}✓ kubectl is installed${NC}"
fi

# Step 2: Configure GCP and kubectl
echo -e "\n${YELLOW}Step 2: Configuring GCP access${NC}"
gcloud config set project $PROJECT_ID
gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION

# Verify access
if kubectl get namespaces &>/dev/null; then
    echo -e "${GREEN}✓ Kubernetes cluster access configured${NC}"
else
    echo -e "${RED}✗ Failed to access Kubernetes cluster${NC}"
    exit 1
fi

# Step 3: Retrieve or create database password
echo -e "\n${YELLOW}Step 3: Setting up database credentials${NC}"
DB_PASSWORD=$(gcloud secrets versions access latest --secret="warp-db-password" 2>/dev/null || echo "")
if [ -z "$DB_PASSWORD" ]; then
    echo "Creating new database password..."
    DB_PASSWORD=$(openssl rand -base64 32)
    echo -n "$DB_PASSWORD" | gcloud secrets create warp-db-password \
        --data-file=- \
        --replication-policy=automatic
    echo -e "${GREEN}✓ Database password created in Secret Manager${NC}"
else
    echo -e "${GREEN}✓ Database password retrieved from Secret Manager${NC}"
fi

# Step 4: Get Cloud SQL details
echo -e "\n${YELLOW}Step 4: Getting Cloud SQL information${NC}"
CLOUD_SQL_IP=$(gcloud sql instances describe warp-db --format="value(ipAddresses[0].ipAddress)" 2>/dev/null || echo "")
CLOUDSQL_CONNECTION_NAME=$(gcloud sql instances describe warp-db --format="value(connectionName)" 2>/dev/null || echo "")

if [ -z "$CLOUD_SQL_IP" ] || [ -z "$CLOUDSQL_CONNECTION_NAME" ]; then
    echo -e "${RED}✗ Cloud SQL instance 'warp-db' not found${NC}"
    echo "Please ensure Phase 1 Terraform deployment is complete"
    exit 1
fi

echo -e "${GREEN}✓ Cloud SQL IP: $CLOUD_SQL_IP${NC}"
echo -e "${GREEN}✓ Connection Name: $CLOUDSQL_CONNECTION_NAME${NC}"

# Step 5: Create Kubernetes secrets
echo -e "\n${YELLOW}Step 5: Creating Kubernetes secrets${NC}"

# Create namespaces first
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: telecom
---
apiVersion: v1
kind: Namespace
metadata:
  name: messaging
---
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
---
apiVersion: v1
kind: Namespace
metadata:
  name: homer
EOF

# Create PostgreSQL secret
kubectl create secret generic postgres-credentials \
    --from-literal=host=$CLOUD_SQL_IP \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    --from-literal=username=warp_app \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=telecom \
    --dry-run=client -o yaml | kubectl apply -f -

# Copy to other namespaces
for ns in messaging monitoring homer; do
    kubectl get secret postgres-credentials -n telecom -o yaml | \
        sed "s/namespace: telecom/namespace: $ns/" | \
        kubectl apply -f -
done

# Create other required secrets with generated passwords
JASMIN_PASSWORD=$(openssl rand -base64 16)
RABBITMQ_PASSWORD=$(openssl rand -base64 16)

kubectl create secret generic jasmin-credentials \
    --from-literal=username=admin \
    --from-literal=password="$JASMIN_PASSWORD" \
    --namespace=messaging \
    --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic rabbitmq-credentials \
    --from-literal=username=jasmin \
    --from-literal=password="$RABBITMQ_PASSWORD" \
    --namespace=messaging \
    --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓ Kubernetes secrets created${NC}"

# Step 6: Initialize database
echo -e "\n${YELLOW}Step 6: Initializing database${NC}"
echo "Starting Cloud SQL proxy..."

# Kill any existing proxy
pkill cloud_sql_proxy 2>/dev/null || true
sleep 2

# Start proxy in background
cloud_sql_proxy -instances=$CLOUDSQL_CONNECTION_NAME=tcp:5432 &
PROXY_PID=$!
sleep 5

# Check if proxy is running
if ! ps -p $PROXY_PID > /dev/null; then
    echo -e "${RED}✗ Cloud SQL proxy failed to start${NC}"
    echo "Please install cloud_sql_proxy: https://cloud.google.com/sql/docs/mysql/sql-proxy"
    exit 1
fi

# Run database setup
echo "Running database initialization..."
cd warp/database/setup
export CLOUDSQL_CONNECTION_NAME=$CLOUDSQL_CONNECTION_NAME
export DB_PASSWORD=$DB_PASSWORD
if ./00-master-setup.sh; then
    echo -e "${GREEN}✓ Database initialized successfully${NC}"
else
    echo -e "${RED}✗ Database initialization failed${NC}"
    kill $PROXY_PID
    exit 1
fi
cd ../../..

# Kill proxy
kill $PROXY_PID

# Step 7: Deploy Kubernetes services
echo -e "\n${YELLOW}Step 7: Deploying Kubernetes services${NC}"
cd kubernetes
if [ -f deploy.sh ]; then
    ./deploy.sh
else
    # Manual deployment if deploy.sh doesn't exist
    echo "Deploying with kustomize..."
    kustomize build overlays/dev | kubectl apply -f -
fi
cd ..

# Step 8: Deploy monitoring stack
echo -e "\n${YELLOW}Step 8: Deploying monitoring stack${NC}"
if [ -d warp/k8s/monitoring ]; then
    cd warp/k8s/monitoring
    if [ -f deploy-observability-stack.sh ]; then
        ./deploy-observability-stack.sh
    fi
    cd ../../..
fi

# Step 9: Wait for deployments
echo -e "\n${YELLOW}Step 9: Waiting for services to be ready${NC}"
echo "This may take a few minutes..."

# Wait for key deployments
kubectl wait --for=condition=available --timeout=300s deployment/kamailio -n telecom 2>/dev/null || true
kubectl wait --for=condition=available --timeout=300s deployment/jasmin -n messaging 2>/dev/null || true

# Step 10: Verification
echo -e "\n${YELLOW}Step 10: Deployment verification${NC}"

# Check pod status
echo -e "\n${YELLOW}Pod Status:${NC}"
kubectl get pods --all-namespaces | grep -E "(telecom|messaging|monitoring|homer)" || true

# Get service endpoints
echo -e "\n${YELLOW}Service Endpoints:${NC}"
KAMAILIO_IP=$(kubectl get svc kamailio -n telecom -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
JASMIN_IP=$(kubectl get svc jasmin-http -n messaging -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")

echo -e "Kamailio SIP: ${GREEN}$KAMAILIO_IP:5060${NC}"
echo -e "Jasmin HTTP: ${GREEN}$JASMIN_IP:8080${NC}"

# Get RTPEngine IPs
echo -e "\n${YELLOW}RTPEngine IPs (from Terraform):${NC}"
echo -e "${GREEN}34.45.176.142${NC}"
echo -e "${GREEN}130.211.233.219${NC}"

# Final summary
echo -e "\n${GREEN}🎉 Phase 2 Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Update DNS records:"
echo "   - api.ringer.tel → API Gateway LoadBalancer IP"
echo "   - sip.ringer.tel → $KAMAILIO_IP"
echo "2. Configure external integrations in admin portal"
echo "3. Run health checks: ./scripts/quick-health-check.sh"
echo "4. Access monitoring:"
echo "   - Grafana: kubectl port-forward -n monitoring svc/grafana 3000:80"
echo "   - Homer: kubectl port-forward -n homer svc/homer-webapp 8080:80"
echo ""
echo "Documentation: /docs/PHASE2_DEPLOYMENT_PLAN.md"