# TCR 10DLC Customer Portal Integration - Status

**Date**: 2025-11-26
**Status**: Phase 1 & 2 Complete - Data Integration Live ✅

---

## ✅ What's Complete

### Phase 1: Foundation (Complete)

1. **Axios Global Configuration** ✅
   - **File**: `apps/customer-portal/src/lib/axios-config.ts`
   - JWT token auto-injection from localStorage
   - 401 error handling → redirect to login
   - Base URL from environment variable
   - Imported in `main.tsx`

2. **TypeScript Type Definitions** ✅
   - **File**: `apps/customer-portal/src/types/messaging.ts`
   - Complete interfaces matching backend API models
   - Backend status values: `PENDING`, `VERIFIED`, `ACTIVE`, `REGISTERED`, `REJECTED`, etc.
   - All request/response types for brands, campaigns, MNO status, phone numbers
   - Enumeration types (use cases, entity types, verticals)

3. **Custom React Hooks** ✅
   - **`apps/customer-portal/src/hooks/useBrands.ts`**
     - `listBrands()` - GET /v1/messaging/brands
     - `getBrand(id)` - GET /v1/messaging/brands/:id
     - `createBrand(data)` - POST /v1/messaging/brands
     - `updateBrand(id, data)` - PATCH /v1/messaging/brands/:id
     - `requestVetting(id, provider, class)` - POST /v1/messaging/brands/:id/vetting
     - `getVettingStatus(id)` - GET /v1/messaging/brands/:id/vetting

   - **`apps/customer-portal/src/hooks/useCampaigns.ts`**
     - `listCampaigns(brandId?, status?)` - GET /v1/messaging/campaigns
     - `getCampaign(id)` - GET /v1/messaging/campaigns/:id
     - `createCampaign(data)` - POST /v1/messaging/campaigns
     - `updateCampaign(id, data)` - PATCH /v1/messaging/campaigns/:id
     - `getMNOStatus(campaignId)` - GET /v1/messaging/campaigns/:id/mno-status
     - `assignNumbers(campaignId, numbers)` - POST /v1/messaging/campaigns/:id/numbers
     - `removeNumbers(campaignId, numbers)` - DELETE /v1/messaging/campaigns/:id/numbers
     - `getAssignedNumbers(campaignId)` - GET /v1/messaging/campaigns/:id/numbers

   - **`apps/customer-portal/src/hooks/useMessagingEnums.ts`**
     - `getUseCases()` - GET /v1/messaging/use-cases
     - `getEntityTypes()` - GET /v1/messaging/entity-types
     - `getVerticals()` - GET /v1/messaging/verticals
     - `getCarriers()` - GET /v1/messaging/carriers
     - `getUseCaseRequirements(useCase)` - GET /v1/messaging/use-case-requirements
     - `getThroughputEstimate(score, vetted)` - GET /v1/messaging/throughput-estimate

### Phase 2: Data Integration (Complete)

4. **Messaging Page Updated** ✅
   - **File**: `apps/customer-portal/src/polymet/pages/messaging.tsx`
   - Removed mock data imports
   - Added real API hooks (useBrands, useCampaigns, useMessagingEnums)
   - Data loads on component mount via `useEffect`
   - Status badge function updated for backend values:
     - Green: VERIFIED, VETTED_VERIFIED, ACTIVE, REGISTERED
     - Yellow: PENDING, UNVERIFIED
     - Red: REJECTED, FAILED
     - Gray: SUSPENDED, EXPIRED
   - Stats cards use real data:
     - Active Brands count
     - Active Campaigns count
     - Pending counts
   - Brands table displays real API data
   - Campaigns table displays real API data
   - Empty states when no data exists

---

## 🚧 What's Remaining

### Phase 3: Forms (Next - ~60 min)

**Need to Create**:

1. **Brand Registration Form**
   - **File**: `apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx`
   - Form fields: display_name, legal_name, entity_type, email, phone, address, etc.
   - Validation: required fields, email format, phone format (E.164), postal code regex
   - Multi-section layout: Business Info, Contact, Address, Additional Info
   - Entity type dropdown (from useMessagingEnums)
   - Vertical dropdown (from useMessagingEnums)

2. **Campaign Registration Form**
   - **File**: `apps/customer-portal/src/components/forms/CampaignRegistrationForm.tsx`
   - Form fields: brand_id, use_case, description (40+ chars), message_flow (40+ chars), sample_messages (1-5)
   - Dynamic sample message fields based on use case requirements
   - Opt-in/opt-out configuration
   - Content flags (embedded_link, embedded_phone, age_gated, etc.)
   - Brand selection dropdown (from approved brands)
   - Use case dropdown (from useMessagingEnums)

3. **Wire Forms into Dialogs**
   - Replace placeholder dialog content in messaging.tsx
   - Import form components
   - Pass props (entity types, use cases, brands, onSubmit, onCancel)

4. **Form Submission Handlers**
   - `handleBrandSubmit()` - Call useBrands.createBrand()
   - `handleCampaignSubmit()` - Call useCampaigns.createCampaign()
   - Toast notifications for success/errors
   - Refresh data after submission
   - Close dialogs

### Phase 4: Polish (~30 min)

5. **Loading States**
   - Show spinner while data loads
   - Disable buttons while submitting
   - Loading overlay during form submission

