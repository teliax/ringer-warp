---
**⚠️ ARCHIVED DOCUMENT**

**This document has been archived and is no longer current. It was part of the Phase 2 deployment attempt that has been superseded by the decision to perform a fresh deployment from scratch. Please refer to current deployment documentation instead.**

**Archive Date: 2025-09-21**  
**Reason: Fresh start deployment decision - all Phase 2 documentation archived**

---

# WARP Phase 2 Deployment Plan

## Executive Summary
This document outlines the immediate steps to complete Phase 2 deployment following successful Phase 1 infrastructure setup.

## Current Infrastructure Status

### ✅ Completed (Phase 1)
- **GKE Cluster**: `warp-dev-kamailio-cluster` in `us-central1`
- **Cloud SQL**: PostgreSQL instance deployed
- **Redis**: High availability instance ready
- **RTPEngine VMs**: IPs 34.45.176.142, 130.211.233.219
- **Artifact Registry**: `us-central1-docker.pkg.dev/ringer-472421/warp-dev-images`
- **Consul**: 3-node service discovery cluster
- **BigQuery**: Datasets configured for CDR/MDR

### ❌ Pending Actions

## Step 1: Prerequisites Setup (CRITICAL)

### 1.1 Install kubectl
```bash
# For Google Cloud Shell or Linux
gcloud components install kubectl

# Verify installation
kubectl version --client
```

### 1.2 Configure GCP Access
```bash
# Set project
export PROJECT_ID=ringer-472421
gcloud config set project $PROJECT_ID

# Get cluster credentials
gcloud container clusters get-credentials warp-dev-kamailio-cluster \
    --region=us-central1 \
    --project=$PROJECT_ID

# Verify access
kubectl get namespaces
```

## Step 2: Secrets Configuration

### 2.1 Database Password
```bash
# Retrieve from Secret Manager
export DB_PASSWORD=$(gcloud secrets versions access latest --secret="warp-dev-db-password")

# If not exists, create it
if [ -z "$DB_PASSWORD" ]; then
    export DB_PASSWORD=$(openssl rand -base64 32)
    echo -n "$DB_PASSWORD" | gcloud secrets create warp-dev-db-password \
        --data-file=- \
        --replication-policy=automatic
fi
```

### 2.2 Configure Kubernetes Secrets
```bash
cd kubernetes/overlays/dev/secrets

# Copy examples to actual files
cp postgres.env.example postgres.env
cp jasmin.env.example jasmin.env
cp rabbitmq.env.example rabbitmq.env
cp sinch.env.example sinch.env

# Edit each file with real values:
# postgres.env
cat > postgres.env <<EOF
POSTGRES_HOST=<CLOUD_SQL_IP>
POSTGRES_PORT=5432
POSTGRES_DB=warp
POSTGRES_USER=warp_app
POSTGRES_PASSWORD=$DB_PASSWORD
EOF

# jasmin.env
cat > jasmin.env <<EOF
JASMIN_USERNAME=admin
JASMIN_PASSWORD=$(openssl rand -base64 16)
EOF

# rabbitmq.env
cat > rabbitmq.env <<EOF
RABBITMQ_DEFAULT_USER=jasmin
RABBITMQ_DEFAULT_PASS=$(openssl rand -base64 16)
RABBITMQ_DEFAULT_VHOST=/
EOF

# sinch.env (get from Sinch dashboard)
cat > sinch.env <<EOF
SMPP_SYSTEM_ID=your-sinch-system-id
SMPP_PASSWORD=your-sinch-password
SMPP_HOST=smpp.sinch.com
SMPP_PORT=2775
EOF
```

## Step 3: Database Initialization

### 3.1 Connect to Cloud SQL
```bash
# Get Cloud SQL connection name
export CLOUDSQL_CONNECTION_NAME=$(gcloud sql instances describe warp-dev-db \
    --format="value(connectionName)")

# Start Cloud SQL proxy
cloud_sql_proxy -instances=$CLOUDSQL_CONNECTION_NAME=tcp:5432 &
export PROXY_PID=$!

# Wait for proxy
sleep 5
```

### 3.2 Run Database Setup
```bash
cd warp/database/setup

# Set environment variables
export CLOUDSQL_CONNECTION_NAME=$CLOUDSQL_CONNECTION_NAME
export DB_PASSWORD=$DB_PASSWORD

# Run master setup
./00-master-setup.sh

# Verify setup
PGPASSWORD=$DB_PASSWORD psql -h localhost -U warp_app -d warp -c "\dt"
```

## Step 4: Deploy Core Services

