# SMS Vendor Schema Consolidation - Status Report

## 🎯 **Objective**

Migrate go-smpp gateway from `vendor_mgmt.service_providers` to the new `messaging.vendors` table for a unified, extensible architecture.

---

## ✅ **What's Been Completed**

### **1. Analyzed Existing Data**
**Retrieved from `vendor_mgmt.service_providers`:**
```
Sinch_Atlanta vendor:
  id: 9e22660d-6f2e-4761-8729-f4272d30eb71
  host: msgbrokersmpp-atl.inteliquent.com
  port: 3601
  use_tls: true
  bind_type: transceiver
  username: telxMBa1
  password: 7C8Rx9{A
  system_type: cp
  throughput: 100
```

### **2. Analyzed go-smpp Code Dependencies**
**Files that query `vendor_mgmt.service_providers`:**
- `internal/connectors/manager.go:59` - LoadVendors()
- `internal/connectors/manager.go:208` - ReconnectVendor()
- `internal/routing/router.go:45` - RouteMessage()

**go-smpp expects these columns:**
- id, instance_name, display_name
- host, port, use_tls, bind_type
- username, password, system_type
- throughput, priority, is_primary, is_active

### **3. Created Unified Table Structure**
**Created:** `infrastructure/database/schemas/02-migrate-messaging-vendors.sql`

**New `messaging.vendors` table:**
- ✅ Matches all go-smpp required columns (no JSONB complexity)
- ✅ Extensible with additional fields (sms_rate, supports_sms, etc.)
- ✅ Compatible with both go-smpp and API gateway

### **4. Updated All go-smpp Code**
**Modified files:**
- ✅ `internal/connectors/manager.go` - Changed 2 queries to use `messaging.vendors`
- ✅ `internal/routing/router.go` - Changed query to use `messaging.vendors`

### **5. Rebuilt go-smpp**
- ✅ Built successfully: `smpp-gateway:v1.1.0`
- ✅ Pushed to Artifact Registry

---

## ⚠️ **Current Blocker: Database Permissions**

**Problem:**
- `messaging` schema was created by `warp_app` user
- `warp` user (used by go-smpp) doesn't have INSERT permission on `messaging` schema
- Password authentication issues preventing migration

**What needs to happen:**
1. Grant `warp` user access to `messaging` schema
2. Insert Sinch_Atlanta data into `messaging.vendors`
3. Deploy new go-smpp v1.1.0
4. Test Sinch connection

---

## 🔧 **Solution: Grant Permissions**

**SQL to run as postgres superuser or warp_app:**

```sql
-- Grant warp user access to messaging schema
GRANT USAGE ON SCHEMA messaging TO warp;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA messaging TO warp;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA messaging TO warp;

-- Also grant for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA messaging
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO warp;
```

Then insert the vendor data:

```sql
INSERT INTO messaging.vendors (
    id, provider_type, instance_name, display_name,
    host, port, use_tls, bind_type,
    username, password, system_type,
    throughput, priority, is_primary, is_active
) VALUES (
    '9e22660d-6f2e-4761-8729-f4272d30eb71'::uuid,
    'smpp', 'Sinch_Atlanta', 'Sinch Atlanta',
    'msgbrokersmpp-atl.inteliquent.com', 3601, true, 'transceiver',
    'telxMBa1', '7C8Rx9{A', 'cp',
    100, 2, false, true
)
ON CONFLICT (instance_name) DO NOTHING;
```

---

## 📋 **Complete Migration Steps**

### **Step 1: Grant Database Permissions**

Using Cloud SQL console or `postgres` superuser:

```bash
gcloud sql connect warp-db --user=postgres --project=ringer-warp-v01

# Then run:
GRANT USAGE ON SCHEMA messaging TO warp;
GRANT ALL ON ALL TABLES IN SCHEMA messaging TO warp;
ALTER DEFAULT PRIVILEGES IN SCHEMA messaging GRANT ALL ON TABLES TO warp;
```

### **Step 2: Insert Vendor Data**

Run: `infrastructure/database/schemas/03-insert-sinch-vendor.sql`

### **Step 3: Deploy New go-smpp**

```bash
cd /home/daldworth/repos/ringer-warp/services/smpp-gateway

# Update deployment to use v1.1.0
kubectl set image deployment/smpp-gateway -n messaging \
  smpp-gateway=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/smpp-gateway:v1.1.0

# Watch rollout
kubectl rollout status deployment/smpp-gateway -n messaging
```

### **Step 4: Verify Connection**

```bash
# Check logs
kubectl logs -n messaging -l app=smpp-gateway --tail=50

# Check vendor status
kubectl exec -n messaging deployment/smpp-gateway -- \
  wget -qO- http://localhost:8080/api/v1/vendors

# Should show Sinch_Atlanta connected
```

---

## 📊 **Files Modified**

```
services/smpp-gateway/
  ├── internal/connectors/manager.go    ✅ Updated (2 queries)
  └── internal/routing/router.go        ✅ Updated (1 query)

infrastructure/database/schemas/
  ├── 02-migrate-messaging-vendors.sql  ✅ Created (table structure)
  └── 03-insert-sinch-vendor.sql        ✅ Created (data migration)
```

---

## ✅ **Once Permissions Are Fixed**

The migration is straightforward:
1. Run permission grants (1 minute)
2. Insert vendor data (1 minute)
3. Deploy smpp-gateway:v1.1.0 (2 minutes)
4. Test connection (1 minute)

**Total: ~5 minutes**

---

## 🎯 **Why This Matters**

**Before (Fragmented):**
```
go-smpp → vendor_mgmt.service_providers (old)
API Gateway → messaging.vendors (new, empty)
Admin Portal → Can't manage SMS vendors
```

**After (Unified):**
```
go-smpp → messaging.vendors (new schema)
API Gateway → messaging.vendors (same table)
Admin Portal → Can manage SMS vendors via API
```

**Benefits:**
- ✅ Single source of truth for SMS vendors
- ✅ Admin portal can CRUD SMS vendors
- ✅ Extensible schema for future growth
- ✅ Both services use same data

---

**Status:** Code changes complete, waiting on database permissions to complete migration
