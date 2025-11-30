# HubSpot Sync Architecture v2.0 - Synchronous CREATE

**Date**: October 12, 2025
**Status**: ✅ **Transactional Sync with Rollback**

---

## 🎯 Key Decisions Implemented

### **1. Synchronous CREATE (Fail-Fast)**

**Rationale**: HubSpot is the **source of truth** for customer data. If we can't create the customer in HubSpot, we shouldn't create it in WARP.

**Flow**:
```
User creates customer in admin portal
  ↓
[START TRANSACTION]
  ↓
Create customer in PostgreSQL (not committed yet)
  ↓
Sync to HubSpot synchronously (WAIT for response)
  ↓
  ├─ HubSpot Success?
  │  ├─ YES → Store HubSpot company ID → COMMIT transaction
  │  └─ NO  → ROLLBACK transaction → Customer NOT created
  ↓
Return detailed error with failed fields
```

**Benefits**:
- ✅ **Guaranteed consistency**: Customer only exists if HubSpot sync succeeds
- ✅ **Immediate feedback**: User knows right away if sync failed
- ✅ **Data integrity**: No orphaned WARP customers without HubSpot records
- ✅ **Detailed errors**: Shows exactly which field(s) failed

**Trade-off**:
- ⏱️ Slower response time (~500ms-2s vs ~100ms)
- ⚠️ Customer creation blocked if HubSpot is down

---

### **2. Async UPDATE (Queue-Based)**

**Rationale**: Updates happen frequently. Blocking every update on HubSpot would slow down operations.

**Flow**:
```
User updates customer
  ↓
Update in PostgreSQL immediately
  ↓
API responds (200 OK) - Fast!
  ↓
[BACKGROUND] Queue for HubSpot sync
  ↓
Within 1 minute: Sync to HubSpot
  ↓
Retry if failed (3 attempts with backoff)
```

**Benefits**:
- ✅ Fast API response
- ✅ Resilient to HubSpot outages
- ✅ Eventual consistency

---

## 🔄 Bidirectional Sync - Your Second Question

**"What happens if a value is changed in HubSpot? How will WARP know?"**

### **Current State**: Outbound Only (WARP → HubSpot)
We currently only sync **WARP → HubSpot**. If someone changes data in HubSpot, WARP doesn't know.

### **Solution**: Inbound Sync (HubSpot → WARP)

Two mechanisms needed:

#### **A. Real-Time Webhooks** (Recommended)

**Setup** (in HubSpot):
```
1. Create Private App webhook subscription
2. Subscribe to: company.propertyChange
3. Webhook URL: https://api.rns.ringer.tel/v1/webhooks/hubspot/company
4. HubSpot sends POST when properties change
```

**Handler Flow**:
```
Sales team changes credit_limit in HubSpot (5000 → 10000)
  ↓
HubSpot sends webhook:
{
  "eventType": "company.propertyChange",
  "objectId": "12345",
  "propertyName": "warp_credit_limit",
  "propertyValue": "10000",
  "occurredAt": 1705503600000
}
  ↓
POST /v1/webhooks/hubspot/company
  ↓
1. Validate signature (HMAC-SHA256)
  ↓
2. Store in hubspot_webhook_events (idempotency)
  ↓
3. Check field mapping:
   - warp_credit_limit → credit_limit
   - Sync direction: BIDIRECTIONAL
   - Conflict resolution: HUBSPOT_WINS
  ↓
4. Update WARP customer:
   UPDATE customers SET credit_limit = 10000 WHERE id = ...
  ↓
5. Log sync in hubspot_sync_log
  ↓
6. Update hubspot_field_state (timestamp tracking)
```

**Implementation Status**:
- ✅ Database tables ready (`hubspot_webhook_events`)
- ✅ Field mapping configured (knows which fields are bidirectional)
- ❌ **Webhook handler NOT implemented yet**
- ❌ **Webhook signature validation NOT implemented**

#### **B. Scheduled Reconciliation** (Safety Net)

**Purpose**: Catch missed webhooks, network failures, or manual HubSpot changes.