### 4.1 Create Namespaces and Secrets
```bash
# Create namespaces
kubectl apply -f kubernetes/base/namespace.yaml

# Create secrets from env files
kubectl create secret generic postgres-credentials \
    --from-env-file=kubernetes/overlays/prod/secrets/postgres.env \
    --namespace=telecom --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic jasmin-credentials \
    --from-env-file=kubernetes/overlays/prod/secrets/jasmin.env \
    --namespace=messaging --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic rabbitmq-credentials \
    --from-env-file=kubernetes/overlays/prod/secrets/rabbitmq.env \
    --namespace=messaging --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic sinch-credentials \
    --from-env-file=kubernetes/overlays/prod/secrets/sinch.env \
    --namespace=messaging --dry-run=client -o yaml | kubectl apply -f -
```

### 4.2 Deploy Services with Kustomize
```bash
cd kubernetes

# Deploy production overlay
kustomize build overlays/prod | kubectl apply -f -

# Wait for deployments
kubectl wait --for=condition=available --timeout=300s \
    deployment/kamailio -n telecom

kubectl wait --for=condition=available --timeout=300s \
    deployment/jasmin -n messaging
```

## Step 5: Deploy Monitoring Stack

### 5.1 Deploy Homer
```bash
cd warp/k8s/homer
./deploy.sh

# Wait for Homer
kubectl wait --for=condition=available --timeout=300s \
    deployment/homer-webapp -n homer
```

### 5.2 Deploy Prometheus & Grafana
```bash
cd ../monitoring
./deploy-observability-stack.sh

# Import dashboards
cd ../grafana
./import-dashboards.sh
```

## Step 6: Verify Deployment

### 6.1 Check All Pods
```bash
# Should show all pods running
kubectl get pods --all-namespaces | grep -E "(telecom|messaging|monitoring|homer)"
```

### 6.2 Get Service Endpoints
```bash
# Get LoadBalancer IPs
echo "Kamailio SIP: $(kubectl get svc kamailio -n telecom -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):5060"
echo "Jasmin HTTP: $(kubectl get svc jasmin-http -n messaging -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):8080"
echo "Homer HEP: $(kubectl get svc homer-hep-lb -n homer -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):9060"
```

### 6.3 Run Health Checks
```bash
cd scripts
./quick-health-check.sh
```

## Step 7: Configure External Access

### 7.1 Update DNS Records
```bash
# Get LoadBalancer IPs
KAMAILIO_IP=$(kubectl get svc kamailio -n telecom -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Update DNS (manual process or via Gandi API)
# api.ringer.tel -> API Gateway LoadBalancer IP
# sip.ringer.tel -> $KAMAILIO_IP
# console.ringer.tel -> Vercel (frontend)
# admin.ringer.tel -> Vercel (admin portal)
```

### 7.2 Configure Sinch SMPP
```bash
# Get cluster egress IPs
gcloud compute addresses list --filter="name:nat-auto-ip"

# Provide these IPs to Sinch for whitelisting
```

## Phase 2 Core Services Implementation

### Customer Management Service (NestJS)
- Location: `/warp/services/customer-service/`
- Database: PostgreSQL schemas already created
- API endpoints as per OpenAPI spec

### SIP Trunk Provisioning Service
- Location: `/warp/services/trunk-service/`
- Integrates with Kamailio for real-time provisioning
- IP whitelist management

### Kamailio Routing Configuration
- LuaJIT FFI implementation for high performance
- HTTP calls to WARP API services
- Preserve existing SQL procedures (get_lrn_rates)

## Success Criteria

- [ ] All pods in running state
- [ ] Database accessible from services
- [ ] Kamailio accepting SIP traffic
- [ ] Homer capturing SIP packets
- [ ] Grafana dashboards showing metrics
- [ ] Health check script passes

## Troubleshooting

### Pod Failures
```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Database Connection Issues
```bash
# Check Cloud SQL proxy
ps aux | grep cloud_sql_proxy

# Test direct connection
gcloud sql connect warp-db --user=postgres --project=ringer-warp-v01
```

### Service Discovery
```bash
# Check Consul
kubectl exec -it consul-0 -n consul -- consul members
```

## Next Steps

Once deployment is verified:
1. Begin implementing core services (Customer, Trunk, Routing)
2. Configure provider modules per PROVIDER_MODULES_SPECIFICATION.md
3. Set up CI/CD pipelines
4. Implement monitoring alerts

---
*Updated: 2025-01-21*
*Status: Back to Phase 1 - Infrastructure Deployment*
*Project: ringer-warp-v01*