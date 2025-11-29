#!/bin/bash
# WARP Platform Deployment Script
# This script orchestrates the deployment of all WARP components

set -e

PROJECT_ID="ringer-472421"
REGION="us-central1"
CLUSTER_NAME="warp-kamailio-cluster"

echo "🚀 WARP Platform Deployment Script"
echo "=================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Verify we're in the correct project
CURRENT_PROJECT=$(gcloud config get-value project)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "❌ ERROR: Not in correct project. Expected: $PROJECT_ID, Current: $CURRENT_PROJECT"
    exit 1
fi

echo "✅ Step 1: Infrastructure Status Check"
echo "-------------------------------------"
# Check if GKE cluster exists
if gcloud container clusters describe $CLUSTER_NAME --region=$REGION &>/dev/null; then
    echo "✅ GKE cluster exists: $CLUSTER_NAME"
else
    echo "❌ GKE cluster not found. Please run terraform apply first."
    exit 1
fi

# Configure kubectl
echo "Configuring kubectl..."
gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION

echo ""
echo "✅ Step 2: Database Setup"
echo "------------------------"
# Get Cloud SQL instance details
CLOUD_SQL_INSTANCE=$(gcloud sql instances list --filter="name:warp-db" --format="value(name)" | head -1)
if [ -z "$CLOUD_SQL_INSTANCE" ]; then
    echo "❌ Cloud SQL instance not found"
    exit 1
fi

echo "✅ Cloud SQL instance: $CLOUD_SQL_INSTANCE"

# Get database password from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest --secret="warp-db-password" 2>/dev/null || echo "")
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database password not found in Secret Manager"
    exit 1
fi

echo "Running database setup scripts..."
cd warp/database/setup
./00-master-setup.sh || { echo "❌ Database setup failed"; exit 1; }
cd ../../..

echo ""
echo "✅ Step 3: Deploy Core Services"
echo "-------------------------------"

# Create required secrets
echo "Creating Kubernetes secrets..."
kubectl create namespace warp --dry-run=client -o yaml | kubectl apply -f -

# Create database secret
kubectl create secret generic postgres-credentials \
    --from-literal=host=$(gcloud sql instances describe $CLOUD_SQL_INSTANCE --format="value(ipAddresses[0].ipAddress)") \
    --from-literal=port=5432 \
    --from-literal=database=warp \
    --from-literal=username=warp \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=warp \
    --dry-run=client -o yaml | kubectl apply -f -

# Deploy Kamailio and Jasmin
echo "Deploying telecom services..."
cd kubernetes
./deploy.sh
cd ..

echo ""
echo "✅ Step 4: Deploy Observability Stack"
echo "-------------------------------------"
cd monitoring
./deploy-observability-stack.sh
cd ..

echo ""
echo "✅ Step 5: Get Service Endpoints"
echo "--------------------------------"
# Get LoadBalancer IPs
KAMAILIO_IP=$(kubectl get svc kamailio -n warp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
HOMER_HEP_IP=$(kubectl get svc homer-hep-lb -n homer -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")

# Get RTPEngine IPs from Terraform output
cd warp/terraform/environments/dev
RTPENGINE_IPS=$(terraform output -json rtpengine_ips 2>/dev/null | jq -r '.[]' | tr '\n' ' ' || echo "unknown")
cd ../../../..

echo ""
echo "📊 Deployment Summary"
echo "===================="
echo "✅ Infrastructure: Deployed"
echo "✅ Database: Configured"
echo "✅ Kamailio SIP: $KAMAILIO_IP:5060"
echo "✅ RTPEngine IPs: $RTPENGINE_IPS"
echo "✅ Homer HEP: $HOMER_HEP_IP:9060"
echo "✅ Monitoring: Prometheus, Grafana, Homer"
echo ""
echo "🔗 Access Points:"
echo "- Grafana: http://localhost:3000 (kubectl port-forward)"
echo "- Homer: http://localhost:8080 (kubectl port-forward)"
echo "- Prometheus: http://localhost:9090 (kubectl port-forward)"
echo ""
echo "📝 Next Steps:"
echo "1. Update DNS records to point to LoadBalancer IPs"
echo "2. Configure Sinch SMPP with cluster egress IPs"
echo "3. Import initial rate tables and routing rules"
echo "4. Test SIP and SMS connectivity"
echo ""
echo "✅ WARP Platform deployment complete!"