### Billing Product Requirements Document (PRD) for WARP Wholesale Telecom Platform

**Version:** 3.0 (Simplified Architecture)  
**Date:** [Current Date]  
**Author:** WARP Engineering Team

**Purpose:** This PRD defines WARP's billing architecture with clear separation of concerns:
- **WARP Platform**: Handles all complex telecom rating, CDR enrichment, jurisdiction determination, and usage aggregation
- **NetSuite**: Handles invoice generation, AR management, and financial reporting based on pre-rated usage data from WARP
- **Data Pipeline**: Kamailio/Jasmin → Poller (enrichment/rating) → BigQuery → Biller (ETL) → NetSuite

**Architecture Principles:**  
- **Service-Specific Data Creation**: Each service (Kamailio for voice, Jasmin for SMS) creates raw records with all available data
- **Centralized Enrichment**: Single poller service enriches all record types (LRN, LERG, jurisdiction, RespOrg)
- **BigQuery as System of Record**: All rated CDRs stored in partitioned BigQuery tables
- **NetSuite for Financials Only**: NetSuite receives aggregated, pre-rated usage mapped to SKUs
- **Vendor Performance Tracking**: Separate CDR stream for vendor attempts and quality metrics

**Key Assumptions (Updated):**  
- NetSuite is pre-configured with SKUs, dynamic pricing tiers, and e-invoicing capabilities.  
- Upstream vendor data (e.g., Sinch CDRs) can be ingested via API/SFTP to BigQuery for reconciliation.  
- Platform handles 100M+ usage records/month; billing must optimize BigQuery costs (e.g., via partitioning).  

**Success Metrics (Enhanced):**  
- 99.99% billing accuracy (validated via automated reconciliation).  
- <50ms average rating latency at peak (1000+ TPS).  
- 20% reduction in disputes through proactive margin alerts and customer portals.  
- Full audit trail for compliance (e.g., FCC/USF reporting).  

#### 1. Data Pipeline Architecture

**Voice CDR Flow:**
1. **Kamailio Routing Engine**: Creates raw CDR with SIP headers (From, RPID, Contact, RURI, P-Asserted-Identity, P-Charge-Info)
2. **Redis/CloudSQL**: Temporary storage of raw CDRs
3. **Poller Service**: 
   - Enriches with LRN data (Telique API for NANPA calls)
   - Enriches with LERG data (rate center, state)
   - Determines jurisdiction (interstate/intrastate/local)
   - Applies customer rating and vendor cost
   - Calculates margin
4. **BigQuery**: Stores enriched and rated CDRs in partitioned tables
5. **Biller Service**: ETLs aggregated usage to NetSuite based on customer billing cycles
6. **NetSuite**: Generates invoices and manages AR

**SMS/MMS Flow:**
- Jasmin creates MDRs → Same poller/BigQuery/NetSuite flow

**Telco API Flow:**
- Already in BigQuery → Biller ETLs to NetSuite

**Vendor CDR Flow:**
- Separate Kamailio pods for vendors → Track attempts, performance, actual costs

**Billing Cycles (Best Practices Integration):**  
- Prepaid: Instant balance updates in Redis; incorporate CSG's recommendation for multiple top-up options (e.g., API, portal, auto-recharge via Authorize.Net). Suspend with 24hr notice.  
- Postpaid: Flexible $N net $N (e.g., 15n15 for mid-month billing); add Deloitte-inspired transformation: Automated reminders and personalized plans (e.g., extend terms for high-volume customers). MRC for DIDs/toll-free ($1-5/mo per number) recognized ratably.  

