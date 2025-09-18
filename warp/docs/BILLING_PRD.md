### Billing Product Requirements Document (PRD) for WARP Wholesale Telecom Platform – Rewritten with Grok4 Heavy

**Version:** 2.0 (Enhanced Rewrite)  
**Date:** [Current Date]  
**Author:** Grok4 Heavy (xAI) – Leveraging advanced reasoning, external research on telecom billing best practices (e.g., streamlined accuracy, multi-vendor reconciliation, customer experience optimization from sources like CSG, Telgoo5, and Deloitte), and NetSuite API integration patterns (e.g., automated invoice creation, batch syncing, and payment workflows from Oracle docs and integration guides like Knit and Merge.dev). This rewrite incorporates real-world strategies for scalability, compliance, and efficiency in wholesale telecom billing, ensuring alignment with industry trends like real-time charging, dispute resolution, and AI-driven margin optimization.  

**Purpose:** This enhanced PRD refines the original design for WARP's billing architecture, emphasizing modularity, real-time performance, and robust integrations. It addresses key challenges in wholesale telecom (e.g., complex rating, multi-vendor margins, regulatory compliance) while incorporating best practices such as personalized billing plans, automated dispute handling, and seamless ERP syncing. The system will generate product-specific billers with telco-aware rating engines, integrate deeply with NetSuite for invoicing (using REST API patterns for automated creation and batch updates), and handle prepaid/postpaid models. Usage from BigQuery, rates from Cloud SQL, and rollups to NetSuite ensure accuracy and auditability. Claude will implement in NestJS/TypeScript, with expanded code scaffolds for reliability.

**Scope Enhancements in This Rewrite:**  
- Deeper integration details with NetSuite (e.g., OAuth2 authentication, batch endpoints, error retries).  
- Best practices integration: Real-time customer notifications, dispute workflows, AI-assisted rating for dynamic pricing.  
- Expanded scalability: Support for 5000+ TPS with sharding; volume-based autoscaling.  
- Out of Scope: Full tax compliance engine (leverage Avalara); custom AI models (future phase).  

**Key Assumptions (Updated):**  
- NetSuite is pre-configured with SKUs, dynamic pricing tiers, and e-invoicing capabilities.  
- Upstream vendor data (e.g., Sinch CDRs) can be ingested via API/SFTP to BigQuery for reconciliation.  
- Platform handles 100M+ usage records/month; billing must optimize BigQuery costs (e.g., via partitioning).  

**Success Metrics (Enhanced):**  
- 99.99% billing accuracy (validated via automated reconciliation).  
- <50ms average rating latency at peak (1000+ TPS).  
- 20% reduction in disputes through proactive margin alerts and customer portals.  
- Full audit trail for compliance (e.g., FCC/USF reporting).  

#### 1. Business Requirements (Refined with Industry Best Practices)
**Products and Billing Models (Expanded):**  
Drawing from telecom billing guides (e.g., Telgoo5 and Metavshn), emphasize flexibility in pricing to support wholesale dynamics:  
- **Voice Termination/Origination:** Per-minute CDR rating with jurisdictional splits (e.g., LRN-based interstate/intrastate at 60/40 default, adjustable). Tiers: Commitment-based (e.g., <500K min/mo = $0.006/min; >5M = $0.0025/min with retrospective rebates). Include time-of-day multipliers and quality tiers (ASR/ACD thresholds for premium routing). Prepaid: Real-time deductions with low-balance alerts via SendGrid. Postpaid: $N net $N cycles with grace periods.  
- **SMS/MMS:** Per-message MDR rating, including carrier surcharges (e.g., +$0.003 for MMS attachments). Tiers: Volume-discounted (e.g., 0-100K msgs = $0.003; >1M = $0.0015) with campaign-specific overrides for 10DLC compliance. Handle inbound/outbound separately for A2P regulations.  
- **Telco Data API:** Per-query billing (e.g., LRN = $0.001, CNAM = $0.004) with bulk tiers (e.g., 10K+ queries/mo = 20% discount). Track via API logs; support rate-limiting for prepaid to prevent abuse.  

**Billing Cycles (Best Practices Integration):**  
- Prepaid: Instant balance updates in Redis; incorporate CSG's recommendation for multiple top-up options (e.g., API, portal, auto-recharge via Authorize.Net). Suspend with 24hr notice.  
- Postpaid: Flexible $N net $N (e.g., 15n15 for mid-month billing); add Deloitte-inspired transformation: Automated reminders and personalized plans (e.g., extend terms for high-volume customers). MRC for DIDs/toll-free ($1-5/mo per number) recognized ratably.  

**Pricing Structures (Enhanced):**  
- Dynamic: Pull from NetSuite SKUs; customer overrides in Cloud SQL. Support AI-driven adjustments (future: use ML for predictive tiers based on usage patterns).  
- Tiers/Commitments: Retrospective discounts (e.g., if actual > committed volume, rebate 10%); track via BigQuery analytics.  
- Margins: Real-time calc (customer_rate - vendor_cost - overhead); flag <15% for rerouting. Incorporate Intellias trends: Use quality metrics (e.g., PDD) in pricing.  
- Taxes/Fees: Avalara integration for real-time calc (e.g., USF at 20.8% Q4 2024); jurisdiction from LRN dips. Add E911 surcharges per DID.  
- Disputes: Per LinkedIn best practices, implement amicable workflows: Automated CDR matching with vendor data; portal for customer disputes (e.g., export mismatched records).  

