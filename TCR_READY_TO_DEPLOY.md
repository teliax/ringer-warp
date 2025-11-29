# TCR 10DLC Integration - READY TO DEPLOY! 🚀

**Date**: 2025-11-26
**Status**: ✅ **COMPLETE - Ready for Deployment**

---

## ✅ DEPLOYMENT CHECKLIST

### 1. Database ✅
- [x] Schema migration 13 created (`13-tcr-10dlc-integration.sql`)
- [x] 5 tables, 2 views, triggers created
- [x] Applied to production database
- [x] Verified tables exist

### 2. Permissions ✅
- [x] Permission migration 14 created (`14-tcr-permissions.sql`)
- [x] 10 permission entries added
- [x] Permissions granted to 6 user types
- [x] Applied to production database
- [x] Verified permissions exist

### 3. Code Implementation ✅
- [x] TCR API client library (5 files, ~1,200 lines)
- [x] Repository layer (2 files, ~800 lines)
- [x] API models (~300 lines)
- [x] API handlers (3 files, ~1,100 lines)
- [x] Routes registered in main.go
- [x] 19 API endpoints implemented

### 4. Credentials ✅
- [x] TCR API Key set: `D9B996E41EFB423B8D3E262BD545B3F2`
- [x] TCR API Secret set (same as key for now)
- [x] Sandbox mode enabled (TCR_SANDBOX=true)
- [x] Secrets created in Google Secret Manager:
  - `tcr-api-key`
  - `tcr-api-secret`
  - `tcr-sandbox`

### 5. Kubernetes Configuration ✅
- [x] Deployment updated (`services/api-gateway/deployments/kubernetes/deployment.yaml`)
- [x] Secrets added to api-gateway-secrets
- [x] Environment variables configured:
  - TCR_API_KEY
  - TCR_API_SECRET
  - TCR_SANDBOX

---

## 🚀 DEPLOYMENT COMMAND

You're ready to deploy! Run this command:

```bash
# Apply the updated deployment
kubectl apply -f services/api-gateway/deployments/kubernetes/deployment.yaml

# Wait for rollout to complete
kubectl rollout status deployment/api-gateway -n warp-api

# Check that pods are running
kubectl get pods -n warp-api -l app=api-gateway

# Check logs for TCR initialization
kubectl logs -n warp-api -l app=api-gateway --tail=50 | grep TCR
```

**Expected log output**:
```
✅ Connected to PostgreSQL database
✅ Connected to Redis
✅ TCR client initialized (SANDBOX MODE)  <-- This confirms TCR is enabled!
Starting API server on port 8080
```

---

## 🧪 TESTING THE INTEGRATION

### Step 1: Get Your JWT Token

```bash
# Set your JWT token (from Google OAuth login)
export TOKEN="your_jwt_token_here"
export API_URL="https://api.rns.ringer.tel"
```

### Step 2: Test Enumeration Endpoints (No Customer Required)

```bash
# Get available use cases
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/use-cases" | jq '.data | length'
# Expected: 10-15 use cases

# Get entity types
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/entity-types" | jq
# Expected: PRIVATE_PROFIT, PUBLIC_PROFIT, NON_PROFIT, etc.

# Get verticals
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/verticals" | jq '.data | .[0:3]'
# Expected: TECHNOLOGY, RETAIL, HEALTHCARE, etc.

# Get carriers
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/carriers" | jq
# Expected: T-Mobile, AT&T, Verizon

# Get throughput estimate
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/throughput-estimate?trust_score=75&vetted=false" | jq
# Expected: messages_per_second, daily_cap, recommendation
```

### Step 3: Test Brand Creation

```bash
curl -X POST "$API_URL/v1/messaging/brands" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Test Company",
    "legal_name": "Test Company LLC",
    "entity_type": "PRIVATE_PROFIT",
    "email": "contact@testcompany.com",
    "phone": "+15551234567",
    "country": "US",
    "state": "NY",
    "city": "New York",
    "street": "123 Test St",
    "postal_code": "10001",
    "vertical": "TECHNOLOGY",
    "website": "https://testcompany.com"
  }' | jq
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "brand": {
      "id": "uuid-here",
      "display_name": "Test Company",
      "status": "PENDING",
      "entity_type": "PRIVATE_PROFIT",
      ...
    },
    "message": "Brand submitted to TCR for registration. Status will be updated once processed."
  }
}
```

