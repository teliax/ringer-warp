# WARP Platform Billing Flows

## Overview
This document describes the actual billing flows for the WARP platform, incorporating complexity around jurisdiction, rate decks, and multi-vendor management.

## Core Billing Principles

### 1. Rating Complexity
- **Voice Rating**: Based on direction, type, jurisdiction, NPANXX rate deck matching
- **Partition Independence**: Billing rates are NOT tied to routing partitions (Premium/Economy)
- **Margin Management**: Handled by routing engine, not billing
- **Quality Factors**: Managed through manual intervention, out of billing scope

### 2. Account Structure
- **BAN (Billing Account Number)**: Primary billing entity
- **Billing Cycle**: Tied to BAN, not individual products
- **All products under a BAN share the same billing cycle**

## Product Billers

### 1. Voice Termination Biller

#### Rating Factors
```yaml
Primary Dimensions:
  - Direction: Outbound (customer → PSTN)
  - Destination Type: Local, Toll-Free, International
  - Jurisdiction: Interstate, Intrastate, Local
  - NPANXX: Rate deck lookup based on destination
  - LRN: After Telique dip (cached results)
  - Time of Day: Peak/Off-peak rates (if applicable)
```

#### Rating Process
```typescript
interface VoiceTerminationRating {
  // Step 1: LRN Lookup (Required)
  lrn: string;           // From Telique API (failure = call fails)

  // Step 2: Jurisdiction Determination
  jurisdiction: 'INTERSTATE' | 'INTRASTATE' | 'LOCAL';

  // Step 3: Rate Deck Lookup
  rateQuery: {
    customer_ban: string;
    npanxx: string;
    jurisdiction: string;
    effective_date: Date;
  };

  // Step 4: Apply Rate
  rate: number;          // Per-minute rate from rate deck
  duration: number;      // Billable seconds
  increment: number;     // Billing increment (1 or 6 seconds)

  // Step 5: Calculate Charge
  charge: number;        // rate * (duration / 60)
}
```

#### Database Tables Required
```sql
-- Customer rate deck
CREATE TABLE billing.customer_rate_deck (
  id UUID PRIMARY KEY,
  customer_ban VARCHAR(50) NOT NULL,
  npanxx VARCHAR(6) NOT NULL,
  jurisdiction VARCHAR(20) NOT NULL,
  rate DECIMAL(10,7) NOT NULL,
  effective_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_rate_lookup (customer_ban, npanxx, jurisdiction, effective_date DESC)
);

-- Vendor rate deck (for cost tracking)
CREATE TABLE billing.vendor_rate_deck (
  id UUID PRIMARY KEY,
  vendor_id VARCHAR(50) NOT NULL,
  npanxx VARCHAR(6) NOT NULL,
  jurisdiction VARCHAR(20) NOT NULL,
  cost DECIMAL(10,7) NOT NULL,
  effective_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Voice Origination Biller

#### Rating Factors
```yaml
Primary Dimensions:
  - Direction: Inbound (PSTN → customer)
  - Number Type: Local DID, Toll-Free
  - Monthly Recurring: DID rental fees
  - Usage: Inbound minutes
```

#### Billing Components
```typescript
interface VoiceOriginationBilling {
  // Monthly Recurring Charges
  mrc: {
    local_did: 1.00,        // Per DID per month
    tollfree: 2.00,         // Per toll-free per month
  };

  // Usage Charges
  usage: {
    local_inbound: 0.0050,  // Per minute
    tollfree_inbound: 0.0150, // Per minute (higher)
  };

  // Non-Recurring Charges
  nrc: {
    setup_fee: 0,           // One-time setup
    port_fee: 10.00,        // Per number ported
  };
}
```

### 3. SMS/MMS Biller

#### Rating Factors
```yaml
Primary Dimensions:
  - Direction: Outbound, Inbound
  - Message Type: SMS, MMS
  - Number Type: 10DLC, Toll-Free, Short Code
  - Campaign Type: Marketing, Transactional, 2FA
  - Carrier Surcharges: Pass-through fees
