# Infrastructure Resource Renaming Plan

## Overview
Remove "dev" from all infrastructure resource names for cleaner naming convention.

## Current Resources to Rename

### 1. GKE Cluster
- **Current**: `warp-dev-kamailio-cluster` (being created)
- **New**: `warp-kamailio-cluster`
- **Action**: Cancel current creation and create with new name

### 2. Cloud SQL Instance
- **Current**: `warp-dev-db` (PENDING_CREATE)
- **New**: `warp-db`
- **Action**: Delete pending instance and recreate

### 3. Redis Instance
- **Current**: `warp-dev-redis`
- **New**: `warp-redis`
- **Action**: Create new instance, migrate, delete old

### 4. Compute Instances
- **Current**: 
  - `warp-dev-consul-server-1/2/3`
  - `warp-dev-rtpengine-1/2`
- **New**: 
  - `warp-consul-server-1/2/3`
  - `warp-rtpengine-1/2`
- **Action**: These need to be recreated

### 5. Artifact Registry
- **Current**: `warp-dev-images`
- **New**: `warp-images`
- **Action**: Create new repository

### 6. VPC Network (if custom)
- **Current**: `warp-dev-vpc`
- **New**: `warp-vpc`
- **Action**: Check if exists and plan migration

### 7. Terraform State Bucket
- **Current**: `warp-terraform-state-dev`
- **New**: `warp-terraform-state`
- **Action**: Create new bucket, migrate state

### 8. Secrets in Secret Manager
- **Current**: Various with `*-dev-*` pattern
- **New**: Remove `-dev` from names
- **Action**: Copy secrets to new names

## Execution Steps

### Step 1: Stop Current Operations
```bash
# Cancel the cluster creation
gcloud container operations cancel \
  operation-1758481892846-59d59826-370a-4b21-82e2-24eef4276e8d \
  --region=us-central1

# Delete pending Cloud SQL
gcloud sql instances delete warp-dev-db --quiet
```

### Step 2: Update Terraform Configurations
Update all terraform files in `/warp/terraform/` to remove "dev" from resource names.

### Step 3: Create New Resources
```bash
# Create GKE cluster with new name
gcloud container clusters create warp-kamailio-cluster \
  --region=us-central1 \
  --num-nodes=2 \
  --node-locations=us-central1-a,us-central1-b,us-central1-c \
  --machine-type=n2-standard-4 \
  --disk-size=100 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=5 \
  --enable-autorepair \
  --enable-autoupgrade \
  --release-channel=regular \
  --network=default \
  --enable-ip-alias

# Create Cloud SQL with new name
gcloud sql instances create warp-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --network=default \
  --no-assign-ip

# Create new Redis
gcloud redis instances create warp-redis \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_7_x \
  --tier=standard

# Create new Artifact Registry
gcloud artifacts repositories create warp-images \
  --repository-format=docker \
  --location=us-central1 \
  --description="WARP platform container images"
```

### Step 4: Update All Code References
- Update deployment scripts
- Update Kubernetes manifests
- Update application configurations
- Update documentation

## Files to Update

1. `/deploy-warp-platform.sh`
2. `/scripts/phase2-deployment.sh`
3. All files in `/kubernetes/`
4. All files in `/warp/terraform/`
5. All documentation mentioning resource names
6. Environment configuration files

## Rollback Plan

If issues arise:
1. Keep old resources running until new ones are verified
2. Update DNS/endpoints gradually
3. Test thoroughly before decommissioning old resources

---
*Created: $(date)*