### Step 4: List Brands

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/brands" | jq '.data.items | length'
# Expected: Count of brands (should include the one you just created)
```

### Step 5: Monitor Brand Status

The brand will be submitted to TCR asynchronously. Check the database to see when it gets a TCR brand ID:

```bash
# Check brand status in database
PGPASSWORD='G7$k9mQ2@tR1' psql -h 34.42.208.57 -p 5432 -U warp_app -d warp << 'SQL'
SELECT id, display_name, tcr_brand_id, status, trust_score, created_at
FROM messaging.brands_10dlc
ORDER BY created_at DESC
LIMIT 5;
SQL
```

---

## 📊 WHAT HAPPENS NEXT?

### Async Brand Registration Flow

1. **Immediate** (within 1 second):
   - Brand saved to local database with status='PENDING'
   - API returns success response to user
   - Background goroutine starts

2. **Background** (within 5-30 seconds):
   - Brand data submitted to TCR API
   - TCR validates the information
   - TCR assigns brand ID and trust score
   - Local database updated with TCR response

3. **Eventually** (TCR-dependent timing):
   - Brand status changes from PENDING to VERIFIED/UNVERIFIED
   - Trust score assigned (0-100)
   - Can now create campaigns

### Brand Status Meanings

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `PENDING` | Saved locally, not yet submitted to TCR | Wait for background job |
| `REGISTERED` | Submitted to TCR, awaiting verification | Wait for TCR review |
| `UNVERIFIED` | TCR processed but no proof provided | Can create campaigns (low throughput) |
| `VERIFIED` | Automatically verified (stock symbol, etc.) | Can create campaigns (high throughput) |
| `VETTED_VERIFIED` | Externally vetted by AEGIS/WMC | Can create campaigns (highest throughput) |
| `FAILED` | TCR submission error | Check logs, fix data, retry |

---

## 🔍 TROUBLESHOOTING

### Issue: "TCR client disabled" in Logs

**Cause**: Environment variables not loaded

**Solution**:
```bash
# Verify secrets exist
kubectl get secret api-gateway-secrets -n warp-api -o yaml | grep TCR

# Check environment variables in pod
kubectl exec -n warp-api $(kubectl get pods -n warp-api -l app=api-gateway -o name | head -1) -- env | grep TCR
```

### Issue: Brand Stays in PENDING Forever

**Cause**: TCR API submission failed

**Solution**:
```bash
# Check API Gateway logs for errors
kubectl logs -n warp-api -l app=api-gateway --tail=200 | grep -A5 "TCR"

# Common errors:
# - "401 Unauthorized" → Check TCR_API_KEY/SECRET are correct
# - "400 Bad Request" → Check brand data validation
# - "Network error" → Check firewall/egress rules
```

### Issue: "Access Denied" on TCR Endpoints

**Cause**: User doesn't have permission

**Solution**:
```bash
# Check user permissions
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/gatekeeper/my-permissions" | jq '.data | .[] | select(.resource_path | contains("messaging"))'

# Expected: You should see /api/v1/messaging/* permissions
```

### Issue: 404 Not Found on /v1/messaging/*

**Cause**: Routes not registered (TCR client initialization failed)

**Solution**:
```bash
# Check if TCR client initialized successfully
kubectl logs -n warp-api -l app=api-gateway --tail=100 | grep -E "(TCR|messaging)"

# If you see "TCR client disabled", check credentials
```

---

## 🎯 SUCCESS CRITERIA

You'll know the deployment is successful when:

✅ **Logs show**: "✅ TCR client initialized (SANDBOX MODE)"
✅ **Enumeration endpoints work**: GET /v1/messaging/use-cases returns data
✅ **Can create brand**: POST /v1/messaging/brands returns success
✅ **Brand gets TCR ID**: Check database after 30 seconds, tcr_brand_id should be populated
✅ **No errors in logs**: No TCR-related errors in API Gateway logs

---

## 📈 NEXT STEPS (After Deployment)

### 1. Test Complete Brand Flow

1. Create a brand (done above)
2. Wait for TCR verification (~30 seconds - 5 minutes)
3. Check trust score assignment
4. Request external vetting (optional, costs $40-$500)

### 2. Test Campaign Creation

Once you have a brand with `tcr_brand_id` populated:

```bash
BRAND_ID="uuid-from-list-brands"