**Pricing Structures (Enhanced):**  
- Dynamic: Pull from NetSuite SKUs; customer overrides in Cloud SQL. Support AI-driven adjustments (future: use ML for predictive tiers based on usage patterns).  
- Tiers/Commitments: Retrospective discounts (e.g., if actual > committed volume, rebate 10%); track via BigQuery analytics.  
- Margins: Real-time calc (customer_rate - vendor_cost - overhead); flag <15% for rerouting. Incorporate Intellias trends: Use quality metrics (e.g., PDD) in pricing.  
- Taxes/Fees: Avalara integration for real-time calc (e.g., USF at 20.8% Q4 2024); jurisdiction from LRN dips. Add E911 surcharges per DID.  
- Disputes: Per LinkedIn best practices, implement amicable workflows: Automated CDR matching with vendor data; portal for customer disputes (e.g., export mismatched records).  

**System Integrations:**  
- **BigQuery:** Primary storage for all rated CDRs/MDRs - partitioned by date, clustered by customer
- **CloudSQL/Redis:** Temporary storage for raw records from Kamailio/Jasmin
- **NetSuite:** Receives aggregated usage mapped to SKUs - handles invoicing and AR only
- **Telique API:** Real-time LRN lookups (critical dependency - calls fail without)
- **LERG Database:** Rate center and OCN lookups
- **Somos API:** RespOrg lookups for toll-free
- **Avalara:** Tax calculations
- **Authorize.Net/Mustache:** Payment processing

**Key Challenges Addressed (With Research Insights):**  
1. Complex Rating: Modular engines with telco logic (6/6 billing increments for voice); scale to 5000 TPS via sharding.  
2. Multi-Vendor: Daily reconciliation jobs; incorporate Metavshn's operational dynamics for wholesale cost pass-through.  
3. Margin Management: Inline AI-assisted calcs for profitability (e.g., flag routes below threshold).  
4. Real-time Charging: Async with fallbacks; Telgoo5-inspired accuracy via idempotent events.  
5. Compliance: Full logging; support e-invoicing per NetSuite features.  
6. Reconciliation: Automated diffs with dispute escalation.  
7. Customer Experience: CSG best practices – Personalized portals, multi-payment options, real-time visibility.  

#### 2. Core Services Architecture

**Service Components:**

1. **Routing Engine (Kamailio LuaJIT)**
   - Captures all SIP pseudo variables
   - Makes routing decisions
   - Creates raw CDR with vendor selection
   - Stores in Redis/CloudSQL

2. **Poller Service (Python/Go)**
   - Runs every minute
   - Harvests raw CDRs/MDRs
   - Enriches with external data (LRN, LERG, RespOrg)
   - Determines jurisdiction and rate zone
   - Applies rating (customer rate - vendor cost = margin)
   - Stores in BigQuery

3. **Biller Service (Python/TypeScript)**
   - Runs daily at 2 AM
   - Identifies customers to bill (based on cycle day)
   - Extracts usage from BigQuery
   - Maps to NetSuite SKUs
   - ETLs to NetSuite via REST API

4. **NetSuite**
   - Receives pre-rated usage with SKUs
   - Generates invoices
   - Manages AR and collections

**Detailed Components (Expanded):**  
1. **Multiple Billing Engines:** Separate services; shared lib for common logic. Deployment: GKE with HPA (Horizontal Pod Autoscaler) for TPS spikes.  
2. **Real-Time Rating:** Node.js with worker queues; benchmark for <50ms.  
3. **Margin Calculation:** Enhanced formula with overhead sliders; alert via Pub/Sub.  
4. **NetSuite Integration:** API client with batch support; e.g., create invoice then add items in bulk.  
5. **Prepaid/Postpaid:** Redis for balances; add auto-recharge logic.  
6. **Volume Tracking:** BigQuery jobs for rebates; integrate with HubSpot for deal tracking.  
7. **Vendor Reconciliation:** SFTP/API ingestion; automated reports with >5% variance flags.  
8. **Tax Calculation:** Avalara API per event; cache common jurisdictions.  
9. **Credit/Dunning:** Limits with soft/hard suspends; tiered emails (warn, suspend, collections).  
10. **Revenue Recognition:** Split postings (deferred for MRC, immediate for usage) via journal entries.  

**Data Flows (Visualized in Table for Clarity):**

