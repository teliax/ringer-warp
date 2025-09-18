# WARP Platform Billing Architecture

## Overview
Comprehensive billing system handling customer charges, vendor payments, taxes, and complex telecom rating across voice, SMS, and toll-free services.

## Billing Components Architecture

### 1. Customer Billing (Revenue)

#### Payment Processing
```yaml
Primary Processor: Authorize.Net
  - Credit/Debit cards
  - PCI compliance via tokenization
  - Recurring billing engine
  - ~2.9% + $0.30 per transaction

ACH Processor: Mustache (Plaid)
  - Bank account transfers
  - Lower fees (~0.8% cap at $5)
  - NET 30/60 terms for enterprise
  - Instant verification via Plaid

Invoice Management: NetSuite
  - Invoice generation
  - AR management
  - Revenue recognition
  - Financial reporting
```

#### Billing Cycles & Models
```typescript
enum BillingModel {
  PREPAID = 'prepaid',        // Pay in advance, deduct from balance
  POSTPAID = 'postpaid',      // Monthly invoice, NET terms
  HYBRID = 'hybrid'           // Prepaid with postpaid overflow
}

interface CustomerBilling {
  model: BillingModel;
  cycle: 'monthly' | 'weekly' | 'daily';
  payment_terms: 'NET_0' | 'NET_30' | 'NET_60';
  credit_limit: number;
  auto_recharge: {
    enabled: boolean;
    threshold: number;
    amount: number;
  };
}
```

### 2. Usage Tracking & Rating

#### Real-time Rating Engine
```typescript
// Voice Call Rating
interface CallRating {
  // Customer rate (what we charge)
  customer_rate: {
    initial_increment: 1,      // First second
    subsequent_increment: 1,   // Per second after
    rate_per_minute: 0.0085,   // $0.0085/min
    connect_fee: 0.0,
    minimum_charge: 0.0001
  };

  // Vendor cost (what we pay)
  vendor_cost: {
    rate_per_minute: 0.0045,   // $0.0045/min
    connect_fee: 0.0,
  };

  // Margin calculation
  margin: 0.004,               // $0.004/min profit
  margin_percentage: 47.06      // 47% margin
}

// SMS Rating
interface SmsRating {
  customer_rate: {
    sms_outbound: 0.0075,      // $0.0075 per SMS
    sms_inbound: 0.0050,       // $0.0050 per SMS
    mms_outbound: 0.0200,      // $0.02 per MMS
    mms_inbound: 0.0150
  };

  vendor_cost: {
    sms_outbound: 0.0045,      // Sinch rate
    carrier_fees: 0.0020       // Carrier surcharges
  };
}
```

#### CDR Processing Pipeline
```yaml
Flow:
  1. Kamailio → CDR Generated
  2. Redis → Temporary storage
  3. Rating Engine → Calculate charges
  4. PostgreSQL → Store rated CDR
  5. BigQuery → Analytics & reporting
  6. NetSuite → Invoice generation

Real-time Balance Updates:
  - Redis: Current balance cache
  - PostgreSQL: Authoritative balance
  - Threshold alerts at 20%, 10%, 5%
```

### 3. Vendor Payment Management

#### Carrier Payments (Outbound)
```yaml
Major Vendors:
  - Telnyx: Weekly ACH, NET 7
  - Peerless: Monthly wire, NET 30
  - Sinch (SMS): Monthly ACH, NET 30
  - Somos (Toll-free): Quarterly, NET 45

Payment Processing:
  - Reconciliation: Daily CDR matching
  - Disputes: 30-day window
  - Auto-pay: ACH for approved vendors
```

### 4. Tax Compliance

#### Avalara Integration
```typescript
interface TaxCalculation {
  federal_usf: 0.334,          // 33.4% of interstate revenue
  state_taxes: {
    sales_tax: 'varies',       // 0-10% by state
    telecom_tax: 'varies',     // State-specific
    e911_fee: 'varies'         // $0.25-3.00 per line
  };
  compliance: {
    form_499: 'quarterly',     // FCC filing
    state_returns: 'monthly'
  }
}
```

### 5. Database Schema