```

#### Billing Components
```typescript
interface SMSBilling {
  // Per-Message Rates
  rates: {
    sms_outbound_10dlc: 0.0050,
    sms_outbound_tollfree: 0.0075,
    sms_inbound: 0.0025,
    mms_outbound: 0.0200,
    mms_inbound: 0.0150,
  };

  // Monthly Campaign Fees
  campaign_fees: {
    '10dlc_campaign': 10.00,  // Per campaign per month
    'brand_registration': 4.00, // One-time
  };

  // Carrier Surcharges (Pass-through)
  carrier_fees: {
    att: 0.0020,
    verizon: 0.0020,
    tmobile: 0.0020,
  };
}
```

### 4. Telco Data API Biller

#### Rating Factors
```yaml
Primary Dimensions:
  - API Type: LRN, CNAM, LERG, CIC, RespOrg
  - Volume Tier: Based on monthly usage
  - Query Type: Real-time vs Batch
```

#### Billing Components
```typescript
interface TelcoDataAPIBilling {
  // Per-Query Rates (no tiers initially)
  rates: {
    lrn_lookup: 0.0010,
    cnam_lookup: 0.0040,
    lerg_query: 0.0005,
    cic_lookup: 0.0015,
    resporg_lookup: 0.0020,
  };

  // Billing Method
  method: 'per_query';  // Count and bill each API call
}
```

## Billing Cycles & Payment Models

### Billing Cycle Management
```yaml
BAN Configuration:
  - cycle_day: 1-28 (day of month)
  - payment_terms: NET_0, NET_15, NET_30, NET_60
  - payment_model: PREPAID, POSTPAID

Cycle Rules:
  - All products under BAN bill together
  - MRC charges bill in advance
  - Usage charges bill in arrears
  - No mid-cycle product billing changes
```

### Prepaid Model
```typescript
interface PrepaidFlow {
  // Balance stored in PostgreSQL (not Redis)
  balance_check: {
    table: 'billing.wallets',
    check_before: 'call_authorization',
    minimum_balance: 0.01,
  };

  // Deduction Flow
  deduction: {
    timing: 'post_call',  // After CDR generation
    action: 'UPDATE billing.wallets SET balance = balance - charge',
    edge_case: 'allow_negative_balance_for_active_call',
  };

  // Auto-Recharge
  auto_recharge: {
    trigger_balance: 20.00,
    recharge_amount: 100.00,
    payment_method: 'stored_card',
  };
}
```

### Postpaid Model
```typescript
interface PostpaidFlow {
  // Usage Aggregation
  aggregation: {
    frequency: 'daily',
    storage: 'billing.usage_summary',
    rollup: 'monthly_invoice',
  };

  // Invoice Generation
  invoicing: {
    timing: 'cycle_day + 1',
    system: 'NetSuite',
    delivery: 'email_and_portal',
  };

  // Payment Terms
  payment: {
    due_date: 'invoice_date + payment_terms',
    methods: ['ACH', 'Wire', 'Credit Card'],
  };
}
```

## Proration Logic

### Recurring Charges (MRC)
```typescript
function prorateMonthlyCharge(
  monthlyRate: number,
  startDate: Date,
  billingCycleStart: Date,
  billingCycleEnd: Date
): number {
  const totalDaysInCycle = daysBetween(billingCycleStart, billingCycleEnd);
  const activeDays = daysBetween(startDate, billingCycleEnd);
  return (monthlyRate / totalDaysInCycle) * activeDays;
}
```

### Non-Recurring Charges (NRC)
- **No proration**: Full charge regardless of timing
- **Examples**: Setup fees, port fees, one-time charges

## Vendor Management

### Vendor Billing Cycles
```yaml
Vendors:
  Telnyx:
    cycle: weekly
    payment_method: ACH
    terms: NET_7

  Peerless:
    cycle: monthly
    payment_method: Wire
    terms: NET_30

  Sinch:
    cycle: monthly
    payment_method: ACH
    terms: NET_30

  Telique:
    cycle: monthly
    payment_method: Credit Card
    terms: NET_0
