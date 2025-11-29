# SMPP Gateway - Cloud NAT IP Routing Issue

**Date:** 2025-11-25
**Status:** ✅ RESOLVED - SMPP Gateway Connected to Sinch
**Priority:** P1 - Production Service Down
**Assigned To:** Senior Infrastructure Engineer
**Resolved:** 2025-11-26 01:36 UTC by Claude Code

## Resolution Summary

**Root Cause:** The `warp-nat-gke` Cloud NAT gateway was configured to only NAT traffic from the `gke-pods` secondary IP range (`LIST_OF_SECONDARY_IP_RANGES`), but GKE pod traffic requires NAT coverage for ALL IP ranges from the GKE subnet (both primary node IPs and secondary pod IPs).

**Fix Applied:**
```bash
gcloud compute routers nats update warp-nat-gke \
  --router=warp-router \
  --region=us-central1 \
  --nat-custom-subnet-ip-ranges=warp-gke-subnet:ALL
```

**Terraform Updated:** `infrastructure/terraform/modules/networking/main.tf` - Changed `source_ip_ranges_to_nat` from `LIST_OF_SECONDARY_IP_RANGES` to `ALL_IP_RANGES`

**Verification:**
- Egress IP confirmed: 34.58.165.135 (Sinch whitelisted) ✅
- SMPP Gateway status: connected ✅
- Sinch_Atlanta vendor: bound successfully ✅

---

---

## Executive Summary

The SMPP Gateway service cannot establish outbound connections to Sinch's SMPP server due to Cloud NAT IP routing issues. Despite multiple terraform configurations, GKE pods appear to be egressing through non-whitelisted IP addresses, causing connection timeouts.

**Current State:**
- ❌ SMPP gateway pod: Running but not ready (0/1)
- ❌ Sinch SMPP bind: Connection timeout (22+ days)
- ✅ Database configuration: Correct
- ✅ API endpoints: Working
- ❓ **Actual egress IP: UNCONFIRMED** (suspected: 34.57.46.26 - NOT whitelisted)

---

## Background

### What Should Be Working

**SMPP Gateway** (`services/smpp-gateway/`) should connect to **Sinch Atlanta SMPP server** to enable wholesale SMS routing:

```
GKE Pod (10.1.8.x) → Cloud NAT → Sinch SMPP
                    (34.58.165.135)  (msgbrokersmpp-atl.inteliquent.com:3601)
```

### Sinch IP Whitelist

Sinch has whitelisted **ONLY** these 2 IPs:
- ✅ `34.58.165.135` (warp-nat-outbound-ip) - **Target IP for SMPP egress**
- ✅ `34.55.43.157` (smpp-gateway-server LoadBalancer) - **Inbound only**

**Any other source IP will be blocked by Sinch's firewall.**

---

## Current Infrastructure State

### GCP Project
- **Project ID:** `ringer-warp-v01`
- **Region:** `us-central1`
- **GKE Cluster:** `warp-cluster` (Autopilot, Private)

### Cloud NAT Configuration (As of 2025-11-25)

#### warp-nat-gke
```yaml
Name: warp-nat-gke
Router: warp-router
NAT IPs: 34.58.165.135 (warp-nat-outbound-ip) ← CORRECT IP
Subnets:
  - warp-gke-subnet (gke-pods secondary range only)
Endpoint Types: ENDPOINT_TYPE_VM (⚠️ Should be GKE?)
Log Filter: ALL
```

#### warp-nat-general
```yaml
Name: warp-nat-general
Router: warp-router
NAT IPs:
  - 34.57.46.26 (warp-nat-ip-1)
  - 35.223.15.88 (warp-nat-ip-2)
  - 136.111.96.47 (warp-nat-ip-3)
Subnets:
  - warp-rtpengine-subnet (all ranges)
  - warp-consul-subnet (all ranges)
Log Filter: ERRORS_ONLY
```

### GKE Cluster SNAT Status
```bash
$ gcloud container clusters describe warp-cluster --region=us-central1 \
  --format="value(networkConfig.defaultSnatStatus.disabled)"
True
```
✅ **GKE default SNAT is disabled** (updated 2025-11-25)