```sql
-- Billing schema
CREATE SCHEMA billing;

-- Customer wallets (prepaid)
CREATE TABLE billing.wallets (
  customer_id UUID PRIMARY KEY,
  balance DECIMAL(10,4) NOT NULL DEFAULT 0,
  credit_limit DECIMAL(10,2) DEFAULT 0,
  auto_recharge_enabled BOOLEAN DEFAULT false,
  auto_recharge_threshold DECIMAL(10,2),
  auto_recharge_amount DECIMAL(10,2),
  last_recharge_at TIMESTAMP,
  low_balance_alert_sent BOOLEAN DEFAULT false
);

-- Transactions ledger
CREATE TABLE billing.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'charge', 'payment', 'refund', 'adjustment'
  amount DECIMAL(10,4) NOT NULL,
  balance_before DECIMAL(10,4) NOT NULL,
  balance_after DECIMAL(10,4) NOT NULL,
  description TEXT,
  reference_type VARCHAR(20), -- 'cdr', 'invoice', 'payment'
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE billing.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(20) UNIQUE,
  customer_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  taxes DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue'
  due_date DATE,
  paid_at TIMESTAMP,
  netsuite_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rate plans
CREATE TABLE billing.rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'voice', 'sms', 'tollfree'
  customer_id UUID, -- NULL for default plans
  rates JSONB NOT NULL, -- Flexible rate structure
  effective_date DATE NOT NULL,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage summary (for quick queries)
CREATE TABLE billing.usage_summary (
  customer_id UUID NOT NULL,
  usage_date DATE NOT NULL,
  voice_minutes DECIMAL(10,2) DEFAULT 0,
  voice_charges DECIMAL(10,4) DEFAULT 0,
  sms_count INTEGER DEFAULT 0,
  sms_charges DECIMAL(10,4) DEFAULT 0,
  toll_free_minutes DECIMAL(10,2) DEFAULT 0,
  toll_free_charges DECIMAL(10,4) DEFAULT 0,
  total_charges DECIMAL(10,4) DEFAULT 0,
  PRIMARY KEY (customer_id, usage_date)
);

-- Payment methods
CREATE TABLE billing.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'card', 'ach', 'wire'
  is_default BOOLEAN DEFAULT false,
  processor VARCHAR(20), -- 'authorize_net', 'mustache'
  processor_token VARCHAR(255), -- Tokenized reference
  last_four VARCHAR(4),
  expiry_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

```yaml
# Balance & Wallet Management
GET    /api/v1/billing/balance
POST   /api/v1/billing/recharge
GET    /api/v1/billing/transactions
POST   /api/v1/billing/set-auto-recharge

# Invoices
GET    /api/v1/billing/invoices
GET    /api/v1/billing/invoices/{id}
GET    /api/v1/billing/invoices/{id}/download
POST   /api/v1/billing/invoices/{id}/pay

# Payment Methods
GET    /api/v1/billing/payment-methods
POST   /api/v1/billing/payment-methods
PUT    /api/v1/billing/payment-methods/{id}
DELETE /api/v1/billing/payment-methods/{id}

# Usage & Reports
GET    /api/v1/billing/usage/current
GET    /api/v1/billing/usage/history
GET    /api/v1/billing/reports/summary
GET    /api/v1/billing/reports/detailed-cdrs

# Rate Plans
GET    /api/v1/billing/rate-plans
GET    /api/v1/billing/rate-plans/{id}
POST   /api/v1/billing/rate-plans/calculate
```

## Integration Architecture

### NetSuite Sync
```typescript
// Hourly sync job
async function syncWithNetSuite() {
  // 1. Export new invoices
  const invoices = await getUnsyncedInvoices();
  for (const invoice of invoices) {
    const nsInvoice = await netsuite.createInvoice({
      customer: invoice.customer_id,
      items: invoice.line_items,
      terms: invoice.payment_terms
    });
    await markInvoiceSynced(invoice.id, nsInvoice.id);
  }

  // 2. Import payments
  const payments = await netsuite.getNewPayments();
  for (const payment of payments) {
    await applyPayment(payment);
  }

  // 3. Update AR aging
  await updateAccountsReceivable();
}
```

### HubSpot Integration
```typescript
// Update deal value based on usage
async function updateHubSpotDealValue(customerId: string) {
  const monthlyUsage = await calculateMonthlyRevenue(customerId);
  await hubspot.updateDeal(customerId, {
    monthly_recurring_revenue: monthlyUsage,
    lifetime_value: monthlyUsage * 24, // 2-year LTV
    payment_status: getPaymentStatus(customerId)
  });
}
```

## Monitoring & Alerts

### Key Metrics
```yaml
Revenue Metrics:
  - Daily/Monthly Recurring Revenue (MRR)
  - Average Revenue Per User (ARPU)
  - Customer Lifetime Value (CLV)
  - Churn rate

