# TCR 10DLC Integration - Next Steps

**Date**: 2025-11-26
**Status**: Handlers Complete - Ready for Route Registration

## ✅ Completed (Backend Foundation)

### 1. Database Schema
- ✅ `infrastructure/database/schemas/13-tcr-10dlc-integration.sql`
- ✅ 5 new tables: brands_10dlc, campaigns_10dlc, campaign_phone_numbers, campaign_mno_status, campaign_audit_log
- ✅ Applied to production database

### 2. TCR API Client Library
- ✅ `internal/tcr/client.go` - HTTP client with retry logic
- ✅ `internal/tcr/types.go` - Complete Go types
- ✅ `internal/tcr/brands.go` - Brand operations
- ✅ `internal/tcr/campaigns.go` - Campaign operations
- ✅ `internal/tcr/enumerations.go` - Helper enumerations

### 3. Repository Layer
- ✅ `internal/repository/tcr_brands.go` - Brand CRUD with customer scoping
- ✅ `internal/repository/tcr_campaigns.go` - Campaign CRUD, MNO status, phone management

### 4. API Models
- ✅ `internal/models/tcr.go` - Request/response models

### 5. API Handlers
- ✅ `internal/handlers/tcr_brands.go` - Brand endpoints (6 handlers)
  - ListBrands, GetBrand, CreateBrand, UpdateBrand
  - RequestVetting, GetVettingStatus
- ✅ `internal/handlers/tcr_campaigns.go` - Campaign endpoints (7 handlers)
  - ListCampaigns, GetCampaign, CreateCampaign
  - GetMNOStatus, AssignPhoneNumbers, RemovePhoneNumbers, GetCampaignNumbers
- ✅ `internal/handlers/tcr_enumerations.go` - Helper endpoints (6 handlers)
  - GetUseCases, GetEntityTypes, GetVerticals, GetCarriers
  - GetUseCaseRequirements, GetThroughputEstimate

---

## 🚧 TODO: Route Registration

### Step 1: Update `cmd/server/main.go`

Add TCR client initialization and route registration:

```go
// Add after existing imports
import (
	"github.com/ringer-warp/api-gateway/internal/tcr"
)

// In main() function, after database setup:

// Initialize TCR client (get credentials from environment/secret manager)
tcrClient := tcr.NewClient(tcr.Config{
	APIKey:    os.Getenv("TCR_API_KEY"),
	APISecret: os.Getenv("TCR_API_SECRET"),
	Sandbox:   os.Getenv("TCR_SANDBOX") == "true",
})

// Initialize TCR repositories
tcrBrandRepo := repository.NewTCRBrandRepository(db)
tcrCampaignRepo := repository.NewTCRCampaignRepository(db)

// Initialize TCR handlers
tcrBrandHandler := handlers.NewTCRBrandHandler(tcrBrandRepo, tcrClient, logger)
tcrCampaignHandler := handlers.NewTCRCampaignHandler(tcrCampaignRepo, tcrBrandRepo, tcrClient, logger)
tcrEnumHandler := handlers.NewTCREnumerationHandler(tcrClient, logger)

// Register TCR routes (under protected v1 group with JWT + Gatekeeper)
v1 := router.Group("/v1")
v1.Use(jwtMiddleware.Authenticate())
v1.Use(gatekeeperMiddleware.CheckPermission())
{
	messaging := v1.Group("/messaging")
	{
		// Brand endpoints
		messaging.GET("/brands", tcrBrandHandler.ListBrands)
		messaging.POST("/brands", tcrBrandHandler.CreateBrand)
		messaging.GET("/brands/:id", tcrBrandHandler.GetBrand)
		messaging.PATCH("/brands/:id", tcrBrandHandler.UpdateBrand)
		messaging.POST("/brands/:id/vetting", tcrBrandHandler.RequestVetting)
		messaging.GET("/brands/:id/vetting", tcrBrandHandler.GetVettingStatus)

		// Campaign endpoints
		messaging.GET("/campaigns", tcrCampaignHandler.ListCampaigns)
		messaging.POST("/campaigns", tcrCampaignHandler.CreateCampaign)
		messaging.GET("/campaigns/:id", tcrCampaignHandler.GetCampaign)
		messaging.GET("/campaigns/:id/mno-status", tcrCampaignHandler.GetMNOStatus)
		messaging.POST("/campaigns/:id/numbers", tcrCampaignHandler.AssignPhoneNumbers)
		messaging.DELETE("/campaigns/:id/numbers", tcrCampaignHandler.RemovePhoneNumbers)
		messaging.GET("/campaigns/:id/numbers", tcrCampaignHandler.GetCampaignNumbers)

		// Enumeration/helper endpoints
		messaging.GET("/use-cases", tcrEnumHandler.GetUseCases)
		messaging.GET("/entity-types", tcrEnumHandler.GetEntityTypes)
		messaging.GET("/verticals", tcrEnumHandler.GetVerticals)
		messaging.GET("/carriers", tcrEnumHandler.GetCarriers)
		messaging.GET("/use-case-requirements", tcrEnumHandler.GetUseCaseRequirements)
		messaging.GET("/throughput-estimate", tcrEnumHandler.GetThroughputEstimate)
	}
}
```