**Flow**:
```
Daily at 2 AM:
  ↓
Fetch all customers from WARP
  ↓
Fetch all companies from HubSpot (batch API)
  ↓
For each customer:
  ├─ Compare all bidirectional fields
  ├─ Check timestamps (last_modified_at)
  ├─ Detect conflicts (both changed since last sync)
  └─ Apply conflict resolution:
      - HUBSPOT_WINS → Use HubSpot value
      - WARP_WINS → Use WARP value
      - LATEST_WINS → Compare timestamps
      - MANUAL → Flag for review
  ↓
Update WARP or HubSpot as needed
  ↓
Generate reconciliation report
```

**Implementation Status**:
- ✅ Database table ready (`hubspot_reconciliation_runs`)
- ✅ Conflict detection logic exists
- ❌ **Reconciliation job NOT implemented yet**

---

## 🛡️ Field Conflict Resolution Rules

| Field | Sync Direction | Authority | If Conflict |
|-------|----------------|-----------|-------------|
| `ban` | WARP → HubSpot | WARP ALWAYS | WARP wins |
| `company_name` | Bidirectional | Latest wins | Compare timestamps |
| `status` | WARP → HubSpot | WARP ALWAYS | WARP wins (service status) |
| `credit_limit` | Bidirectional | HubSpot wins | HubSpot overrides WARP |
| `current_balance` | WARP → HubSpot | WARP ALWAYS | Real-time from billing |
| `services` | WARP → HubSpot | WARP ALWAYS | Service config in WARP |
| `contact.email` | Bidirectional | Latest wins | Compare timestamps |

**Immutable Fields** (never change after creation):
- `ban` - Generated once, never changes
- `id` (UUID) - Primary key
- `created_at` - Timestamp

**HubSpot-Controlled** (sales/finance team):
- `credit_limit` - Approved credit line
- `payment_terms` - Contract terms

**WARP-Controlled** (technical):
- `status` - Service operational status
- `current_balance` - Real-time billing
- `services` - Voice/Messaging/Data enabled

---

## 💥 Error Handling Examples

### **Example 1: HubSpot API Down**

```
User creates customer "Acme Corp"
  ↓
Customer created in PostgreSQL (transaction open)
  ↓
Sync to HubSpot...
  ↓
❌ HubSpot API Error: "Service Unavailable (503)"
  ↓
🔄 ROLLBACK transaction
  ↓
User sees error:
{
  "success": false,
  "error": {
    "code": "HUBSPOT_SYNC_FAILED",
    "message": "Customer creation rolled back due to HubSpot sync failure: Failed to create HubSpot company. Failed fields: [hubspot_api: Service Unavailable (503)]"
  }
}
```

**Result**: Customer NOT created in WARP. User can retry when HubSpot is back online.

### **Example 2: Invalid Field Value**

```
User creates customer with invalid data
  ↓
Customer created in PostgreSQL
  ↓
Sync to HubSpot...
  ↓
❌ HubSpot rejects: "Invalid property value for 'warp_credit_limit'"
  ↓
🔄 ROLLBACK transaction
  ↓
User sees error:
{
  "error": {
    "code": "HUBSPOT_SYNC_FAILED",
    "message": "Customer creation rolled back. Failed fields: [credit_limit: Invalid property value]"
  }
}
```

**Result**: Customer NOT created. User can fix validation and retry.

### **Example 3: Success**

```
User creates customer "Acme Corp"
  ↓
Customer created in PostgreSQL (ID: uuid-123)
  ↓
Sync to HubSpot... ✅
  ↓
HubSpot company created (ID: 987654)
  ↓
Store HubSpot ID in customer.external_ids
  ↓
✅ COMMIT transaction
  ↓
User sees success:
{
  "success": true,
  "data": {
    "customer": {
      "id": "uuid-123",
      "ban": "ZT-487392012",
      "company_name": "Acme Corp",
      "external_ids": {
        "hubspot_company_id": "987654"
      }
    },
    "hubspot_sync": {
      "success": true,
      "hubspot_company_id": "987654",
      "fields_synced": ["company_name", "ban", "status", "credit_limit"],
      "message": "Customer synced successfully"
    }
  }
}
```