| Stage | Component | Action | Integration |
|-------|-----------|--------|-------------|
| Ingestion | Pub/Sub | Publish CDR/MDR | BigQuery streaming |
| Rating | Product Biller | Lookup rates, calc cost/margin/tax | Cloud SQL, Avalara |
| Charging | Biller | Deduct (prepaid) or aggregate (postpaid) | Redis, Prisma DB |
| Rollup | Aggregation Service | Batch summaries | NetSuite REST API (batch POST) |
| Reconciliation | Recon Engine | Diff vs. vendors | BigQuery queries, reports to SendGrid/HubSpot |

**Security/Compliance (Enhanced):**  
- Auth: Auth0 with RBAC; encrypt sensitive data (e.g., rates).  
- Audit: Immutable logs in BigQuery; support for regulatory exports (e.g., USF filings).  
- Best Practice: Add data anonymization for GDPR; zero-trust for API calls.  

#### 3. Non-Functional Requirements (Scaled Up)
- **Performance:** 5000 TPS peak; use Redis clustering for high concurrency.  
- **Reliability:** 99.999% with circuit breakers; dead-letter queues.  
- **Monitoring:** Grafana dashboards for metrics (e.g., dispute rates, margin averages).  
- **Testing:** E2E with mocked vendors; load tests simulating wholesale traffic.  

#### 4. Implementation Guidelines for Claude (With Expanded Code Scaffolds)
Align with NestJS; incorporate NetSuite best practices (e.g., batch ops to reduce API calls).

**CDR Schema Design:**
```sql
-- Raw CDR from Kamailio
CREATE TABLE billing.raw_cdr (
  -- Identifiers
  id UUID PRIMARY KEY,
  sip_uuid VARCHAR(128) NOT NULL,  -- SIP session UUID
  sip_callid VARCHAR(128) NOT NULL,
  
  -- SIP Headers (Kamailio PVs)
  sip_from VARCHAR(255),       -- $fu pseudo variable
  sip_rpid VARCHAR(255),       -- $rpid
  sip_contact VARCHAR(255),    -- $ct
  sip_ruri VARCHAR(255),       -- $ru
  sip_pai VARCHAR(255),        -- $pai
  sip_pci VARCHAR(255),        -- $pci
  
  -- Basic Info
  customer_ban VARCHAR(50),
  raw_ani VARCHAR(24),
  dni VARCHAR(24),
  direction VARCHAR(20),       -- TERMINATING/ORIGINATING
  
  -- Routing Decision
  selected_vendor VARCHAR(50),
  vendor_trunk VARCHAR(50),
  routing_partition VARCHAR(20),
  
  -- Timestamps
  start_stamp TIMESTAMP,
  answer_stamp TIMESTAMP,
  end_stamp TIMESTAMP,
  
  -- Processing Flags
  enriched BOOLEAN DEFAULT FALSE,
  rated BOOLEAN DEFAULT FALSE,
  exported_to_bq BOOLEAN DEFAULT FALSE
);
```

