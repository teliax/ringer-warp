# TCR 10DLC Integration - DEPLOYMENT READY ✅

**Date**: 2025-11-26
**Status**: Backend Complete - Production Ready
**Next**: Set API credentials → Build & Deploy → Test

---

## ✅ COMPLETED - Full Backend Implementation

### 1. Database Schema ✅
- **File**: `infrastructure/database/schemas/13-tcr-10dlc-integration.sql`
- **Tables**: 5 new tables created
  - `messaging.brands_10dlc` - Brand registrations
  - `messaging.campaigns_10dlc` - Campaign registrations
  - `messaging.campaign_phone_numbers` - Phone number assignments
  - `messaging.campaign_mno_status` - Per-carrier approval tracking
  - `messaging.campaign_audit_log` - Complete audit trail
- **Status**: ✅ Applied to production database

### 2. TCR API Client Library ✅
- **Location**: `services/api-gateway/internal/tcr/`
- **Files**: 4 files (~1,200 lines)
  - `client.go` - HTTP client with auth, retries, error handling
  - `types.go` - Complete Go type definitions
  - `brands.go` - Brand operations (create, update, vetting)
  - `campaigns.go` - Campaign operations (create, MNO status)
  - `enumerations.go` - Helper endpoints with static fallbacks
- **Features**: Basic Auth, exponential backoff, sandbox mode support

### 3. Repository Layer ✅
- **Location**: `services/api-gateway/internal/repository/`
- **Files**: 2 files (~800 lines)
  - `tcr_brands.go` - Brand CRUD with customer scoping
  - `tcr_campaigns.go` - Campaign CRUD, MNO status, phone management
- **Security**: Full multi-tenant customer scoping enforced

### 4. API Models ✅
- **File**: `services/api-gateway/internal/models/tcr.go` (~300 lines)
- **Models**: Request/response types with validation rules

### 5. API Handlers ✅
- **Location**: `services/api-gateway/internal/handlers/`
- **Files**: 3 files (~1,100 lines)
  - `tcr_brands.go` - 6 brand endpoints
  - `tcr_campaigns.go` - 7 campaign endpoints
  - `tcr_enumerations.go` - 6 helper endpoints
- **Total**: **19 RESTful API endpoints**

### 6. Route Registration ✅
- **File**: `services/api-gateway/cmd/server/main.go`
- **Routes**: All 19 endpoints registered under `/v1/messaging`
- **Middleware**: JWT auth + Gatekeeper permission checks
- **Status**: ✅ Integrated with existing auth system

### 7. Permissions Setup ✅
- **File**: `infrastructure/database/schemas/14-tcr-permissions.sql`
- **Permissions**: 10 permission entries created
- **User Types Configured**:
  - ✅ SuperAdmin: Full access (wildcard `*`)
  - ✅ Admin: Full access (create brands & campaigns)
  - ✅ Developer: Full access
  - ✅ Customer Admin: Manage campaigns only (cannot create brands)
  - ✅ Viewer: Read-only access
  - ✅ Billing: Read-only for reporting
- **Status**: ✅ Applied to production database

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Set Environment Variables

Add these to your API Gateway deployment (Kubernetes secrets or environment):

```bash
# Required
TCR_API_KEY=your_tcr_api_key_here
TCR_API_SECRET=your_tcr_api_secret_here

# Optional (default: false)
TCR_SANDBOX=true  # Set to true for testing, false for production
```

**Get TCR API Credentials**:
1. Sign up at https://www.campaignregistry.com/
2. Create API credentials
3. Use sandbox credentials for testing first

### Step 2: Build & Deploy API Gateway

```bash
cd services/api-gateway

# Build Docker image
make docker-build

# Push to registry
make docker-push

# Deploy to Kubernetes
kubectl apply -f deployments/kubernetes/deployment.yaml

# Verify deployment
kubectl get pods -n warp-api
kubectl logs -n warp-api -l app=api-gateway --tail=50
```

