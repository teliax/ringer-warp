# Handoff Document: TCR Campaign Creation - Next Session

**Date**: 2025-12-03
**For**: Next development session
**Prerequisites**: ✅ Verified brand (TELIAX INC - BBPD732)

---

## Session Goals

With a verified brand (TELIAX INC, status: VERIFIED), the next session will implement:

1. **Campaign Registration Form** - Create campaigns for messaging use cases
2. **Campaign Management** - List, view, update campaigns
3. **Phone Number Assignment** - Associate phone numbers with campaigns
4. **MNO Status Tracking** - Monitor carrier approvals

---

## Current State

### What's Complete ✅

**Brand Management**:
- ✅ TinComply EIN verification
- ✅ Brand registration with TCR
- ✅ Full brand updates (25 fields)
- ✅ Brand resubmission
- ✅ Verified brand: TELIAX INC (BBPD732)

**Backend (v1.3.7)**:
- ✅ TCR brand operations
- ✅ TCR enum parsing (entity types, verticals)
- ✅ Database schema for brands

**Frontend**:
- ✅ Brand registration form
- ✅ Brand detail page
- ✅ Brand edit dialog
- ✅ Comprehensive field support

### What's Next 🚧

**Campaign Creation**:
- [ ] Campaign registration form
- [ ] Use case selection
- [ ] Message sample inputs
- [ ] Compliance settings (opt-in/out, help)
- [ ] Campaign submission to TCR

**Campaign Management**:
- [ ] List campaigns
- [ ] Campaign detail page
- [ ] MNO status display
- [ ] Phone number assignment

---

## Reference Documentation

### TCR Integration Docs

**Must Read**:
1. **[TCR_10DLC_INTEGRATION.md](../integrations/TCR_10DLC_INTEGRATION.md)**
   - Section: "Campaign Registration Workflow" (lines 206-293)
   - Section: "Frontend UI/UX Workflows" - Campaign Creation (lines 881-1133)
   - Section: "Campaign Data Requirements" (lines 246-292)

2. **[TCR-API.json](../api_docs/TCR-API.json)**
   - Search for "campaign" endpoints
   - POST /campaign - Create campaign
   - GET /campaign/{id}/operationStatus - MNO status

### Implementation Already Exists (Partially)

**Backend**:
- `services/api-gateway/internal/tcr/campaigns.go` - TCR campaign operations
- `services/api-gateway/internal/handlers/tcr_campaigns.go` - API handlers
- `services/api-gateway/internal/repository/tcr_campaigns.go` - Database operations

**Frontend**:
- `apps/customer-portal/src/components/forms/CampaignRegistrationForm.tsx` - Registration form (exists!)
- `apps/customer-portal/src/hooks/useCampaigns.ts` - Campaign operations hook

**Database**:
- `infrastructure/database/schemas/13-tcr-10dlc-integration.sql` - Campaign tables

---

## Campaign Requirements

### Minimum Required Fields

**For All Campaigns**:
1. **Brand ID** - Must use verified brand (BBPD732)
2. **Use Case** - ACCOUNT_NOTIFICATION, 2FA, MARKETING, etc.
3. **Description** - Min 40 characters, explain purpose
4. **Message Flow** - Min 40 characters, explain user journey
5. **Sample Messages** - 1-5 samples (varies by use case)

**Compliance Settings**:
- Opt-in required? (true/false)
- Opt-out supported? (always true, use "STOP" keyword)
- Help supported? (recommended, use "HELP" keyword)

**Optional but Important**:
- Content attributes (embedded links, phone numbers)
- Age-gated content flag
- Direct lending flag
- Privacy policy URL
- Terms & conditions URL

### Use Case Examples

**Easy to Approve** (recommended for first campaign):
- **2FA** - Two-factor authentication codes
- **ACCOUNT_NOTIFICATION** - Account alerts, security notifications
- **CUSTOMER_CARE** - Support messages
- **DELIVERY_NOTIFICATION** - Shipping updates

**Medium Difficulty**:
- **MARKETING** - Promotional messages (requires opt-in proof)
- **POLLING_VOTING** - Surveys, polls

