#!/bin/bash

# Cloud SQL Connectivity Setup Script for WARP
# This script sets up secure connectivity between GKE and Cloud SQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - Update these values
PROJECT_ID="${GCP_PROJECT_ID:-ringer-warp-v01}"
REGION="${GCP_REGION:-us-central1}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-warp-kamailio-cluster}"
NAMESPACE="warp-core"
SQL_INSTANCE_NAME="warp-db"
SERVICE_ACCOUNT_NAME="warp-cloudsql-sa"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
log_info "Checking prerequisites..."

if ! command_exists gcloud; then
    log_error "gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

if ! command_exists kubectl; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
fi

# Set project
log_info "Setting up GCP project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Get cluster credentials
log_info "Getting GKE cluster credentials..."
gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID

# Create namespace if it doesn't exist
log_info "Creating namespace: $NAMESPACE"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Step 1: Create GCP Service Account for Cloud SQL access
log_info "Creating GCP service account for Cloud SQL access..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="WARP Cloud SQL Service Account" \
    --project=$PROJECT_ID || log_warning "Service account may already exist"

# Step 2: Grant Cloud SQL Client role to the service account
log_info "Granting Cloud SQL Client role to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

# Step 3: Enable Workload Identity on the service account
log_info "Setting up Workload Identity binding..."
gcloud iam service-accounts add-iam-policy-binding \
    $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:$PROJECT_ID.svc.id.goog[${NAMESPACE}/cloudsql-proxy]"

# Step 4: Get SQL instance connection name
log_info "Getting Cloud SQL instance connection name..."
SQL_CONNECTION_NAME=$(gcloud sql instances describe $SQL_INSTANCE_NAME \
    --project=$PROJECT_ID \
    --format="get(connectionName)")

if [ -z "$SQL_CONNECTION_NAME" ]; then
    log_error "Could not find Cloud SQL instance: $SQL_INSTANCE_NAME"
    exit 1
fi

log_success "Found Cloud SQL instance: $SQL_CONNECTION_NAME"

# Step 5: Update YAML files with actual values
log_info "Updating YAML files with project-specific values..."

# Update Cloud SQL proxy deployment
sed -i.bak \
    -e "s/PROJECT_ID/$PROJECT_ID/g" \
    -e "s/REGION/$REGION/g" \
    -e "s/PROJECT_ID:REGION:warp-dev-db/$SQL_CONNECTION_NAME/g" \
    cloudsql-proxy-deployment.yaml

# Update init job
sed -i.bak \
    -e "s/PROJECT_ID/$PROJECT_ID/g" \
    -e "s/REGION/$REGION/g" \
    -e "s/PROJECT_ID:REGION:warp-dev-db/$SQL_CONNECTION_NAME/g" \
    k8s-init-job-with-proxy.yaml

# Update Kamailio deployment
sed -i.bak \
    -e "s/PROJECT_ID/$PROJECT_ID/g" \
    -e "s/REGION/$REGION/g" \
    -e "s/PROJECT_ID:REGION:warp-dev-db/$SQL_CONNECTION_NAME/g" \
    kamailio-deployment-with-proxy.yaml

# Step 6: Create database schema ConfigMap
log_info "Creating database schema ConfigMap..."
kubectl create configmap warp-db-schema \
    --namespace=$NAMESPACE \
    --from-file=../schema/ \
    --dry-run=client -o yaml | kubectl apply -f -

# Step 7: Deploy Cloud SQL proxy
log_info "Deploying Cloud SQL proxy..."
kubectl apply -f cloudsql-proxy-deployment.yaml

# Wait for proxy to be ready
log_info "Waiting for Cloud SQL proxy to be ready..."
kubectl wait --for=condition=ready pod -l app=cloudsql-proxy \
    --namespace=$NAMESPACE \
    --timeout=120s

# Step 8: Test connection through proxy
log_info "Testing database connection through proxy..."
kubectl run test-connection --rm -it \
    --namespace=$NAMESPACE \
    --image=postgres:15-alpine \
    --env="PGHOST=cloudsql-proxy" \
    --env="PGPORT=5432" \
    --env="PGDATABASE=warp" \
    --env="PGUSER=warp" \
    --env='PGPASSWORD=)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}' \
    --command -- psql -c "SELECT version();" || true

# Step 9: Run database initialization
log_info "Running database initialization job..."
kubectl apply -f k8s-init-job-with-proxy.yaml

# Monitor job progress
log_info "Monitoring database initialization progress..."
kubectl wait --for=condition=complete job/warp-db-init \
    --namespace=$NAMESPACE \
    --timeout=300s || {
    log_error "Database initialization failed. Checking logs..."
    kubectl logs -n $NAMESPACE job/warp-db-init --all-containers=true
    exit 1
}

log_success "Database initialized successfully!"

# Step 10: Deploy Kamailio with database connectivity
log_info "Deploying Kamailio with database connectivity..."
kubectl apply -f kamailio-deployment-with-proxy.yaml

# Summary
echo ""
echo "======================================="
echo "Cloud SQL Connectivity Setup Complete!"
echo "======================================="
echo ""
echo "Resources created:"
echo "  - GCP Service Account: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
echo "  - Cloud SQL Proxy deployment in namespace: $NAMESPACE"
echo "  - Database initialization completed"
echo "  - Kamailio deployment with database connectivity"
echo ""
echo "Next steps:"
echo "1. Verify Kamailio pods are running:"
echo "   kubectl get pods -n $NAMESPACE -l app=kamailio"
echo ""
echo "2. Check Kamailio logs:"
echo "   kubectl logs -n $NAMESPACE -l app=kamailio"
echo ""
echo "3. Test SIP connectivity to Kamailio service"
echo ""
echo "Connection details for applications:"
echo "  - Host: cloudsql-proxy (within cluster)"
echo "  - Port: 5432"
echo "  - Database: warp"
echo "  - User: warp"
echo ""

# Clean up backup files
rm -f *.yaml.bak