### Network Topology

```
VPC: warp-vpc
├── warp-gke-subnet (10.0.0.0/24)
│   ├── gke-pods: 10.1.0.0/16 (secondary range)
│   └── gke-services: 10.2.0.0/16 (secondary range)
├── warp-rtpengine-subnet (10.0.1.0/24)
└── warp-consul-subnet (10.0.2.0/24)

SMPP Gateway Pod IP: 10.1.8.x (in gke-pods range)
```

---

## Problem Timeline

### October 10, 2025
- `warp-nat-outbound-ip` (34.58.165.135) created **manually**
- Manually attached to Cloud NAT (not in terraform)
- Sinch whitelisted this IP
- **SMPP presumably working** (unconfirmed - no logs)

### October 11, 2025
- Sinch Atlanta vendor configured in database (`messaging.vendors`)
- SMPP gateway deployment created
- **No record of successful connection ever established**

### November 10, 2025 (15 days ago)
- **3 new NAT IPs created**:
  - warp-nat-ip-1 (34.57.46.26)
  - warp-nat-ip-2 (35.223.15.88)
  - warp-nat-ip-3 (136.111.96.47)
- Likely `terraform apply` executed
- **Original whitelisted IP detached from NAT** (became orphaned)
- SMPP gateway started failing (connection timeouts)

### November 25, 2025 (Today)
**Actions Taken:**
1. ✅ Added `warp-nat-outbound-ip` reference to terraform
2. ✅ Created two separate Cloud NAT gateways:
   - `warp-nat-gke` (for GKE pods, using whitelisted IP)
   - `warp-nat-general` (for VMs, using other 3 IPs)
3. ✅ Disabled GKE default SNAT (`--disable-default-snat`)
4. ✅ Removed warp-gke-subnet from warp-nat-general to avoid conflict

**Result:** 🔴 **Still failing** - Connection timeouts persist

---

## Diagnostic Results

### Database Configuration ✅

**Table:** `messaging.vendors`

```sql
SELECT instance_name, host, port, username, use_tls, is_active
FROM messaging.vendors WHERE instance_name='Sinch_Atlanta';

-- Result:
instance_name  | host                              | port | username  | use_tls | is_active
Sinch_Atlanta  | msgbrokersmpp-atl.inteliquent.com | 3601 | telxMBa1  | true    | true
```

**Health Status:**
```sql
SELECT health_status, last_health_check FROM messaging.vendors WHERE instance_name='Sinch_Atlanta';

-- Result:
health_status | last_health_check
unknown       | NULL              ← Never connected successfully
```

### SMPP Gateway Logs

**Repeating Error (every ~2 minutes):**
```json
{
  "error": "dial tcp 206.146.165.6:3601: connect: connection timed out",
  "host": "msgbrokersmpp-atl.inteliquent.com",
  "level": "error",
  "message": "TLS dial failed",
  "port": 3601,
  "vendor": "Sinch_Atlanta"
}
```

### Network Connectivity Tests

```bash
# DNS Resolution
$ kubectl exec smpp-gateway-pod -- nslookup msgbrokersmpp-atl.inteliquent.com
Result: ✅ Resolves to 206.146.165.6

# TCP Connectivity
$ kubectl exec smpp-gateway-pod -- nc -zv msgbrokersmpp-atl.inteliquent.com 3601
Result: ❌ Connection timed out

$ kubectl exec smpp-gateway-pod -- nc -zv msgbrokersmpp-atl.inteliquent.com 2775
Result: ❌ Connection timed out (all ports timeout)

# General Internet
$ kubectl exec smpp-gateway-pod -- nc -zv google.com 443
Result: ✅ Connection successful
```

**Conclusion:** Sinch's server is specifically blocking our traffic, NOT a general network issue.

### Actual Egress IP Test (Critical Finding)

```bash
$ kubectl run ip-test --image=curlimages/curl --rm -it --restart=Never -- curl -s https://api.ipify.org
Result: 34.57.46.26
```

