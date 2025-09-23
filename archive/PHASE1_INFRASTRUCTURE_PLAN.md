# WARP Phase 1 Infrastructure Plan - Clean Start

## 🎯 Objective
Deploy the complete WARP platform infrastructure in the new `ringer-warp-v01` project with clean naming conventions (no environment prefixes).

## 📋 Current Status

### ✅ Completed
1. Created new GCP project: `ringer-warp-v01`
2. Enabled all required APIs
3. Created Terraform state bucket
4. Set up service accounts
5. Created initial secrets in Secret Manager
6. Generated Terraform configuration

### ⏳ Next: Infrastructure Deployment

## 🚀 Phase 1 Steps

### Step 1: Deploy Infrastructure with Terraform (~20 minutes)

```bash
cd warp/terraform/environments/v01
./deploy.sh
```

This will create:
- **Networking**
  - VPC: `warp-vpc`
  - Subnets for GKE, RTPEngine, and Consul
  - Firewall rules for SIP, RTP, and internal traffic

- **Compute Resources**
  - GKE Cluster: `warp-cluster` (2-5 nodes auto-scaling)
  - Consul Servers: `warp-consul-server-{1,2,3}`
  - RTPEngine VMs: `warp-rtpengine-{1,2}`

- **Data Services**
  - Cloud SQL: `warp-db` (PostgreSQL 15)
  - Redis: `warp-redis` (5GB HA)
  - BigQuery: Datasets for CDR/MDR

- **Container Registry**
  - Artifact Registry: `warp-images`

### Step 2: Configure Access (~5 minutes)

```bash
# Configure kubectl
gcloud container clusters get-credentials warp-cluster \
  --region=us-central1 \
  --project=ringer-warp-v01

# Verify cluster access
kubectl get nodes
kubectl get namespaces
```

### Step 3: Initialize Database (~10 minutes)

```bash
# Navigate to database setup
cd warp/database/setup

# Get Cloud SQL connection info
export CLOUDSQL_CONNECTION_NAME="ringer-warp-v01:us-central1:warp-db"
export DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret=warp-db-password \
  --project=ringer-warp-v01)

# Run master setup
./00-master-setup.sh

# Verify database
gcloud sql databases list --instance=warp-db --project=ringer-warp-v01
```

### Step 4: Create Kubernetes Namespaces and Secrets (~5 minutes)

```bash
# Create namespaces
kubectl create namespace telecom
kubectl create namespace messaging
kubectl create namespace monitoring
kubectl create namespace homer

# Create environment directory
mkdir -p kubernetes/overlays/prod/secrets
cd kubernetes/overlays/prod/secrets

# Copy from examples
cp ../../../dev/secrets/*.example .

# Update with actual values
# Then create secrets...
```

### Step 5: Deploy Core Services (~15 minutes)

```bash
cd kubernetes

# Apply base configurations
kubectl apply -f base/

# Deploy with kustomization
kustomize build overlays/prod | kubectl apply -f -

# Verify deployments
kubectl get deployments --all-namespaces
kubectl get services --all-namespaces
```

### Step 6: Deploy Monitoring Stack (~10 minutes)

```bash
# Deploy Prometheus & Grafana
cd warp/k8s/monitoring
./deploy-observability-stack.sh

# Deploy Homer for SIP
cd ../homer
./deploy.sh

# Import Grafana dashboards
cd ../grafana
./import-dashboards.sh
```

## ✅ Validation Checklist

- [ ] All Terraform resources created successfully
- [ ] kubectl can access the cluster
- [ ] Database initialized with all schemas
- [ ] All namespaces created
- [ ] Secrets configured properly
- [ ] Core services deployed and running
- [ ] Monitoring stack operational
- [ ] LoadBalancer IPs assigned

## 📊 Resource Summary

| Resource | Name | Type |
|----------|------|------|
| Project | ringer-warp-v01 | GCP Project |
| Network | warp-vpc | VPC |
| Cluster | warp-cluster | GKE |
| Database | warp-db | Cloud SQL |
| Cache | warp-redis | Redis |
| Registry | warp-images | Artifact Registry |
| Discovery | warp-consul-server-* | Consul |
| Media | warp-rtpengine-* | RTPEngine |

## 🔐 Security Notes

- All secrets stored in Google Secret Manager
- Private GKE cluster with authorized networks
- Workload Identity enabled
- Cloud Armor ready for DDoS protection

## 🎯 Success Criteria

1. Infrastructure deployed with zero errors
2. All services accessible
3. Monitoring dashboards showing data
4. Health checks passing
5. Ready for Phase 2 service implementation

## 🚨 Common Issues & Solutions

### Terraform State Lock
```bash
# If locked, break the lock
terraform force-unlock <lock-id>
```

### Insufficient Quota
```bash
# Check quotas
gcloud compute project-info describe --project=ringer-warp-v01

# Request increase if needed
```

### Database Connection Failed
```bash
# Check Cloud SQL proxy
gcloud sql instances describe warp-db --project=ringer-warp-v01

# Verify private IP assigned
```

---

*Created: 2025-01-21*
*Phase: 1 - Infrastructure Deployment*
*Next: Phase 2 - Service Implementation*