**Integrations (Updated with NetSuite Focus):**  
- **BigQuery:** Partitioned queries for cost-efficiency; stream usage in real-time.  
- **Cloud SQL:** Rate tables with versioning (effective_date) for audit.  
- **NetSuite:** Use SuiteTalk REST API for automated invoice creation (e.g., POST /record/v1/invoice with batch items). Sync via Knit-style automation: Hourly rollups for usage, real-time for payments. Handle e-invoicing for global compliance.  
- **Others:** Pub/Sub for events; Redis for caches; HubSpot for customer sync; Avalara for taxes; SendGrid for notifications. Add payment gateways (Authorize.Net, Mustache) with API hooks for seamless AR.  

**Key Challenges Addressed (With Research Insights):**  
1. Complex Rating: Modular engines with telco logic (6/6 billing increments for voice); scale to 5000 TPS via sharding.  
2. Multi-Vendor: Daily reconciliation jobs; incorporate Metavshn's operational dynamics for wholesale cost pass-through.  
3. Margin Management: Inline AI-assisted calcs for profitability (e.g., flag routes below threshold).  
4. Real-time Charging: Async with fallbacks; Telgoo5-inspired accuracy via idempotent events.  
5. Compliance: Full logging; support e-invoicing per NetSuite features.  
6. Reconciliation: Automated diffs with dispute escalation.  
7. Customer Experience: CSG best practices – Personalized portals, multi-payment options, real-time visibility.  

#### 2. Functional Requirements (Enhanced Architecture)
**Recommended Architecture (Refined):**  
Event-driven microservices with best-practice scalability: Extend /warp/services/ with billers; use Kubernetes autoscaling based on Pub/Sub backlog. Incorporate Salesforce strategies for wholesale: Connected ecosystem with API gateways for external integrations. Pattern:  
- **Event Flow:** Usage → Pub/Sub → Biller → Rating → Charge → Aggregation → NetSuite.  
- **Billers:** Product-specific (voice-biller, sms-biller, api-biller); shared common-rating lib with telco extensions (e.g., jurisdiction splits).  
- **Rating Engine:** Real-time for prepaid; batch for postpaid. Cache rates in Redis; use BigQuery ML for tier predictions (future).  
- **Aggregation/Reconciliation:** Central service with cron jobs; add dispute module querying BigQuery diffs.  
- **NetSuite Pattern:** From Merge.dev guides: OAuth2 auth; batch POSTs for efficiency (e.g., up to 1000 items per call). Error handling: Retries with backoff; webhooks for invoice status updates.  

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

**Enhanced Shared Rating Engine:**
```typescript
// common-rating/rating-engine.ts
import { PrismaClient } from '@prisma/client';
import { BigQuery } from '@google-cloud/bigquery';
import { Redis } from 'ioredis'; // For caching

export class EnhancedTelcoRatingEngine {
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

**Voice Biller with Dispute Handling:**
```typescript
// voice-biller/app.module.ts
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

**NetSuite Service (Batch-Optimized):**
```typescript
// netsuite.service.ts
import axios from 'axios';

export class NetSuiteService {
  private baseUrl = 'https://<account>.suitetalk.api.netsuite.com/services/rest/record/v1';
  private authHeader = { Authorization: `Bearer ${process.env.NETSUITE_OAUTH_TOKEN}` }; // OAuth2 best practice

  async batchAddUsage(invoiceId: string, items: InvoiceItem[]) {
    // Batch up to 1000 items per call for efficiency
    const batches = this.chunkArray(items, 1000);
    for (const batch of batches) {
      const payload = { itemList: { item: batch.map(i => ({ item: { id: i.sku }, quantity: i.qty, rate: i.rate })) } };
      try {
        await axios.patch(`${this.baseUrl}/invoice/${invoiceId}`, payload, { headers: this.authHeader });
      } catch (error) {
        // Retry with exponential backoff (3 attempts)
        await this.retryWithBackoff(() => this.batchAddUsage(invoiceId, batch));
      }
    }
  }

  private chunkArray(array: any[], size: number) {
    // Utility for batching
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, (i + 1) * size));
  }

  private async retryWithBackoff(fn: Function, attempts = 3, delay = 1000) {
    // Implement backoff logic
  }

  async createEInvoice(customerId: string, period: string) {
    // Use NetSuite e-invoicing features for compliance
    const payload = { entity: { id: customerId }, tranDate: period };
    return (await axios.post(`${this.baseUrl}/invoice`, payload, { headers: this.authHeader })).data.id;
  }
}
```

**Next Steps for Claude:**  
- Implement full services with the enhanced scaffolds.  
- Add unit tests for margin/tax calcs; integrate dispute flows.  
- Deploy and monitor with synthetic traffic; refine based on NetSuite API rate limits (e.g., 1000 calls/hour).  

This rewritten PRD is more robust, scalable, and aligned with industry standards. If further research or adjustments are needed, provide details.

