# TCR Brand Registration and Verification - Complete Guide

**Date**: 2025-12-03
**Status**: Production Ready
**Last Updated**: After successful TELIAX INC verification

---

## Overview

This guide documents everything we learned about TCR brand registration, updates, and verification through real-world implementation and testing.

## Table of Contents

1. [Brand Registration](#brand-registration)
2. [Brand Updates](#brand-updates)
3. [Brand Verification](#brand-verification)
4. [Troubleshooting](#troubleshooting)
5. [Lessons Learned](#lessons-learned)

---

## Brand Registration

### Prerequisites

- ✅ Valid EIN/Tax ID
- ✅ Business information (legal name, address, contacts)
- ✅ TinComply account (optional, for EIN verification)

### Registration Flow

**1. Navigate to Brand Registration**
```
Customer Portal → Messaging → Register Brand
```

**2. Enter EIN and Verify** (Optional but Recommended)
- Enter EIN: `203479949`
- Click "Verify EIN" button
- System queries TinComply API
- Auto-fills: Legal Name = "TELIAX INC"

**3. Complete Brand Information**

**Required Fields**:
- Display Name (marketing name)
- Legal Name (official registered name)
- Entity Type (PRIVATE_PROFIT, PUBLIC_PROFIT, etc.)
- Tax ID / EIN
- Business Address (street, city, state, zip)
- Primary Email & Phone
- Business Contact (first, last, email)

**Optional but Recommended**:
- Industry Vertical
- Website
- Stock Information (for public companies)
- Alternative Business IDs (DUNS, GIIN, LEI)

**4. Submit**
- Click "Register Brand"
- Backend saves to database
- Submits to TCR via `POST /brand/nonBlocking`
- TCR assigns brand ID (e.g., "BBPD732")
- Returns initial status and trust score

### Initial Brand Status

After registration, brand will have one of these statuses:

| Status | Trust Score | Meaning |
|--------|-------------|---------|
| **SELF_DECLARED** | 10-25 | Sole proprietor, minimal verification |
| **UNVERIFIED** | 25-50 | Private company, couldn't auto-verify |
| **VERIFIED** | 75-100 | Public company with stock symbol match |
| **VETTED_VERIFIED** | 75-100 | External vetting completed |

---

## Brand Updates

### What Can Be Updated

**Freely Updatable** (no resubmission required):
- Display Name
- Website
- Address (street, city, state, zip)
- Primary Contact (email, phone)
- Business Contact (all 4 fields)
- Industry Vertical
- Stock Symbol & Exchange
- Alternative Business IDs
- Reference ID

**Core Identity Fields** (requires resubmission):
- ⚠️ **Legal Name** (company_name)
- ⚠️ **Tax ID / EIN**
- ⚠️ **Entity Type**

### Update Flow

**1. Navigate to Brand Detail Page**
```
Messaging → Brands → Click on brand name
```

**2. Click "Edit Brand" Button**
- Dialog opens with all current brand data
- All 25+ fields editable
- Core fields marked with ⚠️ warning icon

**3. Make Changes**
- Update any fields
- Phone numbers auto-format to E.164 (+1XXXXXXXXXX)
- Stock exchange dropdown shows valid TCR values
- Verticals load from live TCR data

**4. Save Changes**
- Click "Save Changes"
- Updates save to local database
- Automatically syncs to TCR
- Both systems stay in sync

**5. Resubmit (if core fields changed)**
- See "Resubmit Brand" button on detail page
- Click to send to TCR for re-verification
- Brand status updates (PENDING → VERIFIED/UNVERIFIED)

---

## Brand Verification

### Why Brands Become UNVERIFIED

1. **Initial Registration** - TCR couldn't auto-verify business information
2. **Core Field Changes** - Legal name, EIN, or entity type updated
3. **Failed Verification** - Business info doesn't match government records

### How to Get Verified

**Option 1: Resubmit Brand** (Free)
- Available when: Brand is UNVERIFIED
- Method: Click "Resubmit Brand" button
- Timeline: Instant to 5 minutes
- Success rate: Higher if data matches government records
- Best for: Correct data that should auto-verify

**Option 2: Request External Vetting** ($40-$500)
- Available when: Brand is UNVERIFIED or SELF_DECLARED
- Method: Click "Request Vetting"
- Providers: AEGIS, WMC Global
- Timeline: 3-5 business days
- Cost: $40 (Standard), $500 (Political)
- Best for: Legitimate businesses that can't auto-verify

**Option 3: Public Company Auto-Verification** (Free)
- Requirements: PUBLIC_PROFIT entity type + valid stock symbol
- Method: Update entity type, add stock symbol
- Timeline: Instant
- Best for: Publicly traded companies

### Verification Success Factors

**Increases Success**:
- ✅ Exact legal name matches government records
- ✅ Valid EIN that matches business name
- ✅ Business address matches registration
- ✅ Public company with stock symbol
- ✅ Consistent information across all fields

**Decreases Success**:
- ❌ Mismatched legal name vs EIN
- ❌ DBA/marketing name instead of legal name
- ❌ Incorrect EIN format
- ❌ Residential address for business
- ❌ Recently registered business (< 30 days)

---

## Troubleshooting

### Issue: Brand is UNVERIFIED

**Diagnosis**: Check what doesn't match
- Legal Name: Must be EXACT as registered with IRS/state
- EIN: Must match the legal entity
- Entity Type: Must match actual business structure

**Solutions**:
1. Edit brand with correct information
2. Use TinComply EIN verification to get official legal name
3. Resubmit after corrections
4. Request external vetting if data is correct but won't auto-verify

### Issue: Resubmission Fails

**Common Causes**:
- Brand has active campaigns (can't change core fields)
- Data still doesn't match government records
- EIN belongs to different legal entity

**Solutions**:
- Verify legal name with [TinComply](https://www.tincomply.com)
- Check IRS records
- Request external vetting instead

### Issue: Trust Score is 0

**Cause**: Brand not yet verified by TCR

**Solution**: Wait for verification to complete (usually 30 sec - 5 min)

### Issue: Can't Update Certain Fields

**Cause**: TCR API restrictions on field updates

**Restrictions**:
- Core fields: Can only update if NO active campaigns
- Phone/Email: Cannot be empty
- Stock Exchange: Must use valid TCR codes (NASDAQ, NYSE, etc.)
- Vertical: Must use valid TCR codes (TECHNOLOGY, COMMUNICATION, etc.)

---

## Lessons Learned

### From Implementation

**1. EIN Verification is Critical**
- Use TinComply to get official legal name
- Saves time and prevents rejections
- "Teliax, Inc." vs "TELIAX INC" matters!

**2. Legal Name Must Be Exact**
- Use EXACT name from IRS/state records
- Case, punctuation, abbreviations matter
- DBA names don't work - use legal name

**3. Database and API Must Stay in Sync**
- Always update both local DB and TCR
- Fetch fresh data after updates
- Return updated values to frontend

**4. TCR API Response Formats Vary**
- Entity types: Array of strings
- Verticals: Object with codes as keys
- Must parse each endpoint correctly

**5. Field Mapping is Critical**
- Database: `legal_name`, `primary_contact_email`
- API: `companyName`, `email`
- Frontend: Must map correctly between all three

**6. Empty Strings Break TCR**
- Filter out empty values before sending
- TCR rejects empty strings for most fields
- Use `field != nil && field != ""` checks

**7. Resubmission is Simple**
- TCR provides `/brand/{id}/revet` endpoint
- One API call, no payload needed
- Returns updated status and trust score
- Works even without recent changes

### From Testing

**Successful Verification** (TELIAX INC):
1. Started with: Legal Name = "Teliax, Inc.", Status = UNVERIFIED
2. Used TinComply to verify EIN 203479949
3. Updated Legal Name = "TELIAX INC" (exact match from TinComply)
4. Clicked "Resubmit Brand"
5. Result: Status = VERIFIED, Trust Score updated

**Key Insight**: Exact legal name matching is the difference between UNVERIFIED and VERIFIED!

---

## Best Practices

### For Initial Registration

1. **Use TinComply EIN Verification**
   - Click "Verify EIN" before submitting
   - Use the exact legal name it returns
   - Don't modify or "clean up" the name

2. **Complete All Optional Fields**
   - Website increases trust
   - Vertical helps TCR categorize
   - Stock info auto-verifies public companies

3. **Use Business Email Domain**
   - Not personal email (Gmail, Yahoo)
   - Use company domain email
   - Required for Auth+ verification

### For Updates

1. **Test with Non-Core Fields First**
   - Update address, website, contacts
   - Verify sync works correctly
   - Then update core fields if needed

2. **Keep Core Changes Together**
   - Update all core fields at once
   - Submit, then resubmit
   - Avoid multiple resubmissions

3. **Monitor TCR Portal**
   - Check [csp.campaignregistry.com](https://csp.campaignregistry.com)
   - Verify data matches exactly
   - Check for any TCR warnings

### For Verification

1. **Auto-Verification First**
   - Ensure data is exactly correct
   - Resubmit if initially failed
   - Free and instant

2. **External Vetting When Needed**
   - If correct data won't auto-verify
   - Worth $40 for 50-100x throughput increase
   - Required for some use cases (political, high-volume)

---

## Technical Details

### API Endpoints

**Brand Operations**:
- `POST /v1/messaging/brands` - Register new brand
- `GET /v1/messaging/brands` - List brands
- `GET /v1/messaging/brands/:id` - Get brand details
- `PATCH /v1/messaging/brands/:id` - Update brand (syncs to TCR)
- `POST /v1/messaging/brands/:id/resubmit` - Resubmit for verification
- `POST /v1/messaging/brands/:id/vetting` - Request external vetting

**TinComply Operations**:
- `GET /v1/tincomply/lookup-ein?ein=203479949` - Lookup company by EIN

**TCR Enumerations**:
- `GET /v1/messaging/entity-types` - Get valid entity types
- `GET /v1/messaging/verticals` - Get valid industry verticals

### Database Schema

**Table**: `messaging.brands_10dlc`

**Key Columns**:
- `id` - UUID (our internal ID)
- `tcr_brand_id` - TCR's brand ID (e.g., "BBPD732")
- `legal_name` - Official registered business name
- `display_name` - Marketing/DBA name
- `entity_type` - Business structure
- `tax_id` - EIN
- `status` - PENDING, REGISTERED, VERIFIED, etc.
- `identity_status` - UNVERIFIED, VERIFIED, VETTED_VERIFIED
- `trust_score` - 0-100 score from TCR

### TCR API Quirks

1. **Vertical is required** for most entity types (except SOLE_PROPRIETOR)
2. **Stock fields required** for PUBLIC_PROFIT entities
3. **Business contact email required** for identity verification
4. **Phone must be E.164 format**: +1XXXXXXXXXX
5. **Stock exchange codes** are specific (no "OTC", use "OTHER")
6. **Empty strings rejected** - omit field instead

---

## Next Steps

With a verified brand, you can now:

1. **Create Messaging Campaigns**
   - See: [docs/integrations/TCR_10DLC_INTEGRATION.md](../integrations/TCR_10DLC_INTEGRATION.md)
   - Guide: [docs/guides/TCR_CAMPAIGN_CREATION_GUIDE.md](TCR_CAMPAIGN_CREATION_GUIDE.md) (to be created)

2. **Assign Phone Numbers**
   - Associate phone numbers with campaigns
   - Required before sending messages

3. **Monitor Throughput**
   - Trust score determines daily limits
   - VERIFIED brands: 40,000 msg/day
   - VETTED brands: 200,000+ msg/day

---

## References

### Documentation
- [TinComply Integration Guide](../api/TINCOMPLY_INTEGRATION_GUIDE.md)
- [TCR 10DLC Integration](../integrations/TCR_10DLC_INTEGRATION.md)
- [Session Summary](../archive/completed-tasks-2025/SESSION_SUMMARY_2025-12-02_TINCOMPLY_TCR_BRAND_UPDATES.md)

### External Links
- [TCR Portal](https://csp.campaignregistry.com)
- [TinComply Dashboard](https://www.tincomply.com/dashboard)
- [TCR API Documentation](https://csp-api.campaignregistry.com/v2/restAPI)

### Code References
- Backend: [services/api-gateway/internal/tcr/](../../services/api-gateway/internal/tcr/)
- Frontend: [apps/customer-portal/src/components/forms/](../../apps/customer-portal/src/components/forms/)

---

**Guide Created**: 2025-12-03
**Status**: ✅ Production-Tested and Verified
**Next Guide**: Campaign Creation (coming soon)