---

## 🚧 TODO: Add Permissions to Database

### Step 2: SQL Migration for TCR Permissions

Create `infrastructure/database/schemas/14-tcr-permissions.sql`:

```sql
-- TCR 10DLC Permission Setup
-- Date: 2025-11-26

-- Add permission metadata for TCR endpoints
INSERT INTO auth.permission_metadata (resource_path, category, display_name, description, display_order)
VALUES
    -- Brand permissions
    ('/api/v1/messaging/brands', 'TCR/10DLC', 'List Brands', 'View registered 10DLC brands', 200),
    ('/api/v1/messaging/brands/*', 'TCR/10DLC', 'Manage Brands', 'Create and manage 10DLC brands', 201),

    -- Campaign permissions
    ('/api/v1/messaging/campaigns', 'TCR/10DLC', 'List Campaigns', 'View registered 10DLC campaigns', 210),
    ('/api/v1/messaging/campaigns/*', 'TCR/10DLC', 'Manage Campaigns', 'Create and manage 10DLC campaigns', 211),

    -- Enumeration/helper permissions
    ('/api/v1/messaging/use-cases', 'TCR/10DLC', 'View Use Cases', 'View available campaign use cases', 220),
    ('/api/v1/messaging/entity-types', 'TCR/10DLC', 'View Entity Types', 'View brand entity types', 221),
    ('/api/v1/messaging/verticals', 'TCR/10DLC', 'View Verticals', 'View industry verticals', 222),
    ('/api/v1/messaging/carriers', 'TCR/10DLC', 'View Carriers', 'View mobile carriers', 223),
    ('/api/v1/messaging/use-case-requirements', 'TCR/10DLC', 'View Requirements', 'View use case requirements', 224),
    ('/api/v1/messaging/throughput-estimate', 'TCR/10DLC', 'Throughput Estimates', 'View throughput estimates', 225)
ON CONFLICT (resource_path) DO UPDATE
SET category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

-- Grant permissions to SuperAdmin (already has wildcard *)

-- Grant permissions to Admin user type
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, resource FROM auth.user_types, (VALUES
    ('/api/v1/messaging/brands'),
    ('/api/v1/messaging/brands/*'),
    ('/api/v1/messaging/campaigns'),
    ('/api/v1/messaging/campaigns/*'),
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perms(resource)
WHERE type_name = 'admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant permissions to Customer Admin (limited - cannot create brands)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, resource FROM auth.user_types, (VALUES
    ('/api/v1/messaging/brands'),           -- Can view brands
    ('/api/v1/messaging/campaigns'),        -- Can view campaigns
    ('/api/v1/messaging/campaigns/*'),      -- Can manage campaigns (but not create brands)
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perms(resource)
WHERE type_name = 'customer_admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant read-only permissions to Viewer
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, resource FROM auth.user_types, (VALUES
    ('/api/v1/messaging/brands'),
    ('/api/v1/messaging/campaigns'),
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perms(resource)
WHERE type_name = 'viewer'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;
```