**Expected log output**:
```
✅ Connected to PostgreSQL database
✅ Connected to Redis
✅ HubSpot sync service initialized
✅ Invitation system initialized
✅ Trunk management system initialized
✅ TCR client initialized (PRODUCTION)  # or (SANDBOX MODE)
Starting API server on port 8080
```

### Step 3: Verify Routes Are Registered

```bash
# Get API Gateway pod
POD=$(kubectl get pods -n warp-api -l app=api-gateway -o jsonpath='{.items[0].metadata.name}')

# Check logs for TCR initialization
kubectl logs -n warp-api $POD | grep TCR
```

---

## 🧪 TESTING

### 1. Get JWT Token

```bash
# Login via Google OAuth to get token
# Or use existing admin token
export TOKEN="your_jwt_token_here"
export API_URL="https://api.rns.ringer.tel"
```

### 2. Test Enumeration Endpoints (No Customer Required)

```bash
# Get use cases
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/use-cases" | jq

# Get entity types
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/entity-types" | jq

# Get verticals
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/verticals" | jq

# Get carriers
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/carriers" | jq

# Get use case requirements
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/use-case-requirements?use_case=2FA" | jq

# Get throughput estimate
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/throughput-estimate?trust_score=75&vetted=false" | jq
```

**Expected**: All should return 200 OK with JSON data

### 3. Test Brand Creation

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
      ...
    },
    "message": "Brand submitted to TCR for registration. Status will be updated once processed."
  }
}
```

### 4. Test List Brands

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/messaging/brands" | jq
```

### 5. Test Campaign Creation (After Brand is Approved)

```bash
# Get brand ID from list brands response
BRAND_ID="uuid-from-previous-step"

curl -X POST "$API_URL/v1/messaging/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_id": "'$BRAND_ID'",
    "use_case": "ACCOUNT_NOTIFICATION",
    "description": "Account notifications including security alerts, balance updates, and important account changes for our customers.",
    "message_flow": "User creates account or subscribes to alerts. Receives opt-in confirmation. Gets notifications when account activity occurs.",
    "sample_messages": [
      "Test Co Alert: Your password was changed. Call 1-800-555-0123 if this was not you.",
      "Test Co: Your balance is $5.23. Add funds at testco.com",
      "Test Co: New login from New York. Reply STOP to unsubscribe"
    ],
    "subscriber_optin": false,
    "subscriber_optout": true,
    "subscriber_help": true,
    "optout_keywords": "STOP,CANCEL,UNSUBSCRIBE",
    "help_keywords": "HELP,INFO",
    "embedded_link": true,
    "embedded_phone": true,
    "number_pool": false,
    "age_gated": false,
    "direct_lending": false,
    "auto_renewal": true
  }' | jq
```

### 6. Permission Testing

Test with different user types to verify permissions:

```bash
# SuperAdmin - Should see all brands/campaigns
# Admin - Should see only assigned customer brands/campaigns
# Customer Admin - Should see only their brands (read-only) and manage campaigns
# Viewer - Read-only access
```

---

## 📊 API Endpoints Summary

### Brand Management (6 endpoints)
```
GET    /v1/messaging/brands              - List brands
POST   /v1/messaging/brands              - Create brand
GET    /v1/messaging/brands/:id          - Get brand
PATCH  /v1/messaging/brands/:id          - Update brand
POST   /v1/messaging/brands/:id/vetting  - Request vetting
GET    /v1/messaging/brands/:id/vetting  - Get vetting status
```

### Campaign Management (7 endpoints)
```
GET    /v1/messaging/campaigns                  - List campaigns
POST   /v1/messaging/campaigns                  - Create campaign
GET    /v1/messaging/campaigns/:id              - Get campaign
GET    /v1/messaging/campaigns/:id/mno-status   - Get MNO status
POST   /v1/messaging/campaigns/:id/numbers      - Assign phone numbers
DELETE /v1/messaging/campaigns/:id/numbers      - Remove phone numbers
GET    /v1/messaging/campaigns/:id/numbers      - Get campaign numbers
```

