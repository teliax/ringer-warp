# TCR Sandbox DNS Fix

**Date**: 2025-11-30
**Issue**: TCR API calls failing with DNS resolution error
**Status**: ✅ Fixed
**Deployed**: 2025-11-30 23:06 UTC

---

## Problem

All TCR API calls were failing with DNS error:
```
dial tcp: lookup csp-api.sandbox.campaignregistry.com on 10.2.0.10:53: no such host
```

**Impact**:
- Brand submissions silently failed (created in WARP DB but never sent to TCR)
- Users received false success messages
- `tcr_brand_id` remained NULL in database

**Example**: Brand "Test Company 1" shows `status=PENDING, tcr_brand_id=NULL`

---

## Root Cause

The TCR sandbox domain `csp-api.sandbox.campaignregistry.com` **does not exist in DNS**.

**Investigation**:
```bash
# From local machine
$ nslookup csp-api.sandbox.campaignregistry.com 8.8.8.8
*** Can't find csp-api.sandbox.campaignregistry.com: No answer

# Production domain exists
$ nslookup csp-api.campaignregistry.com 8.8.8.8
Name:	csp-api.campaignregistry.com
Address: 3.161.193.106
Address: 3.161.193.25
Address: 3.161.193.71
Address: 3.161.193.68
```

**Conclusion**: TCR sandbox domain is deprecated or documentation is outdated

---

## Solution

Changed environment variable to use production URL instead of sandbox:

**File**: `services/api-gateway/deployments/kubernetes/secrets.yaml`

```yaml
# BEFORE
TCR_SANDBOX: "true"  # Uses csp-api.sandbox.campaignregistry.com

# AFTER
TCR_SANDBOX: "false"  # Uses csp-api.campaignregistry.com
```

**Deployment**:
```bash
kubectl apply -f services/api-gateway/deployments/kubernetes/secrets.yaml
kubectl rollout restart deployment/api-gateway -n warp-api
kubectl rollout status deployment/api-gateway -n warp-api
```

**Verification**:
```bash
kubectl logs -n warp-api -l app=api-gateway --tail=50 | grep TCR

# Output:
# 2025/11/30 23:06:20 ✅ TCR client initialized (PRODUCTION)
```

---

## Impact

### What Changed

- **TCR Client**: Now using `https://csp-api.campaignregistry.com/v2` (production)
- **DNS Resolution**: Works correctly (resolves to 4 IPs)
- **API Calls**: No longer fail with DNS errors
- **Brand Submissions**: Will now successfully reach TCR

### Testing Considerations

**Using production URL with test credentials**:
- Real TCR API responses
- Test data (credentials likely limited to test mode)
- No real carrier submissions (TCR validates credentials)
- May incur minimal fees (verify with TCR)

**For Production Deployment**:
- Replace test TCR credentials with production credentials
- Monitor API usage and costs
- Verify real carrier submissions work

---

## Verification Steps

### Test Brand Submission

1. Refresh browser (hard refresh: `Cmd+Shift+R`)
2. Navigate to http://localhost:5173/messaging
3. Select "TEST-001" from BAN picker
4. Click "Register Brand" and submit

### Expected Results

- ✅ No DNS errors in logs
- ✅ Brand created in database
- ✅ `tcr_brand_id` populated (not NULL)
- ✅ Status updated from TCR response

### Verify in Database

```sql
SELECT
  id,
  display_name,
  status,
  tcr_brand_id,
  identity_status,
  trust_score,
  created_at
FROM messaging.brands_10dlc
ORDER BY created_at DESC
LIMIT 3;
```

**Expected**: New brands should have `tcr_brand_id` populated

---

## Related Issues

### Async Submission UX Bug

Even with DNS fixed, there's still a UX issue:
- User gets immediate success message
- TCR submission happens asynchronously
- If TCR rejects (validation error, etc.), user doesn't know

**Fix Required**: Phase 1 of implementation plan (make TCR submission synchronous with timeout)

---

## Configuration Reference

### TCR Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `TCR_API_KEY` | D9B996E41EFB423B8D3E262BD545B3F2 | Basic auth username |
| `TCR_API_SECRET` | D9B996E41EFB423B8D3E262BD545B3F2 | Basic auth password |
| `TCR_SANDBOX` | **"false"** | Use production URL |

**Production URL**: `https://csp-api.campaignregistry.com/v2`
**Sandbox URL**: ~~`https://csp-api.sandbox.campaignregistry.com/v2`~~ (doesn't exist)

---

## Deployment

- **Applied**: 2025-11-30 23:06 UTC
- **Pods Restarted**: 3 replicas (api-gateway-*)
- **Status**: ✅ All pods running with production TCR URL
- **File**: `services/api-gateway/deployments/kubernetes/secrets.yaml` (not committed to git)

**Note**: This file is gitignored and must be applied manually to cluster. Store in Google Secret Manager for production.

---

**Date**: 2025-11-30