curl -X POST "$API_URL/v1/messaging/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_id": "'$BRAND_ID'",
    "use_case": "ACCOUNT_NOTIFICATION",
    "description": "Account notifications for security alerts, balance updates, and account changes.",
    "message_flow": "User creates account, receives confirmation, subscribes to alerts, gets notifications.",
    "sample_messages": [
      "Test Co Alert: Password changed. Call 1-800-555-0123 if not you.",
      "Test Co: Balance is $5.23. Add funds at testco.com",
      "Test Co: New login from NY. Reply STOP to unsubscribe"
    ],
    "subscriber_optin": false,
    "subscriber_optout": true,
    "subscriber_help": true,
    "optout_keywords": "STOP,CANCEL",
    "help_keywords": "HELP,INFO",
    "embedded_link": true,
    "embedded_phone": true,
    "auto_renewal": true
  }' | jq
```

### 3. Monitor MNO Status

After campaign creation, check per-carrier approval:

```bash
CAMPAIGN_ID="uuid-from-create-campaign"

curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/campaigns/$CAMPAIGN_ID/mno-status" | jq
```

**Expected**: Status for T-Mobile, AT&T, Verizon (REGISTERED, REVIEW, REJECTED, etc.)

### 4. Assign Phone Numbers

Once campaign is approved:

```bash
curl -X POST "$API_URL/v1/messaging/campaigns/$CAMPAIGN_ID/numbers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_numbers": ["+13035551234", "+13035555678"]
  }' | jq
```

### 5. Switch to Production Mode

When ready for production:

```bash
# Update deployment.yaml
# Change: TCR_SANDBOX: "true"
# To:     TCR_SANDBOX: "false"

# Get production TCR API credentials
# Update api-gateway-secrets with production keys

# Redeploy
kubectl apply -f services/api-gateway/deployments/kubernetes/deployment.yaml
```

---

## 📚 DOCUMENTATION

- **[TCR_DEPLOYMENT_READY.md](TCR_DEPLOYMENT_READY.md)** - Complete deployment guide
- **[docs/integrations/TCR_10DLC_INTEGRATION.md](docs/integrations/TCR_10DLC_INTEGRATION.md)** - Full specification
- **[TCR_INTEGRATION_NEXT_STEPS.md](TCR_INTEGRATION_NEXT_STEPS.md)** - Next phase planning

---

## ⚠️ IMPORTANT NOTES

### About the API Secret

The current setup uses the same value for both `TCR_API_KEY` and `TCR_API_SECRET`. According to TCR documentation, they should use Basic Auth with separate key and secret values.

**Action Required**:
- Contact TCR support or check your dashboard for the separate API Secret
- Update the secret once you have it:

```bash
# Update the secret value
echo -n "your_actual_tcr_secret" | gcloud secrets versions add tcr-api-secret --data-file=-

# Update Kubernetes secret
kubectl edit secret api-gateway-secrets -n warp-api
# Update the TCR_API_SECRET value
```

### About Sandbox vs Production

- **Sandbox Mode** (`TCR_SANDBOX=true`):
  - Test environment
  - Mock registrations
  - No real carrier submissions
  - Free to use
  - Brand/campaign IDs may not be real

- **Production Mode** (`TCR_SANDBOX=false`):
  - Live environment
  - Real TCR submissions
  - Actual carrier approval required
  - Costs apply ($4/brand, $10-40/campaign/quarter)
  - Messages delivered to real phones

**Start with sandbox** to test the integration, then switch to production when ready!

---

## 🎉 SUMMARY

**What's Ready**:
- ✅ Complete backend implementation (3,400+ lines of code)
- ✅ 19 API endpoints
- ✅ Database schema (5 tables)
- ✅ Permissions (10 entries, 6 user types)
- ✅ TCR API credentials configured
- ✅ Kubernetes deployment updated
- ✅ Ready to deploy!

**Deploy Command**:
```bash
kubectl apply -f services/api-gateway/deployments/kubernetes/deployment.yaml
```

**Time to Deploy**: ~5 minutes (rolling update)

**First Test**: `curl https://api.rns.ringer.tel/v1/messaging/use-cases -H "Authorization: Bearer $TOKEN"`

🚀 **You're ready to go!**