---

## 🚀 Next: Implement Inbound Sync

### **Phase 1: Webhook Handler** (2-3 hours)

**Files to create**:
1. `internal/handlers/hubspot_webhook.go`
2. `internal/hubspot/webhook_processor.go`
3. `internal/hubspot/signature_validator.go`

**Endpoints**:
```
POST /v1/webhooks/hubspot/company
  - Validate HMAC-SHA256 signature
  - Parse property change event
  - Check field mapping
  - Update WARP customer
  - Detect conflicts
```

**HubSpot Setup**:
```
Settings → Integrations → Private Apps → Your App → Webhooks
  - Subscribe to: company.propertyChange
  - Target URL: https://api.rns.ringer.tel/v1/webhooks/hubspot/company
  - Get webhook secret for signature validation
```

### **Phase 2: Conflict Detection** (1 hour)

When both systems change the same field:
```
9:00 AM - User updates company_name in WARP to "Acme Corporation"
9:05 AM - Sales rep updates company_name in HubSpot to "Acme Corp Inc"
  ↓
Webhook received
  ↓
Conflict detected (both modified since last sync)
  ↓
Apply resolution strategy:
  - LATEST_WINS → HubSpot value used (9:05 > 9:00)
  - Update WARP → "Acme Corp Inc"
  - Log conflict in hubspot_sync_log
```

### **Phase 3: Reconciliation Job** (2 hours)

Daily full sync to catch any drift:
```
Kubernetes CronJob (2 AM daily)
  ↓
Compare all WARP customers vs HubSpot companies
  ↓
Find mismatches
  ↓
Apply sync rules
  ↓
Generate report (email to admins)
```

---

## 📊 Current State Summary

**Outbound Sync (WARP → HubSpot)**:
- ✅ **CREATE**: Synchronous, transactional, rollback on failure
- ✅ **UPDATE**: Async queue-based with retry
- ✅ Field-level granularity
- ✅ Detailed error reporting
- ✅ Full audit logging

**Inbound Sync (HubSpot → WARP)**:
- ⏳ **Webhooks**: Database ready, handler not implemented
- ⏳ **Reconciliation**: Database ready, job not implemented
- ⏳ **Conflict detection**: Logic exists, UI missing

**Database**:
- ✅ All sync tables created
- ✅ Field mapping configured
- ✅ Queue processing working

**API**:
- ✅ Manual sync endpoints
- ✅ Queue processor running (every 1 min)
- ✅ Rate limiting active (100 req/10s)

---

## 🧪 Testing Synchronous CREATE

**Test 1: Success Case**

1. Create customer in admin portal
2. Watch logs:
   ```bash
   kubectl logs -n warp-api deployment/api-gateway | grep "Creating customer with synchronous"
   ```
3. Should see: "Customer created and synced to HubSpot successfully"
4. Check HubSpot CRM - company appears immediately
5. Check `external_ids` - contains HubSpot company ID

**Test 2: Rollback Case**

To test rollback, temporarily break HubSpot API:
1. Set invalid API key in K8s secret
2. Try to create customer
3. Should see error: "Customer creation rolled back due to HubSpot sync failure"
4. Check database - customer should NOT exist
5. Restore API key and retry - works!

**Test 3: Field Validation**

If HubSpot rejects a field value:
- Error message shows which field failed
- Customer not created in WARP
- User can fix and retry

---

## ⚠️ Critical Gap: Inbound Sync

**Your Question**: "What happens if the value is changed in HubSpot?"

**Current Answer**: Nothing - WARP doesn't know yet.

**To Fix**: Implement webhook handler (3-4 hours of work).

Would you like me to implement the webhook handler next? This will complete the bidirectional sync and ensure changes in HubSpot automatically update WARP.

---

**Status**: v2.0.0 deployed with synchronous CREATE + transactional rollback! 🚀