**Poller Enrichment Logic:**
```typescript
export class CDRPoller {
  private redis: Redis;
  constructor(private prisma: PrismaClient, private bigquery: BigQuery) {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async rateUsage(event: UsageEvent, customerId: string): Promise<RatedUsage> {
    // Cache check for hot rates
    let rate = await this.redis.get(`rate:${event.destination}:${customerId}`);
    if (!rate) {
      rate = await this.prisma.rateDeck.findFirstOrThrow({
        where: { destination: event.destination, effectiveDate: { lte: new Date() } },
        orderBy: { effectiveDate: 'desc' }
      });
      await this.redis.set(`rate:${event.destination}:${customerId}`, JSON.stringify(rate), 'EX', 3600); // 1hr TTL
    } else {
      rate = JSON.parse(rate);
    }

    // Volume query with BigQuery partitioning for efficiency
    const volumeQuery = `SELECT SUM(quantity) as total FROM \`project.usage.cdrs\` 
                         WHERE customer_id = @customerId AND _PARTITIONTIME = @period`;
    const options = { query: volumeQuery, params: { customerId, period: event.period } };
    const [[{ total }]] = await this.bigquery.query(options);

    // Tiered pricing with retrospective logic
    let unitRate = rate.baseRate;
    if (total > rate.tierThreshold) unitRate *= (1 - rate.discountPct / 100);

    // Enhanced margin with quality factor
    const vendorCost = await this.getVendorCost(event.destination); // From Cloud SQL
    const qualityFactor = event.asr > 0.7 ? 1.0 : 0.95; // Discount for low quality
    const margin = ((unitRate * qualityFactor) - vendorCost - rate.overhead) / (unitRate * qualityFactor) * 100;
    if (margin < 15) this.notifyLowMargin(event, margin); // Pub/Sub alert

    // Tax integration (async Avalara call)
    const tax = await this.callAvalaraTax(event.jurisdiction, unitRate * event.quantity);

    return { total: unitRate * event.quantity + tax, margin, details: { volume: total, qualityFactor } };
  }

  private async callAvalaraTax(jurisdiction: string, amount: number) {
    // Implement Axios call to Avalara API; return tax amount
    return amount * 0.125; // Placeholder
  }

  private notifyLowMargin(event: UsageEvent, margin: number) {
    // Publish to Pub/Sub for admin alerts
  }
}
```

**Biller Service (ETL to NetSuite):**
```typescript
// biller-service/app.module.ts
import { Module } from '@nestjs/common';
import { PubSubModule } from '@google-cloud/pubsub'; // Custom or lib
import { EnhancedTelcoRatingEngine } from '../common-rating';

@Module({ imports: [PubSubModule], providers: [VoiceBillerService, EnhancedTelcoRatingEngine] })
export class VoiceBillerModule {}

// voice-biller.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class VoiceBillerService {
  constructor(private ratingEngine: EnhancedTelcoRatingEngine, private netSuiteService: NetSuiteService) {
    // Subscribe to Pub/Sub
    // On message: rate, charge, check for disputes (e.g., if duration mismatch)
  }

  async handleDispute(cdrId: string, vendorCdr: VendorCdr) {
    // Query BigQuery for WARP CDR
    // Diff: if Math.abs(warpDuration - vendorDuration) > 5, flag and notify HubSpot
  }
}
```

**SKU Mapping for NetSuite:**
```typescript
// SKU mapping for NetSuite
export const SKU_MAPPING = {
  // Voice Termination
  'TERMINATING:DOMESTIC:INTERSTATE': 'SKU001',
  'TERMINATING:DOMESTIC:INTRASTATE': 'SKU002',
  'TERMINATING:DOMESTIC:LOCAL': 'SKU003',
  'TERMINATING:TOLLFREE': 'SKU004',
  'TERMINATING:INTERNATIONAL': 'SKU005',
  
  // Voice Origination
  'ORIGINATING:DOMESTIC': 'SKU006',
  'ORIGINATING:TOLLFREE': 'SKU007',
  
  // SMS/MMS
  'SMS:OUTBOUND': 'SKU008',
  'SMS:INBOUND': 'SKU009',
  'MMS:OUTBOUND': 'SKU010',
  'MMS:INBOUND': 'SKU011',
  
  // Telco API
  'API:LRN': 'SKU012',
  'API:CNAM': 'SKU013',
  'API:LERG': 'SKU014',
};

// NetSuite receives only:
// - Customer ID
// - SKU
// - Quantity (minutes/messages/queries)
// - Pre-calculated amount
// - Period dates
```

**Implementation Timeline:**  
- Week 1-2: Kamailio routing engine CDR creation
- Week 3-4: Poller service for enrichment and rating
- Week 5-6: BigQuery storage and Biller ETL service
- Week 7-8: NetSuite integration and testing

**Key Design Decisions:**
- All complex telecom logic stays in WARP
- NetSuite only handles standard financial operations
- BigQuery is the system of record for all usage
- Vendor CDRs tracked separately for performance analytics