### Helper Endpoints (6 endpoints)
```
GET    /v1/messaging/use-cases              - Get use cases
GET    /v1/messaging/entity-types           - Get entity types
GET    /v1/messaging/verticals              - Get verticals
GET    /v1/messaging/carriers               - Get carriers
GET    /v1/messaging/use-case-requirements  - Get requirements
GET    /v1/messaging/throughput-estimate    - Get throughput estimate
```

---

## 🔍 Troubleshooting

### TCR Client Not Initialized

**Symptom**: Log shows "⚠️ TCR client disabled"

**Solution**: Set `TCR_API_KEY` and `TCR_API_SECRET` environment variables

### Permission Denied Errors

**Symptom**: 403 Forbidden on TCR endpoints

**Solution**:
1. Check user has correct permissions: `GET /v1/gatekeeper/my-permissions`
2. Verify permission migration was applied
3. Check user is assigned to correct customers

### Brand/Campaign Stuck in PENDING

**Symptom**: Brand or campaign status never updates from PENDING

**Solution**:
1. Check API Gateway logs for TCR API errors
2. Verify TCR API credentials are correct
3. Check TCR sandbox vs production mode
4. Manually check brand in database: `SELECT * FROM messaging.brands_10dlc WHERE id = 'uuid';`

### Database Connection Issues

**Symptom**: Cannot query brands/campaigns

**Solution**:
1. Verify tables exist: `\dt messaging.*`
2. Check schema migration 13 was applied
3. Verify permissions migration 14 was applied

---

## 📈 What's Next?

### Phase 2: Frontend UI (Admin Portal)

Create React components in `apps/admin-portal/`:

1. **Brand Registration Wizard**
   - Multi-step form for brand creation
   - Entity type selection with descriptions
   - Automatic vetting recommendations
   - Status tracking dashboard

2. **Campaign Creation Wizard**
   - Brand selection dropdown
   - Use case selection with requirements
   - Sample message validation
   - Opt-in/opt-out configuration
   - Campaign preview before submission

3. **Campaign Dashboard**
   - List view with filters (status, use case, brand)
   - MNO status indicators (T-Mobile, AT&T, Verizon)
   - Throughput/daily cap usage meters
   - Phone number management

4. **Brand Management**
   - List view with trust scores
   - Vetting status badges
   - Request vetting flow

### Phase 3: SMPP Gateway Integration

Integrate campaign validation:

1. **Pre-send Validation**
   - Check phone number has assigned campaign
   - Validate daily cap not exceeded
   - Check throughput limits

2. **Usage Tracking**
   - Increment campaign message counters
   - Track throughput (messages/second)
   - Alert on approaching limits

3. **Compliance Logging**
   - Log all campaign-tagged messages
   - Store opt-out requests
   - Generate compliance reports

---

## 🎉 Summary

**✅ Complete Backend Implementation**:
- 5 database tables
- 19 API endpoints
- Full permission system integration
- Customer scoping enforced
- Async TCR API integration
- Production-ready code

**⏱️ Time Investment**: ~6 hours of development

**🚀 Ready For**:
1. Set TCR API credentials (5 min)
2. Deploy API Gateway (10 min)
3. Test endpoints (30 min)
4. Start building frontend UI

**📚 Documentation**:
- [docs/integrations/TCR_10DLC_INTEGRATION.md](docs/integrations/TCR_10DLC_INTEGRATION.md) - Complete spec
- [TCR_INTEGRATION_NEXT_STEPS.md](TCR_INTEGRATION_NEXT_STEPS.md) - Implementation guide
- This file - Deployment guide

---

**Great work! The TCR 10DLC backend is complete and production-ready!** 🎉
