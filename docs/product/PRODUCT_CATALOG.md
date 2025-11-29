# WARP Platform Product Catalog

## Overview
WARP offers four core products for wholesale telecom carriers. SIP trunking is the technical delivery mechanism for voice services, not a separate product.

## 1. Voice Termination Service

### Description
Customer sends SIP traffic to WARP for termination to the PSTN. We handle the routing, quality selection, and delivery to final destinations.

### Billable Components
- **Local Termination**: Calls to geographic numbers (NPANXX)
  - Interstate: Calls crossing state boundaries
  - Intrastate: Calls within same state
  - Local: LATA-level local calls
- **Toll-Free Termination**: Calls to 8YY numbers
- **International Termination**: Calls to international destinations
  - Standard international zones
  - Zone 1 (premium/special destinations)

### Billing Model
- Per-minute billing with per-second increments
- Rates vary by:
  - Destination (NPANXX for domestic, country for international)
  - Jurisdiction (interstate vs intrastate)
  - Quality tier (Premium, Standard, Economy routes)
  - Volume commitments
  - Time of day (optional)

### Technical Delivery
- Via SIP trunks (included, not separately billed)
- IP authentication or SIP registration
- Multiple concurrent calls supported

### Database Item Types
```sql
-- item_type values for billing.invoice_items
'VOICE_TERM_LOCAL_INTER'    -- Interstate termination
'VOICE_TERM_LOCAL_INTRA'    -- Intrastate termination
'VOICE_TERM_LOCAL'          -- Local termination
'VOICE_TERM_TOLLFREE'       -- 8YY termination
'VOICE_TERM_INTL'           -- International termination
'VOICE_TERM_ZONE1'          -- Zone 1 termination
```

## 2. Voice Origination Service

### Description
WARP delivers inbound PSTN calls to customer endpoints. Includes both geographic DIDs and toll-free numbers.

### Billable Components
- **Local DID Service**
  - Monthly DID rental fee
  - Per-minute inbound usage
  - Optional features (CNAM, E911)

- **Toll-Free Service** (8XX numbers)
  - Monthly toll-free number rental
  - Per-minute inbound usage (typically higher rate than local)
  - RespOrg management included

### Billing Model
- Monthly recurring charges for number rental
- Per-minute usage charges for inbound calls
- Setup fees for new numbers (optional)
- Number porting fees (one-time)

### Technical Delivery
- Via SIP trunks (included, not separately billed)
- Delivered to customer-specified SIP endpoints
- Failover routing available

### Database Item Types
```sql
-- item_type values for billing.invoice_items
'DID_LOCAL_MONTHLY'         -- Local DID monthly rental
'DID_LOCAL_USAGE'           -- Local DID inbound minutes
'DID_TOLLFREE_MONTHLY'      -- Toll-free monthly rental
'DID_TOLLFREE_USAGE'        -- Toll-free inbound minutes
'DID_PORT_FEE'              -- Number porting fee
'DID_SETUP_FEE'             -- New number setup
```

## 3. SMS/MMS Messaging Service

### Description
A2P (Application-to-Person) messaging service for sending and receiving SMS and MMS messages.

### Billable Components
- **Outbound Messaging**
  - SMS outbound (per message)
  - MMS outbound (per message, higher rate)
  - 10DLC campaign fees (monthly)
  - Short code rental (future)

- **Inbound Messaging**
  - SMS inbound (per message)
  - MMS inbound (per message)
  - Webhook delivery included

### Billing Model
- Per-message charges
- Monthly campaign fees for 10DLC
- Carrier surcharges passed through
- Volume discounts available

### Compliance Fees
- TCR brand registration (one-time)
- TCR campaign fees (monthly per campaign)
- Carrier surcharges (per message)