6. **Error Handling**
   - Display API errors in forms
   - Show error alerts if data fails to load
   - Retry button for failed loads

7. **Toast Notifications**
   - Success: "Brand submitted for registration!"
   - Success: "Campaign created successfully!"
   - Error: Display API error messages

---

## 📊 Current Behavior

**When Page Loads**:
1. Fetches brands from `/v1/messaging/brands`
2. Fetches campaigns from `/v1/messaging/campaigns`
3. Fetches use cases, entity types, verticals from API
4. Displays in tables with backend status values
5. Shows empty state if no brands/campaigns exist

**Register Brand Button**:
- Opens dialog with placeholder content
- Needs form component to be created

**Create Campaign Button**:
- Opens dialog with placeholder content
- Needs form component to be created

---

## 🔧 How to Test Current Progress

### Start Dev Server

```bash
cd apps/customer-portal
npm run dev
```

### Expected Behavior

1. **Page Loads**: Should load without errors (axios now installed)
2. **API Calls**: Browser console will show network requests to `/v1/messaging/*`
3. **Empty State**: "No brands registered yet" message (unless you have data)
4. **Stats**: Should show 0 active brands, 0 campaigns
5. **Dialogs**: Open with placeholder content (forms not built yet)

### Check Browser Console

```javascript
// Should see network requests:
GET https://api.rns.ringer.tel/v1/messaging/brands
GET https://api.rns.ringer.tel/v1/messaging/campaigns
GET https://api.rns.ringer.tel/v1/messaging/use-cases
GET https://api.rns.ringer.tel/v1/messaging/entity-types
GET https://api.rns.ringer.tel/v1/messaging/verticals
```

### If Errors Occur

**401 Unauthorized**:
- No JWT token in localStorage
- Need to log in first via admin portal
- Copy token to localStorage manually for testing:
  ```javascript
  localStorage.setItem('warp_token', 'your-jwt-token-here')
  ```

**404 Not Found**:
- Check `VITE_API_URL` in `.env`
- Should be: `https://api.rns.ringer.tel`

**CORS Errors**:
- API Gateway needs CORS configured for customer portal origin

---

## 🎯 Next Steps

### Option 1: Build Forms Now

Continue with Phase 3 to build the brand and campaign registration forms. This will make the portal fully functional.

**Time**: ~1.5 hours
**Result**: Complete end-to-end workflow

### Option 2: Test Current Integration First

Test that the data integration works:
1. Start dev server
2. Log in to get JWT token
3. Verify API calls succeed
4. Check brands/campaigns display
5. Then build forms

**Time**: 15-30 min testing
**Result**: Confidence in foundation before building forms

---

## 📝 Implementation Notes

### Backend Status Values Now Used

The UI now uses backend status values directly:

**Brand Statuses**:
- `PENDING` - Saved locally, submitting to TCR
- `REGISTERED` - Submitted to TCR
- `UNVERIFIED` - TCR processed, self-declared
- `VERIFIED` - TCR verified (stock symbol, etc.)
- `VETTED_VERIFIED` - Externally vetted
- `FAILED` - Submission error
- `REJECTED` - TCR rejected
- `SUSPENDED` - Suspended by TCR

**Campaign Statuses**:
- `PENDING` - Saved locally, submitting to TCR
- `ACTIVE` - Approved by carriers, ready to send
- `REJECTED` - Rejected by TCR/carriers
- `SUSPENDED` - Suspended
- `EXPIRED` - Expired (annual renewal needed)

### Data Flow

```
User visits /messaging
    ↓
useEffect triggers loadData()
    ↓
Promise.all([
  useBrands.listBrands(),        → GET /v1/messaging/brands
  useCampaigns.listCampaigns(),  → GET /v1/messaging/campaigns
  useMessagingEnums...           → GET /v1/messaging/use-cases, etc.
])
    ↓
setState with API responses
    ↓
Tables re-render with real data
    ↓
User sees their brands and campaigns
```

---

## 🔐 Security Notes

**Customer Scoping**:
- Backend enforces customer isolation via Gatekeeper
- Frontend automatically gets only customer's own data
- No filtering needed in frontend - backend handles it

**Authentication**:
- JWT token from localStorage (`warp_token`)
- Axios interceptor adds to all requests
- 401 responses redirect to `/login`

---

## 📦 Dependencies Installed

- ✅ `axios` - HTTP client
- ✅ `sonner` - Toast notifications
- ✅ `react-hook-form` - Form management
- ✅ `zod` - Schema validation
- ✅ `@hookform/resolvers` - RHF + Zod integration

All dependencies ready for forms!

---

## Files Created/Modified

**Created (5 files)**:
1. `apps/customer-portal/src/lib/axios-config.ts`
2. `apps/customer-portal/src/types/messaging.ts`
3. `apps/customer-portal/src/hooks/useBrands.ts`
4. `apps/customer-portal/src/hooks/useCampaigns.ts`
5. `apps/customer-portal/src/hooks/useMessagingEnums.ts`

**Modified (2 files)**:
1. `apps/customer-portal/src/main.tsx` - Import axios-config
2. `apps/customer-portal/src/polymet/pages/messaging.tsx` - Use real API data, backend status values

**Total Lines Added**: ~650 lines of production code

---

**Status**: Ready to build forms or test current integration!