**Hard** (not recommended initially):
- **POLITICAL** - Requires political vetting
- **SWEEPSTAKE** - Heavy compliance requirements

---

## Implementation Checklist

### Phase 1: Campaign Form (First Priority)

**Backend Tasks**:
- [ ] Review existing campaign handlers
- [ ] Test campaign creation endpoint
- [ ] Verify MNO status tracking works
- [ ] Add phone number assignment logic

**Frontend Tasks**:
- [ ] Review existing CampaignRegistrationForm
- [ ] Add use case selector with difficulty indicators
- [ ] Dynamic message sample fields (1-5 based on use case)
- [ ] Compliance wizard (opt-in/out/help settings)
- [ ] Integration with brand selector

**Testing**:
- [ ] Create test campaign with verified brand
- [ ] Verify submission to TCR
- [ ] Check MNO status updates
- [ ] Confirm in TCR portal

### Phase 2: Campaign Management

**Pages to Build**:
- [ ] Campaign list page (with filters)
- [ ] Campaign detail page
- [ ] Phone number assignment UI
- [ ] MNO status badges (T-Mobile, AT&T, Verizon)

**Backend**:
- [ ] List campaigns endpoint
- [ ] Get campaign details
- [ ] Assign/remove phone numbers
- [ ] Query MNO status

---

## Key Learnings to Apply

### From Brand Implementation

1. **Parse TCR responses carefully** - They vary (arrays, objects, strings)
2. **Field mapping matters** - DB vs API vs Frontend names must align
3. **Empty strings break TCR** - Filter before sending
4. **Test in TCR portal** - Verify data matches exactly
5. **Enumerate everything** - Use TCR's enum endpoints for dropdowns

### For Campaign Implementation

1. **Use Case is Critical** - Wrong choice = rejection
2. **Message Samples Must Be Real** - Generic samples get rejected
3. **Include Brand Name** - Every sample should have company name
4. **Opt-out is Mandatory** - Must support "STOP" keyword
5. **Be Specific** - "Notifications" is too vague, use "Account security alerts"

---

## Current System State

**Brand**: TELIAX INC
- TCR Brand ID: BBPD732
- Status: VERIFIED ✅
- Trust Score: (check in portal)
- Identity Status: VERIFIED
- Entity Type: PRIVATE_PROFIT

**Ready For**: Campaign creation

**Deployed Versions**:
- Backend: v1.3.7
- Frontend: Latest (Vercel)

---

## Quick Start for Next Session

**1. Check Current Campaign Code**:
```bash
# Backend
cat services/api-gateway/internal/handlers/tcr_campaigns.go

# Frontend
cat apps/customer-portal/src/components/forms/CampaignRegistrationForm.tsx
```

**2. Review TCR Requirements**:
```bash
# Read campaign section
less docs/integrations/TCR_10DLC_INTEGRATION.md
# Jump to line 206 (Campaign Registration Workflow)
```

**3. Test Existing Implementation**:
```bash
# Start frontend
cd apps/customer-portal && npm run dev

# Navigate to Messaging → Create Campaign
# See what works, what needs fixes
```

**4. Reference This Session's Patterns**:
- Brand registration form → Campaign registration form (similar structure)
- TinComply integration → Any third-party API integrations
- Field mapping fixes → Apply same patterns

---

## Expected Timeline

**Campaign Form Implementation**: 2-3 hours
**Campaign Management Pages**: 2-3 hours
**Phone Number Assignment**: 1-2 hours
**Testing & Refinement**: 1-2 hours

**Total**: 6-10 hours (1-2 sessions)

---

## Success Criteria

**Session Complete When**:
1. ✅ Can create a campaign for verified brand
2. ✅ Campaign appears in TCR portal
3. ✅ MNO status tracking works
4. ✅ Can assign phone numbers to campaign
5. ✅ Can send test message through assigned number

---

**Handoff Created**: 2025-12-03
**Current Session**: Brand verification complete ✅
**Next Session**: Campaign creation 🚀
**Status**: Ready to begin!
