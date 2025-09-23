# VPC Migration Plan - Remove "dev" from Network Resources

## ⚠️ Critical Impact Assessment

Migrating from `warp-dev-vpc` to `warp-vpc` requires recreating ALL network-attached resources:

### Current VPC Structure
- **VPC**: `warp-dev-vpc`
- **Subnets**:
  - `warp-dev-gke-subnet` (10.0.0.0/24) - GKE cluster
  - `warp-dev-rtpengine-subnet` (10.0.1.0/24) - RTPEngine VMs
  - `warp-dev-consul-subnet` (10.0.2.0/24) - Consul servers

### Resources Attached to VPC
1. **Compute Instances**: 5 VMs (Consul + RTPEngine)
2. **Cloud SQL**: May have private IP in this VPC
3. **Redis**: Connected to this VPC
4. **GKE Cluster**: When created, will use this VPC
5. **Load Balancers**: Any existing LBs

## 🚨 Migration Complexity

This is a **MAJOR** infrastructure change that requires:
1. Complete service downtime
2. Recreating ALL compute resources
3. Updating ALL configurations
4. Potential data migration

## 📋 Migration Options

### Option 1: Keep VPC Name (Recommended) ⭐
**Pros**:
- No downtime
- No resource recreation needed
- VPC name is internal only
- Focus on more important tasks

**Cons**:
- VPC keeps "dev" in name

### Option 2: Full VPC Migration
**Steps**:
1. Create new VPC and subnets
2. Recreate ALL resources in new VPC
3. Migrate data
4. Update all configurations
5. Delete old VPC

**Time Required**: 4-6 hours
**Risk**: High
**Downtime**: 2-4 hours

### Option 3: Gradual Migration
1. Create new VPC in parallel
2. Migrate services one by one
3. Use VPC peering during transition
4. Delete old VPC when complete

**Time Required**: 1-2 days
**Risk**: Medium
**Downtime**: Minimal per service

## 🎯 Recommendation

**Keep the VPC name as `warp-dev-vpc`** for now because:

1. **Internal Only**: VPC names are not customer-facing
2. **High Risk**: Migration could break the entire platform
3. **Time Consuming**: Would delay Phase 2 by days
4. **Low Value**: Provides no functional benefit

Instead, focus on:
- Removing "dev" from customer-visible resources ✅
- Removing "dev" from new resources going forward ✅
- Plan VPC migration for a future maintenance window

## 🔧 If We Must Migrate

Here's the script to create new VPC:

```bash
# Create new VPC
gcloud compute networks create warp-vpc \
    --subnet-mode=custom \
    --bgp-routing-mode=regional \
    --project=ringer-472421

# Create subnets
gcloud compute networks subnets create warp-gke-subnet \
    --network=warp-vpc \
    --region=us-central1 \
    --range=10.0.0.0/24 \
    --secondary-range=pods=10.1.0.0/16,services=10.2.0.0/16

gcloud compute networks subnets create warp-rtpengine-subnet \
    --network=warp-vpc \
    --region=us-central1 \
    --range=10.0.1.0/24

gcloud compute networks subnets create warp-consul-subnet \
    --network=warp-vpc \
    --region=us-central1 \
    --range=10.0.2.0/24

# Create firewall rules
gcloud compute firewall-rules create warp-allow-internal \
    --network=warp-vpc \
    --allow=tcp,udp,icmp \
    --source-ranges=10.0.0.0/16

gcloud compute firewall-rules create warp-allow-ssh \
    --network=warp-vpc \
    --allow=tcp:22 \
    --source-ranges=0.0.0.0/0

gcloud compute firewall-rules create warp-allow-sip \
    --network=warp-vpc \
    --allow=udp:5060,tcp:5060,udp:10000-20000 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=sip,rtpengine
```

## 📊 Impact Analysis

| Component | Impact | Migration Effort |
|-----------|---------|-----------------|
| Consul Cluster | Full recreate | 2 hours |
| RTPEngine | Full recreate | 1 hour |
| Cloud SQL | Update network | 30 mins |
| Redis | Recreate | 30 mins |
| GKE | Recreate cluster | 1 hour |
| Firewall Rules | Recreate all | 30 mins |
| Load Balancers | Update | 30 mins |

**Total Effort**: 5-6 hours
**Total Downtime**: 2-4 hours

## 🎯 Decision Required

Should we:
1. **Keep VPC as-is** and proceed with Phase 2? (Recommended)
2. **Schedule VPC migration** for later?
3. **Do full migration now** and delay Phase 2?

---
*Created: $(date)*