**🚨 PROBLEM IDENTIFIED:**
GKE pods are egressing through `34.57.46.26` (warp-nat-ip-1), which is **NOT** one of the two whitelisted IPs.

This IP belongs to `warp-nat-general`, NOT `warp-nat-gke`.

---

## Root Cause Analysis

### Theory: Why This Happened

1. **Last Sprint (October):** Manual Cloud NAT configuration was working
   - `warp-nat-outbound-ip` manually attached to NAT
   - Never committed to terraform

2. **November 10th:** Infrastructure change (possibly unrelated `terraform apply`)
   - Terraform created 3 new NAT IPs from `.tf` file
   - Replaced manual configuration
   - Detached whitelisted IP

3. **GKE Default SNAT Was Enabled:** Pods weren't using Cloud NAT at all
   - Used GKE's own ephemeral IP pool
   - Explains why NAT IP changes had no effect

### Current State After Fixes

**What We Fixed:**
- ✅ Added `warp-nat-outbound-ip` to terraform (won't be lost again)
- ✅ Created dedicated `warp-nat-gke` for GKE pods
- ✅ Disabled GKE default SNAT
- ✅ Removed GKE subnet from `warp-nat-general`

**Why It's Still Broken:**
- ❌ GKE pods still using wrong NAT gateway (warp-nat-general)
- ❓ Possible NAT priority/ordering issue
- ❓ Changes may not have propagated to active pods
- ❓ Cloud NAT subnet matching rules not working as expected

---

## Questions for Senior Engineer

### Critical Questions

1. **Are GKE pods actually using Cloud NAT?**
   - Default SNAT is disabled, but are pods honoring the Cloud NAT config?
   - Do we need to restart node pools or wait for propagation?

2. **Why is `warp-nat-general` handling gke-pods traffic?**
   - We removed warp-gke-subnet from warp-nat-general
   - `warp-nat-gke` is configured for gke-pods only
   - Is there a priority or ordering issue?

3. **Do we need to specify NAT priorities?**
   - Should `warp-nat-gke` have higher priority than `warp-nat-general`?

4. **Is the endpoint type important?**
   - `warp-nat-gke` shows `ENDPOINT_TYPE_VM` but targets GKE pods
   - Should it be `ENDPOINT_TYPE_GKE`? (terraform doesn't seem to support this)

5. **Alternative: Use ALL_SUBNETWORKS for warp-nat-gke?**
   - Would setting `source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"` work?
   - Then delete warp-nat-general entirely?

---

## Proposed Solutions

### Option 1: Single NAT with All 4 IPs (Simplest)

**Revert to single NAT using ALL 4 IPs:**

```terraform
resource "google_compute_router_nat" "warp_nat" {
  name                               = "warp-nat"
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [
    warp-nat-outbound-ip,  # 34.58.165.135
    warp-nat-ip-1,         # 34.57.46.26
    warp-nat-ip-2,         # 35.223.15.88
    warp-nat-ip-3,         # 136.111.96.47
  ]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
```

**Then ask Sinch to whitelist all 4 IPs.**

**Pros:** Simple, guaranteed to work
**Cons:** Requires Sinch coordination (they said they won't whitelist more than 2)

---

### Option 2: Fix Subnet-Specific NAT Routing (Complex)

**Debug why `warp-nat-gke` isn't being used:**

1. Verify Cloud NAT routing rules precedence
2. Check if NAT gateway creation order matters
3. Test with explicit subnet IP range matching
4. Consider using Cloud NAT rules/policies (if available)

**Pros:** Maintains separate IP pools for different services
**Cons:** Complex, unclear why current config isn't working

---

### Option 3: Use LoadBalancer IP for Outbound (Workaround)

**Configure SMPP gateway deployment to use the LoadBalancer IP (34.55.43.157) for egress:**

- Deploy SMPP gateway as a standalone VM or use hostNetwork mode
- Bind directly to LoadBalancer IP
- Bypass Cloud NAT entirely

**Pros:** Uses already-whitelisted IP
**Cons:** Architectural change, loses Kubernetes benefits

---

### Option 4: Enable NAT Logging and Debug

**Enable comprehensive NAT logging to see actual IP mappings:**

```bash
# Already done:
gcloud compute routers nats update warp-nat-gke \
  --router=warp-router \
  --region=us-central1 \
  --enable-logging \
  --log-filter=ALL

# Check logs:
gcloud logging read 'resource.type="gce_router"' \
  --format=json \
  --freshness=15m \
  | jq '.[] | select(.jsonPayload.connection.dest_ip=="206.146.165.6")'
```

**Issue:** Logs not showing connection data (may take time to propagate or connections timeout before NAT)

---

## Technical Details

### SMPP Gateway Deployment

**Namespace:** `messaging`
**Pod:** `smpp-gateway-544c9949d9-xxxxx`
**Image:** `gcr.io/ringer-warp-v01/smpp-gateway:latest`
**Replicas:** 1 (0/1 ready)

**Environment Variables:**
```bash
POSTGRES_HOST=10.126.0.3
POSTGRES_PORT=5432
POSTGRES_USER=warp
POSTGRES_DB=warp
REDIS_HOST=redis-service.messaging.svc.cluster.local:6379
RABBITMQ_HOST=rabbitmq-service.messaging.svc.cluster.local:5672
SMPP_HOST=0.0.0.0
SMPP_PORT=2775
SMPP_TLS_PORT=2776
```

### Sinch SMPP Configuration

```yaml
Host: msgbrokersmpp-atl.inteliquent.com
IP: 206.146.165.6
Port: 3601 (TLS)
Username: telxMBa1
Password: [Stored in database - messaging.vendors table]
Bind Type: Transceiver (TRX)
Protocol: SMPP 3.4
```

### API Endpoints (Working ✅)

**SMPP Gateway Management API:**
```
GET  http://smpp-gateway-api.messaging:8080/health
GET  http://smpp-gateway-api.messaging:8080/api/v1/vendors
POST http://smpp-gateway-api.messaging:8080/api/v1/vendors/:id/reconnect
GET  http://smpp-gateway-api.messaging:8080/api/v1/admin/stats
```

**Current Vendor Status:**
```json
{
  "vendor_id": "9e22660d-6f2e-4761-8729-f4272d30eb71",
  "vendor_name": "Sinch_Atlanta",
  "status": "disconnected",
  "last_error": "dial tcp 206.146.165.6:3601: connect: connection timed out",
  "messages_sent": 0,
  "messages_success": 0,
  "messages_failed": 0
}
```

---

## Terraform Changes Made

### File: `infrastructure/terraform/modules/networking/main.tf`

**Added:**
```terraform
# SMPP-specific NAT IP whitelisted by Sinch
data "google_compute_address" "nat_outbound_ip" {
  name    = "warp-nat-outbound-ip"
  region  = var.region
  project = var.project_id
}

# Cloud NAT for GKE pods - uses ONLY the Sinch-whitelisted IP
resource "google_compute_router_nat" "warp_nat_gke" {
  name                               = "warp-nat-gke"
  router                             = google_compute_router.warp_router.name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [
    data.google_compute_address.nat_outbound_ip.self_link,
  ]
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  endpoint_types                     = ["ENDPOINT_TYPE_GKE"]  # May not be working

  subnetwork {
    name                     = google_compute_subnetwork.gke_subnet.id
    source_ip_ranges_to_nat  = ["LIST_OF_SECONDARY_IP_RANGES"]
    secondary_ip_range_names = ["gke-pods"]
  }
}

# Cloud NAT for VMs only (RTPEngine, Consul)
resource "google_compute_router_nat" "warp_nat_general" {
  name                               = "warp-nat-general"
  nat_ips                            = [
    warp-nat-ip-1,
    warp-nat-ip-2,
    warp-nat-ip-3,
  ]
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  # NO GKE SUBNET - handled by warp_nat_gke
  subnetwork {
    name                     = google_compute_subnetwork.rtpengine_subnet.id
    source_ip_ranges_to_nat  = ["ALL_IP_RANGES"]
  }
  subnetwork {
    name                     = google_compute_subnetwork.consul_subnet.id
    source_ip_ranges_to_nat  = ["ALL_IP_RANGES"]
  }
}
```

**Removed:**
- Original `warp_nat` resource (deleted and replaced)

---

## Verification Commands

### Check Current NAT Configuration
```bash
# List all NAT gateways
gcloud compute routers nats list --router=warp-router --region=us-central1

# Describe warp-nat-gke
gcloud compute routers nats describe warp-nat-gke \
  --router=warp-router \
  --region=us-central1

# Check NAT IPs
gcloud compute addresses list --filter="name~warp-nat" \
  --format="table(name,address,status,users.basename())"
```

### Test Egress IP from GKE Pod
```bash
# Quick test
kubectl run ip-test --image=curlimages/curl --rm -it --restart=Never -- curl -s https://api.ipify.org

# Expected: 34.58.165.135 (Sinch whitelisted)
# Actual (last test): 34.57.46.26 (NOT whitelisted) ⚠️
```

### Check SMPP Gateway Status
```bash
# Pod status
kubectl get pods -n messaging | grep smpp-gateway

# Recent logs
kubectl logs -n messaging -l app=smpp-gateway --tail=50

# Vendor status via API
kubectl port-forward -n messaging svc/smpp-gateway-api 8080:8080
curl http://localhost:8080/api/v1/vendors | jq '.vendors[] | {vendor_name, status, last_error}'
```

### Check Cloud NAT Logs
```bash
# Check if ANY NAT translations are logged
gcloud logging read 'resource.type="gce_router" AND resource.labels.router_id="warp-router"' \
  --limit=20 \
  --format=json \
  --freshness=30m \
  | jq -r '.[] | select(.jsonPayload.connection) | "\(.jsonPayload.connection.src_ip) → \(.jsonPayload.connection.dest_ip)"'

# Check specifically for Sinch connections
gcloud logging read 'resource.type="gce_router" AND jsonPayload.connection.dest_ip="206.146.165.6"' \
  --limit=10 \
  --freshness=15m
```

---

## What We Know (Confirmed)

1. ✅ **DNS works** - msgbrokersmpp-atl.inteliquent.com resolves correctly
2. ✅ **Database config is correct** - Sinch vendor properly configured
3. ✅ **SMPP gateway code is working** - Other pods/services function normally
4. ✅ **GKE default SNAT is disabled** - Cluster configured to use Cloud NAT
5. ✅ **Cloud NAT has correct IP** - warp-nat-gke uses 34.58.165.135
6. ✅ **Sinch server is up** - (assumed, needs confirmation)
7. ❌ **Egress IP is WRONG** - Test showed 34.57.46.26, not 34.58.165.135

## What We Don't Know (Need to Confirm)

1. ❓ **Why is GKE still using warp-nat-general instead of warp-nat-gke?**
   - Subnet matching not working?
   - NAT gateway priority/ordering issue?
   - Configuration not propagated to data plane?

2. ❓ **Do we need to restart GKE node pools?**
   - Network config changes may require node restart
   - Existing network connections may be cached

3. ❓ **Is there a delay in Cloud NAT reconfiguration?**
   - How long does it take for NAT changes to take effect?
   - Do we need to wait longer?

4. ❓ **Are Cloud NAT logs actually enabled and working?**
   - Filter set to "ALL" but no connection logs appearing
   - May take time to propagate or connections timeout pre-NAT

5. ❓ **Can we force a specific NAT IP per namespace/pod?**
   - Kubernetes annotations?
   - Network policies?
   - Different approach needed?

---

## Recommended Next Steps

### Immediate (P0)

1. **Verify actual egress IP being used:**
   ```bash
   # Run multiple tests to check for round-robin
   for i in {1..5}; do
     kubectl run ip-test-$i --image=curlimages/curl -- curl -s https://api.ipify.org
     sleep 5
     kubectl logs ip-test-$i
     kubectl delete pod ip-test-$i
   done
   ```

2. **Contact Sinch support:**
   - Request firewall logs showing connection attempts from our account (last 2 hours)
   - They can tell us the actual source IP they're seeing
   - Ask for confirmation of whitelisted IPs

3. **Check Cloud NAT routing rules precedence:**
   - Verify subnet matching logic
   - Confirm gke-pods secondary range is exclusively handled by warp-nat-gke
   - Look for any conflicts or overlaps

### Short-term (P1)

4. **Restart GKE node pools:**
   ```bash
   # May be needed for network config changes to propagate
   gcloud container clusters upgrade warp-cluster \
     --region=us-central1 \
     --node-pool=default-pool \
     --cluster-version=$(gcloud container clusters describe warp-cluster --region=us-central1 --format='value(currentMasterVersion)')
   ```

5. **Enable detailed VPC Flow Logs:**
   ```bash
   gcloud compute networks subnets update warp-gke-subnet \
     --region=us-central1 \
     --enable-flow-logs \
     --log-sampling=1.0 \
     --log-metadata=INCLUDE_ALL_METADATA
   ```

6. **Test with dedicated SMPP client:**
   - Deploy test pod that logs its egress IP before connecting to Sinch
   - Confirms IP routing before SMPP protocol negotiation

### Long-term (P2)

7. **Document and codify the working configuration:**
   - Update terraform with proven working NAT setup
   - Add validation tests to prevent future regressions
   - Document Sinch whitelist requirements

8. **Add monitoring alerts:**
   - Alert on SMPP gateway readiness probe failures
   - Alert on vendor connection status = "disconnected"
   - Alert on repeated connection timeout errors

---

## Related Files & Documentation

### Code
- `services/smpp-gateway/` - SMPP gateway Go implementation
- `services/smpp-gateway/internal/connectors/manager.go` - Vendor connection management
- `services/api-gateway/internal/handlers/smpp_proxy.go` - API proxy to SMPP gateway

### Infrastructure
- `infrastructure/terraform/modules/networking/main.tf` - **Modified during troubleshooting**
- `infrastructure/terraform/environments/v01/` - Terraform state location
- `infrastructure/kubernetes/warp/smpp-gateway/` - Kubernetes manifests

### Documentation
- `docs/architecture/GO_SMPP_GATEWAY_ARCHITECTURE.md` - SMPP architecture
- `docs/architecture/ARCHITECTURAL_DECISION_GO_SMPP.md` - Why we built custom gateway
- `docs/warp-services/SMS_ARCHITECTURE.md` - SMS system architecture
- `docs/security/SMS_COMPLIANCE_REQUIREMENTS.md` - 10DLC and compliance

### Database
- **Table:** `messaging.vendors` (SMPP vendor config)
- **Schema:** See `infrastructure/database/schemas/`

---

## GCP Resources Involved

### Networking
- **VPC:** `warp-vpc`
- **Router:** `warp-router` (us-central1)
- **Cloud NAT Gateways:**
  - `warp-nat-gke` (created 2025-11-25)
  - `warp-nat-general` (created 2025-11-25)
- **Static IPs:**
  - `warp-nat-outbound-ip` (34.58.165.135) - Sinch whitelisted ✅
  - `warp-nat-ip-1` (34.57.46.26) - NOT whitelisted ❌
  - `warp-nat-ip-2` (35.223.15.88) - NOT whitelisted ❌
  - `warp-nat-ip-3` (136.111.96.47) - NOT whitelisted ❌

### Compute
- **GKE Cluster:** `warp-cluster` (Autopilot, us-central1)
- **Node Pools:** `default-pool`
- **Subnets:**
  - `warp-gke-subnet` (10.0.0.0/24, pods: 10.1.0.0/16, svc: 10.2.0.0/16)
  - `warp-rtpengine-subnet` (10.0.1.0/24)
  - `warp-consul-subnet` (10.0.2.0/24)

### Services
- **LoadBalancer:** `smpp-gateway-server` (34.55.43.157:2775,2776) - for INBOUND customer connections
- **ClusterIP:** `smpp-gateway-api` (10.2.241.89:8080,9090) - management API

---

## Logs & Monitoring

### Current Pod Logs
```bash
kubectl logs -n messaging -l app=smpp-gateway --tail=100 -f
```

### Cloud Logging Queries
```bash
# SMPP gateway pod logs
gcloud logging read 'resource.type="k8s_container" AND resource.labels.pod_name=~"smpp-gateway"' \
  --limit=50 \
  --format=json

# Cloud NAT logs
gcloud logging read 'resource.type="gce_router" AND resource.labels.router_id="warp-router"' \
  --limit=50 \
  --freshness=30m

# GKE cluster operations
gcloud logging read 'resource.type="gke_cluster" AND resource.labels.cluster_name="warp-cluster"' \
  --limit=20
```

### Metrics to Check
- SMPP gateway readiness probe success rate (currently 0%)
- Network egress bytes from messaging namespace
- Cloud NAT IP allocation/usage
- GKE pod restart count

---

## Contact Information

### Vendor
**Sinch Support:**
- Account: telxMBa1
- Support Portal: (contact info needed)
- Account Manager: (contact info needed)

### Internal
**Original Implementation:** October 2025 sprint
**Last Known Working:** Uncertain - no successful connection logs found
**Current Owner:** WARP Platform Engineering Team

---

## Success Criteria

### Primary Goal
✅ SMPP gateway successfully binds to Sinch Atlanta server

**Expected Log Output:**
```json
{
  "level": "info",
  "message": "SMPP bind successful",
  "vendor": "Sinch_Atlanta",
  "status": "connected"
}
```

### Verification Steps
1. Pod readiness probe passes (1/1 ready)
2. Vendor status shows "connected"
3. Can send test SMS through gateway
4. Receive inbound SMS from Sinch

### Terraform State
- Cloud NAT configuration properly managed in IaC
- No manual infrastructure changes required
- Configuration persists across `terraform apply`

---

## Additional Notes

### IaC Drift Prevention

**This issue was caused by manual infrastructure changes not reflected in terraform.**

**Best Practice Going Forward:**
1. ALL infrastructure changes must be in terraform
2. Never manually modify Cloud NAT/networking without updating `.tf` files
3. Run `terraform plan` before `terraform apply` to review changes
4. Test infrastructure changes in dev environment first

### Related Issues
- None found in GitHub/docs
- First occurrence of this specific SMPP NAT routing problem

### Risk Assessment
- **Service Impact:** SMPP gateway completely non-functional (22+ days)
- **Customer Impact:** Cannot send/receive SMS (if customers exist)
- **Data Loss Risk:** None (no active traffic)
- **Recovery Time:** Estimated 1-4 hours once root cause identified

---

## Appendix: Commands Reference

### Quick Diagnostics
```bash
# Test egress IP
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- curl -s https://api.ipify.org

# Check NAT config
gcloud compute routers nats list --router=warp-router --region=us-central1

# Check GKE SNAT status
gcloud container clusters describe warp-cluster --region=us-central1 \
  --format="value(networkConfig.defaultSnatStatus.disabled)"

# Restart SMPP gateway
kubectl rollout restart deployment/smpp-gateway -n messaging

# Watch logs
kubectl logs -n messaging -l app=smpp-gateway -f
```

### Terraform Operations
```bash
cd infrastructure/terraform/environments/v01

# Plan changes
terraform plan -target=module.networking

# Apply changes
terraform apply -target=module.networking

# Check state
terraform state list | grep nat
terraform state show module.networking.google_compute_router_nat.warp_nat_gke
```

### Database Queries
```bash
# Connect to database
PGPASSWORD='G7$k9mQ2@tR1' psql -h 34.42.208.57 -p 5432 -U warp -d warp

# Check vendor config
SELECT * FROM messaging.vendors WHERE instance_name='Sinch_Atlanta';

# Check for any successful connections
SELECT * FROM messaging.mdrs_recent ORDER BY created_at DESC LIMIT 10;
```

---

**Status:** 🔴 BLOCKED - Awaiting Cloud NAT routing fix
**Next Review:** After senior engineer investigation
**Estimated Resolution:** 1-4 hours (once issue identified)

**Last Updated:** 2025-11-25 23:52:00 UTC
**Updated By:** Claude Code (AI Assistant)