### Database Item Types
```sql
-- item_type values for billing.invoice_items
'SMS_OUTBOUND'              -- Outbound SMS messages
'SMS_INBOUND'               -- Inbound SMS messages
'MMS_OUTBOUND'              -- Outbound MMS messages
'MMS_INBOUND'               -- Inbound MMS messages
'SMS_10DLC_CAMPAIGN'        -- Monthly campaign fee
'SMS_CARRIER_FEE'           -- Carrier surcharges
'SMS_TCR_BRAND'             -- Brand registration (one-time)
```

## 4. Telco Data API Service

### Description
RESTful API providing real-time telecom data lookups for routing, validation, and enrichment.

### Billable Components
- **LRN API**: Local Routing Number lookups for ported numbers
- **CNAM API**: Caller ID name lookups
- **LERG API**: Exchange routing and carrier data
- **CIC API**: Toll-free carrier identification
- **RespOrg API**: Toll-free responsible organization lookups
- **LSMS API**: Porting database queries
- **Carrier Lookup**: OCN and carrier name identification

### Billing Model
- Per-query charges (typically $0.001 - $0.005 per lookup)
- Volume discounts with tiers:
  - Tier 1: 0-100k queries/month
  - Tier 2: 100k-1M queries/month
  - Tier 3: 1M+ queries/month
- Optional: Flat-rate unlimited plans for high-volume users
- Caching permitted (reduces queries)

### API Rate Limits
- Based on subscription tier
- Burst allowances for peak usage

### Database Item Types
```sql
-- item_type values for billing.invoice_items
'API_LRN_LOOKUP'            -- LRN queries
'API_CNAM_LOOKUP'           -- CNAM queries
'API_LERG_LOOKUP'           -- LERG queries
'API_CIC_LOOKUP'            -- CIC queries
'API_RESPORG_LOOKUP'        -- RespOrg queries
'API_LSMS_LOOKUP'           -- LSMS queries
'API_CARRIER_LOOKUP'        -- Carrier identification
'API_BUNDLE_MONTHLY'        -- Flat-rate API bundle
```

## Products NOT Separately Billed

### SIP Trunking
- Technical delivery mechanism for voice services
- Configuration included with voice origination/termination
- No separate "trunk rental" fees
- Concurrent call capacity based on customer needs
- IP authentication or registration included

### Additional Services Included
- CDR access via portal/API
- Real-time usage monitoring
- Basic reporting and analytics
- Webhook notifications
- Portal access

## Billing Considerations by Product

### Voice Services (Termination & Origination)
- Minimum call duration: 1 second
- Billing increment: 1 second (after minimum)
- Connect fees: Optional per carrier agreement
- Failed calls: No charge (except PDD charges if applicable)

### SMS/MMS Services
- Billed on delivery attempt (not delivery confirmation)
- Long messages count as multiple segments
- International SMS requires special agreement

### Telco Data API
- Cached responses permitted (customer side)
- Bulk download options for LERG data
- Real-time queries for LRN (no caching due to porting)

## Volume Commitments & Discounts

### Voice Commitments
- Monthly minimum commitments available
- Tiered pricing based on volume:
  - < 100k minutes/month: Standard rates
  - 100k-1M minutes/month: Tier 2 discount
  - 1M-10M minutes/month: Tier 3 discount
  - > 10M minutes/month: Negotiated rates

### SMS Commitments
- Based on monthly message volume
- Separate tiers for SMS and MMS

### API Commitments
- Based on monthly query volume
- Option for unlimited plans at high volumes

## Rate Plan Types

### Standard Rate Plans
- Published rates per destination/service
- No commitment required
- Month-to-month terms

### Committed Rate Plans
- Discounted rates for volume commitments
- Typically 12-month terms
- Shortfall penalties for under-usage

### Blended Rate Plans
- Single rate for groups of destinations
- Simplified billing
- Available for high-volume customers

### Custom Rate Plans
- Negotiated rates for enterprise customers
- Custom terms and conditions
- May include SLAs and quality guarantees

---

*Note: This product catalog defines billable products and services. Technical implementation details like SIP trunking are delivery mechanisms, not separate commercial products.*