Operational Metrics:
  - Payment success rate
  - Average collection period
  - Outstanding receivables
  - Margin by service type

Alerts:
  - Low balance warnings
  - Payment failures
  - Unusual usage patterns
  - Margin threshold breaches
```

### Grafana Dashboards
```yaml
Billing Overview:
  - Real-time revenue
  - Payment processing status
  - Balance distribution
  - Top customers by usage

Financial Health:
  - AR aging
  - Payment method distribution
  - Refund/dispute rates
  - Tax liability estimates
```

## Fraud Prevention

### Real-time Checks
```typescript
interface FraudChecks {
  velocity_limits: {
    max_calls_per_minute: 10,
    max_spend_per_hour: 100,
    max_international_minutes: 60
  };

  suspicious_patterns: {
    rapid_balance_depletion: true,
    multiple_payment_failures: true,
    unusual_destination_patterns: true
  };

  automated_actions: {
    suspend_service: true,
    require_manual_review: true,
    notify_customer: true
  }
}
```

## Reconciliation Process

### Daily Reconciliation
```yaml
Morning (6 AM):
  1. Import vendor CDRs
  2. Match against our CDRs
  3. Flag discrepancies
  4. Calculate vendor costs
  5. Update margin reports

Evening (6 PM):
  1. Process payment settlements
  2. Update customer balances
  3. Generate invoice previews
  4. Send low balance alerts
```

### Monthly Close
```yaml
Day 1-3:
  1. Finalize usage calculations
  2. Apply taxes via Avalara
  3. Generate invoices
  4. Sync to NetSuite

Day 4-5:
  1. Send invoices to customers
  2. Process auto-payments
  3. Update AR records

Day 25-30:
  1. Follow up on overdue accounts
  2. Process vendor payments
  3. Reconcile bank statements
```

## Cost Structure

### Platform Costs
```yaml
Payment Processing:
  - Authorize.Net: 2.9% + $0.30 per transaction
  - Mustache ACH: 0.8% (max $5)
  - Wire transfers: $15-25 per wire

Tax Compliance:
  - Avalara: $3,000/month
  - USF Filing: $500/quarter
  - State filings: $100-500/month per state

Integrations:
  - NetSuite: $10,000/year
  - HubSpot: Included in CRM
  - Billing platform: Custom-built

Estimated Monthly Costs:
  - Payment processing: $5,000-10,000
  - Tax compliance: $4,000
  - Vendor payments: $50,000-200,000
  - Total overhead: ~10% of revenue
```

## Implementation Priorities

### Phase 1: Core Billing (Week 1-2)
- [ ] Payment method management
- [ ] Balance tracking
- [ ] Basic CDR rating
- [ ] Simple invoicing

### Phase 2: Automation (Week 3-4)
- [ ] Auto-recharge
- [ ] NetSuite sync
- [ ] Automated invoicing
- [ ] Payment reconciliation

### Phase 3: Advanced Features (Week 5-6)
- [ ] Complex rate plans
- [ ] Volume discounts
- [ ] Tax calculation
- [ ] Fraud prevention

### Phase 4: Reporting (Week 7-8)
- [ ] Financial dashboards
- [ ] Revenue analytics
- [ ] Margin analysis
- [ ] Predictive metrics

## Security & Compliance

### PCI Compliance
- Never store card numbers
- Use processor tokenization
- TLS for all API calls
- Regular security audits

### Financial Controls
- Segregation of duties
- Audit trails for all changes
- Daily reconciliation
- Monthly financial review

---
*Critical: Billing directly impacts revenue. Test thoroughly before production deployment.*