# HubSpot Bidirectional Sync - Setup Guide

**Date**: October 12, 2025
**API Version**: v2.1.0
**Status**: ✅ **Bidirectional Sync Ready**

---

## ✅ What's Deployed

### **Outbound Sync (WARP → HubSpot)**
- ✅ **CREATE**: Synchronous with transactional rollback
- ✅ **UPDATE**: Async queue-based with retry
- ✅ Auto-sync on all CRUD operations
- ✅ Background queue processor (runs every 1 minute)

### **Inbound Sync (HubSpot → WARP)**
- ✅ **Webhook handler**: `POST /webhooks/hubspot/company`
- ✅ **Signature validation**: HMAC-SHA256
- ✅ **Property change processing**: Updates WARP when HubSpot changes
- ✅ **Conflict detection**: Timestamps + resolution rules
- ✅ **Idempotency**: Duplicate events ignored

---

## 🔧 HubSpot Configuration Steps

### **Step 1: Get Webhook Secret**

1. Go to **HubSpot Settings** → **Integrations** → **Private Apps**
2. Click your private app (or create one if you haven't)
3. Go to **Webhooks** tab
4. Copy the **Client Secret** (this is your webhook secret)

### **Step 2: Update Kubernetes Secret**

```bash
# Update the webhook secret in deployment
kubectl edit secret api-gateway-secrets -n warp-api

# Find this line:
HUBSPOT_WEBHOOK_SECRET: "your-webhook-secret-from-hubspot"

# Replace with your actual secret from HubSpot
HUBSPOT_WEBHOOK_SECRET: "your-actual-secret-here"
```

Or use kubectl:
```bash
kubectl patch secret api-gateway-secrets -n warp-api \
  --type='json' \
  -p='[{"op": "replace", "path": "/data/HUBSPOT_WEBHOOK_SECRET", "value":"'$(echo -n "YOUR_SECRET" | base64)'"}]'

# Restart pods to pick up new secret
kubectl rollout restart deployment/api-gateway -n warp-api
```

### **Step 3: Subscribe to Webhooks in HubSpot**

1. In HubSpot Private App → **Webhooks** tab
2. Click **"Subscribe to events"**
3. **Target URL**: `https://api.rns.ringer.tel/webhooks/hubspot/company`
4. **Subscribe to these events**:
   - `company.propertyChange` ✅ (REQUIRED)
   - `company.creation` (optional - logged but ignored)
   - `company.deletion` (optional - flagged for review)

5. Click **"Create subscription"**

### **Step 4: Create Custom Properties in HubSpot**

HubSpot needs custom properties to store WARP data:

**Navigate to**: Settings → Data Management → Properties → Company Properties

**Create these custom properties**:

| Property Name | Field Type | Description |
|---------------|------------|-------------|
| `warp_ban` | Single-line text | Billing Account Number (auto-generated) |
| `warp_status` | Dropdown | Service status (ACTIVE, SUSPENDED, TRIAL, CLOSED) |
| `warp_customer_type` | Dropdown | Customer type (PREPAID, POSTPAID, RESELLER) |
| `warp_credit_limit` | Number | Maximum credit allowed |
| `warp_current_balance` | Number | Real-time account balance |
| `warp_prepaid_balance` | Number | Prepaid balance |
| `warp_payment_terms` | Number | Payment terms in days (e.g., 30 for NET30) |
| `warp_billing_cycle` | Dropdown | Billing cycle (MONTHLY, QUARTERLY, ANNUAL) |
| `warp_services_voice` | Checkbox | Voice services enabled |
| `warp_services_messaging` | Checkbox | Messaging services enabled |
| `warp_services_data` | Checkbox | Telecom data services enabled |

**Dropdown values for `warp_status`**:
- ACTIVE
- SUSPENDED
- TRIAL
- CLOSED

**Dropdown values for `warp_customer_type`**:
- PREPAID
- POSTPAID
- RESELLER

**Dropdown values for `warp_billing_cycle`**:
- MONTHLY
- QUARTERLY
- ANNUAL

---

## 🧪 Testing Bidirectional Sync

### **Test 1: Outbound (WARP → HubSpot)**

1. **Create customer** in WARP admin portal:
   ```
   Company: Test Corp
   Type: POSTPAID
   Email: test@testcorp.com
   Credit Limit: $10,000
   Services: Voice ✓, Messaging ✓
   ```

2. **Check WARP logs**:
   ```bash
   kubectl logs -n warp-api deployment/api-gateway | grep "Creating customer with synchronous"
   ```

3. **Check HubSpot** (within seconds):
   - Go to Contacts → Companies
   - Search for "Test Corp"
   - Verify custom properties:
     - `warp_ban`: Should have auto-generated value (e.g., "ZT-487392012")
     - `warp_status`: ACTIVE
     - `warp_credit_limit`: 10000
     - `warp_services_voice`: true
     - `warp_services_messaging`: true

4. **Verify database**:
   ```sql
   SELECT ban, company_name, external_ids->>'hubspot_company_id' as hubspot_id
   FROM accounts.customers
   WHERE company_name = 'Test Corp';

   -- Check sync log
   SELECT operation, direction, status, fields_synced, completed_at
   FROM accounts.hubspot_sync_log
   ORDER BY started_at DESC LIMIT 1;
   ```

### **Test 2: Inbound (HubSpot → WARP)**

1. **Find the test company** in HubSpot CRM

2. **Change a bidirectional field**:
   - Edit `warp_credit_limit` from 10,000 to 15,000
   - Save

3. **HubSpot sends webhook** to: `https://api.rns.ringer.tel/webhooks/hubspot/company`

4. **Check WARP logs**:
   ```bash
   kubectl logs -n warp-api deployment/api-gateway | grep "Received HubSpot webhook"
   ```

5. **Verify WARP updated** (within seconds):
   ```sql
   SELECT company_name, credit_limit
   FROM accounts.customers
   WHERE company_name = 'Test Corp';
   -- credit_limit should now be 15000

   -- Check sync log
   SELECT operation, direction, status, fields_synced
   FROM accounts.hubspot_sync_log
   WHERE direction = 'HUBSPOT_TO_WARP'
   ORDER BY started_at DESC LIMIT 1;

   -- Check field state
   SELECT field_name, warp_value, hubspot_value, last_synced_direction
   FROM accounts.hubspot_field_state
   WHERE entity_id IN (SELECT id FROM accounts.customers WHERE company_name = 'Test Corp');
   ```

### **Test 3: Conflict Detection**

1. **Edit credit_limit in WARP** (e.g., change to $12,000) - DO NOT SAVE YET
2. **Edit `warp_credit_limit` in HubSpot** at the same time (e.g., change to $18,000)
3. **Save HubSpot first** → Webhook arrives
4. **Save WARP second** → Triggers outbound sync
5. **Check conflict**:
   ```sql
   SELECT field_name, is_in_conflict, conflict_detected_at
   FROM accounts.hubspot_field_state
   WHERE is_in_conflict = TRUE;
   ```

6. **Result** (based on conflict_resolution = HUBSPOT_WINS for credit_limit):
   - Final value: $18,000 (HubSpot wins)
   - Conflict logged

---

## 📊 Field Sync Directions

| Field | WARP → HubSpot | HubSpot → WARP | Conflict Resolution |
|-------|----------------|----------------|---------------------|
| `ban` | ✅ | ❌ | WARP_WINS (immutable) |
| `company_name` | ✅ | ✅ | LATEST_WINS |
| `status` | ✅ | ❌ | WARP_WINS (operational) |
| `customer_type` | ✅ | ❌ | WARP_WINS (immutable) |
| `credit_limit` | ✅ | ✅ | HUBSPOT_WINS (finance) |
| `current_balance` | ✅ | ❌ | WARP_WINS (real-time) |
| `payment_terms` | ✅ | ✅ | HUBSPOT_WINS (contract) |
| `billing_cycle` | ✅ | ✅ | HUBSPOT_WINS (contract) |
| `services.*` | ✅ | ❌ | WARP_WINS (technical) |
| `contact.email` | ✅ | ✅ | LATEST_WINS |

**Legend**:
- ✅ = Syncs in this direction
- ❌ = Does not sync

---

## 🚨 Troubleshooting

### **Webhook Not Receiving Events**

**Check**:
```bash
# View webhook logs
kubectl logs -n warp-api deployment/api-gateway | grep webhook

# Test webhook endpoint is accessible
curl -X POST https://api.rns.ringer.tel/webhooks/hubspot/company \
  -H "Content-Type: application/json" \
  -d '[{"eventId":"test"}]'

# Should return 401 (invalid signature) - confirms endpoint is reachable
```

**Verify in HubSpot**:
- Settings → Private Apps → Your App → Webhooks
- Check "Recent webhook attempts"
- Look for failed deliveries

### **Webhook Signature Validation Failing**

**Issue**: `Invalid signature` error in logs

**Fix**:
1. Verify webhook secret matches HubSpot
2. Check secret is base64 encoded correctly in K8s
3. Restart pods after secret update

### **Customer Not Syncing to HubSpot**

**Check sync queue**:
```sql
SELECT id, entity_id, operation, status, retry_count, last_error
FROM accounts.hubspot_sync_queue
WHERE status != 'COMPLETED'
ORDER BY created_at DESC;
```

**Check sync logs**:
```sql
SELECT operation, status, error_message, fields_synced
FROM accounts.hubspot_sync_log
WHERE status = 'FAILED'
ORDER BY started_at DESC LIMIT 10;
```

**Manual retry**:
```bash
# Trigger queue processing manually
curl -X POST http://api.rns.ringer.tel/v1/sync/process-queue \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 📋 Next Steps

### **1. Get Webhook Secret from HubSpot** (5 mins)
- Follow Step 1 & 2 above
- Update K8s secret
- Restart pods

### **2. Configure Webhook Subscription** (5 mins)
- Follow Step 3 above
- Subscribe to `company.propertyChange`

### **3. Create Custom Properties** (15 mins)
- Follow Step 4 above
- Create all `warp_*` properties

### **4. Test End-to-End** (10 mins)
- Create customer in WARP
- Verify appears in HubSpot
- Change value in HubSpot
- Verify updates in WARP

---

## 🎯 Current System Capabilities

**You can now**:
- ✅ Create customers in WARP → Auto-syncs to HubSpot
- ✅ Update customers in WARP → Auto-syncs to HubSpot
- ✅ Change properties in HubSpot → Auto-updates WARP (once webhooks configured)
- ✅ Conflict detection with smart resolution
- ✅ Full audit trail of all syncs
- ✅ Rollback if HubSpot sync fails on CREATE

**Webhook URL for HubSpot**:
```
https://api.rns.ringer.tel/webhooks/hubspot/company
```

---

**Status**: v2.1.0 deployed with full bidirectional sync! Configure HubSpot webhooks to complete the loop. 🎉