**Apply the migration:**
```bash
PGPASSWORD='G7$k9mQ2@tR1' psql -h 34.42.208.57 -p 5432 -U warp_app -d warp -f infrastructure/database/schemas/14-tcr-permissions.sql
```

---

## 🔑 Environment Variables Needed

Add to API Gateway environment (or Google Secret Manager):

```bash
TCR_API_KEY=your_tcr_api_key_here
TCR_API_SECRET=your_tcr_api_secret_here
TCR_SANDBOX=false  # Set to true for testing
```

---

## 📋 Testing Checklist

### 1. Manual API Testing

```bash
# Get access token
TOKEN="your_jwt_token_here"

# Test enumeration endpoints (no customer needed)
curl -H "Authorization: Bearer $TOKEN" \
  http://api.rns.ringer.tel/v1/messaging/use-cases

curl -H "Authorization: Bearer $TOKEN" \
  http://api.rns.ringer.tel/v1/messaging/entity-types

# Test brand creation
curl -X POST http://api.rns.ringer.tel/v1/messaging/brands \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Test Brand",
    "legal_name": "Test Brand LLC",
    "entity_type": "PRIVATE_PROFIT",
    "email": "contact@testbrand.com",
    "phone": "+15551234567",
    "country": "US",
    "vertical": "TECHNOLOGY"
  }'

# Test campaign creation (after brand is registered)
curl -X POST http://api.rns.ringer.tel/v1/messaging/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_id": "brand-uuid-here",
    "use_case": "ACCOUNT_NOTIFICATION",
    "description": "Account notifications for security alerts, balance updates, and account changes.",
    "message_flow": "User creates account, receives confirmation SMS, subscribes to alerts, receives notifications when account activity occurs.",
    "sample_messages": [
      "Test Brand Alert: Your password was changed. Contact support at 1-800-555-0123 if this wasn't you.",
      "Test Brand: Your account balance is low ($5.23). Add funds at testbrand.com",
      "Test Brand Security: New login from New York, NY. Reply HELP or STOP to unsubscribe"
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
  }'
```

### 2. Permission Testing

Test with different user types:
- SuperAdmin: Should see all brands/campaigns
- Admin: Should see only assigned customers' brands/campaigns
- Customer Admin: Should see only their own brand/campaigns (read-only brands)
- Viewer: Read-only access

---

## 🎯 After Route Registration

Next development phases:

1. **Frontend UI** (`apps/admin-portal/`)
   - Brand registration wizard
   - Campaign creation wizard
   - Campaign list with MNO status indicators
   - Phone number assignment UI

2. **SMPP Gateway Integration**
   - Add campaign validation before sending messages
   - Check daily caps and throughput limits
   - Log campaign usage

3. **Monitoring & Alerts**
   - Campaign approval status webhook
   - MNO rejection alerts
   - Daily cap warnings
   - Throughput monitoring

---

## 📚 Documentation References

- **[docs/integrations/TCR_10DLC_INTEGRATION.md](docs/integrations/TCR_10DLC_INTEGRATION.md)** - Complete TCR documentation
- **[docs/security/AUTH_AND_PERMISSION_SYSTEM.md](docs/security/AUTH_AND_PERMISSION_SYSTEM.md)** - Permission system details
- **API Gateway**: `services/api-gateway/`

---

## Summary

**What We Built:**
- Complete backend API for TCR 10DLC integration
- 19 API endpoints across brands, campaigns, and enumerations
- Full customer scoping and permission integration
- Async TCR API submissions (non-blocking)
- MNO status tracking and phone number management

**What's Left:**
1. Register routes in main.go (10 minutes)
2. Add permissions to database (5 minutes)
3. Set TCR API credentials (5 minutes)
4. Test endpoints (30 minutes)

**Total Time to Production-Ready Backend**: ~50 minutes

Then we can move to frontend UI implementation! 🎉