```

### Vendor Reconciliation
```typescript
interface VendorReconciliation {
  // Daily rate deck updates
  rate_updates: {
    frequency: 'daily',
    source: 'vendor_api_or_sftp',
    storage: 'billing.vendor_rate_deck',
  };

  // CDR Matching
  cdr_matching: {
    frequency: 'daily',
    variance_threshold: 0.05, // 5% variance allowed
    mismatch_action: 'flag_for_review',
  };
}
```

## NetSuite Integration

### SKU Mapping
```yaml
NetSuite_SKUs:
  # Voice Termination (rated externally, quantity sent to NetSuite)
  VOICE_TERM: "SKU_VOICE_TERM"  # Quantity = total minutes

  # Voice Origination
  DID_LOCAL_MRC: "SKU_DID_LOCAL"  # Quantity = count of DIDs
  DID_TF_MRC: "SKU_DID_TF"        # Quantity = count of toll-free
  VOICE_ORIG: "SKU_VOICE_ORIG"    # Quantity = inbound minutes

  # SMS/MMS
  SMS_OUT: "SKU_SMS_OUT"           # Quantity = message count
  SMS_IN: "SKU_SMS_IN"             # Quantity = message count
  MMS_OUT: "SKU_MMS_OUT"           # Quantity = message count

  # API
  API_LRN: "SKU_API_LRN"           # Quantity = query count
  API_CNAM: "SKU_API_CNAM"         # Quantity = query count
```

### NetSuite Limitations
- **Cannot handle**: Complex voice rating with jurisdiction/NPANXX
- **Can handle**: SKU-based billing, tiers, discounts, invoice generation
- **Integration pattern**: Send aggregated quantities, not individual CDRs

## Tax Calculation

### Tax Application
```yaml
Tax Strategy:
  - Calculate on NET invoice amount
  - Avalara API call with invoice total
  - Tax-exempt customers flagged in system

USF (Universal Service Fund):
  - Separate calculation
  - Based on interstate revenue only
  - Current rate: ~30% of interstate charges
  - Reported quarterly
```

## Error Handling

### Rating Failures
```yaml
Policy: Zero Tolerance for Rating Failures

On Rating Error:
  1. Block the call/message
  2. Log error with full context
  3. Alert ops team immediately
  4. No dead letter queue - must fix immediately

Critical Dependencies:
  - Telique API (LRN lookups)
  - Rate deck availability
  - Customer configuration
```

### System Dependencies
```typescript
interface SystemDependencies {
  critical: {
    telique: 'Call fails if unavailable',
    postgres: 'All billing stops',
    rate_deck: 'Calls blocked without rates',
  };

  non_critical: {
    netsuite: 'Queue for later sync',
    hubspot: 'Log and continue',
    avalara: 'Use default tax rate',
  };
}
```

## Event Flow Architecture

### HubSpot-NetSuite-WARP Triangle
```yaml
Consideration:
  - NetSuite → HubSpot sync exists
  - WARP → NetSuite for invoicing
  - WARP → HubSpot for customer data

Potential Issues:
  - Circular updates
  - Data consistency
  - Event storms

Recommendation:
  - Define clear data ownership
  - Use event deduplication
  - Implement update timestamps
```

## Database Schema Updates Needed

```sql
-- Add to billing schema
CREATE TABLE billing.ban_configuration (
  ban VARCHAR(50) PRIMARY KEY,
  billing_cycle_day INT CHECK (billing_cycle_day BETWEEN 1 AND 28),
  payment_terms VARCHAR(20) CHECK (payment_terms IN ('NET_0', 'NET_15', 'NET_30', 'NET_60')),
  payment_model VARCHAR(20) CHECK (payment_model IN ('PREPAID', 'POSTPAID')),
  tax_exempt BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add vendor management tables
CREATE TABLE billing.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(100) NOT NULL,
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('WEEKLY', 'MONTHLY')),
  payment_method VARCHAR(20),
  payment_terms VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add rating audit table
CREATE TABLE billing.rating_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---
*This document represents the actual billing implementation requirements, not examples or placeholders.*