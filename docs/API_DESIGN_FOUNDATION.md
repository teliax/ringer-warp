# WARP Platform API Design - Foundational Architecture

## Overview

This document defines the complete API architecture showing how customers, vendors, trunks, and records interact in an extensible, scalable way.

---

## 🔑 Key Relationships & Data Flow

### **1. How Does a SIP Trunk Belong to a Customer?**

```sql
-- The trunk table has a direct foreign key to customer
voice.trunks.customer_id → accounts.customers.id

-- Example query: Get all trunks for a customer
SELECT t.*, c.company_name
FROM voice.trunks t
JOIN accounts.customers c ON t.customer_id = c.id
WHERE c.ban = 'TEST-001';
```

**API Endpoint:**
```http
GET /api/v1/customers/{customer_id}/trunks
GET /api/v1/customers/by-ban/{ban}/trunks
```

### **2. How Do We Know Which Vendor a Call Should Go To?**

**Answer: Via Partition-Based Routing (from PRD)**

```
Customer → Trunk → Partition → Vendors (priority ordered)
```

**Flow:**
1. Call comes in on trunk → Look up `trunk.customer_id` + `trunk.partition_id`
2. Query `partition_vendors` table for vendor list in that partition
3. Apply LCR (Least Cost Routing) algorithm considering:
   - Vendor rates for destination
   - Vendor capacity/health
   - Priority/weight in partition
4. Select winning vendor
5. Route call to vendor's SIP endpoints

**SQL Example:**
```sql
-- Find best vendor for a call
WITH available_vendors AS (
    SELECT
        v.id, v.vendor_code, v.sip_endpoints,
        vr.rate_per_minute,
        pv.priority
    FROM voice.trunks t
    JOIN voice.partition_vendors pv ON pv.partition_id = t.partition_id
    JOIN voice.vendors v ON v.id = pv.vendor_id
    LEFT JOIN voice.vendor_rates vr ON vr.vendor_id = v.id
        AND vr.rate_type = 'LRN'
        AND vr.rate_key = :called_lrn  -- From Telique dip
    WHERE t.id = :trunk_id
      AND t.status = 'ACTIVE'
      AND v.active = TRUE
      AND pv.active = TRUE
)
SELECT * FROM available_vendors
ORDER BY priority ASC, rate_per_minute ASC
LIMIT 1;
```

### **3. Where Are SMS Records Stored?**

**Two-Tier Storage:**

#### **Tier 1: PostgreSQL (Recent, Operational)**
- Table: `messaging.mdrs_recent`
- Retention: 7 days
- Purpose: Real-time queries, customer portal
- Fast lookups by customer_id

#### **Tier 2: BigQuery (Long-term, Analytics)**
- Dataset: `warp_telecom.mdrs`
- Retention: 7 years (compliance)
- Purpose: Billing, analytics, reporting
- Schema: See `BIGQUERY_CDR_ARCHITECTURE.md`

**Data Flow:**
```
go-smpp Gateway → PostgreSQL (mdrs_recent)
                → Pub/Sub Topic
                → BigQuery Streaming Insert
```

### **4. Where Are Call Detail Records (CDRs) Stored?**

**Same Two-Tier Pattern:**

#### **Tier 1: PostgreSQL (Recent)**
- Table: `voice.cdrs_recent`
- Retention: 7 days
- Purpose: Real-time dashboard

#### **Tier 2: BigQuery (Long-term)**
- Dataset: `warp_telecom.cdrs`
- Full enrichment with:
  - ANI/DNI LRN lookups
  - OCN, LATA, Rate Center
  - Jurisdiction determination
  - Vendor/customer rates
  - Quality metrics (MOS, PDD)

**Data Flow:**
```
Kamailio → CDR Event
        → Enrichment Service (LRN dips, rating)
        → PostgreSQL (cdrs_recent)
        → Pub/Sub Topic
        → Dataflow Pipeline
        → BigQuery (cdrs)
        → NetSuite Export (billing)
```

---

## 📡 **Core API Endpoints**

### **1. Customer Management**

#### Create Customer
```http
POST /api/v1/customers
Content-Type: application/json

{
  "ban": "ACME-001",
  "company_name": "Acme Telecom",
  "customer_type": "POSTPAID",
  "tier": "ENTERPRISE",
  "contact": {
    "name": "John Doe",
    "email": "john@acme.com",
    "phone": "+13035551234"
  },
  "address": {
    "line1": "123 Main St",
    "city": "Denver",
    "state": "CO",
    "zip": "80202",
    "country": "US"
  },
  "billing_cycle": "MONTHLY",
  "custom_fields": {
    "tax_id": "12-3456789",
    "sales_rep": "Jane Smith"
  }
}

Response 201:
{
  "id": "uuid-123",
  "ban": "ACME-001",
  "company_name": "Acme Telecom",
  "status": "ACTIVE",
  "created_at": "2025-10-10T20:00:00Z",
  ...
}
```

#### Get Customer (with relationships)
```http
GET /api/v1/customers/{id}?include=trunks,dids,usage

Response 200:
{
  "id": "uuid-123",
  "ban": "ACME-001",
  "company_name": "Acme Telecom",
  "trunks": [
    {
      "id": "trunk-uuid",
      "trunk_name": "Production Trunk",
      "partition": {
        "code": "STANDARD",
        "name": "Standard Routes"
      },
      "status": "ACTIVE",
      "max_concurrent_calls": 100
    }
  ],
  "dids": [
    {
      "number": "+13035551234",
      "trunk_id": "trunk-uuid",
      "voice_enabled": true,
      "sms_enabled": true
    }
  ],
  "usage_summary": {
    "current_month": {
      "voice_minutes": 12543,
      "sms_count": 5234,
      "total_charges": 1234.56
    }
  }
}
```

### **2. Voice Vendor Management**

#### Create Vendor
```http
POST /api/v1/admin/voice-vendors
Content-Type: application/json

{
  "vendor_code": "level3_primary",
  "vendor_name": "Level 3 Communications",
  "vendor_type": "TIER1",
  "billing_model": "LRN",
  "sip_endpoints": [
    {
      "host": "sip.level3.com",
      "port": 5060,
      "transport": "UDP",
      "priority": 1
    }
  ],
  "auth_type": "IP_ACL",
  "supported_codecs": ["PCMU", "PCMA", "G729"],
  "capacity_cps": 1000,
  "jurisdiction_policy": "BOTH"
}

Response 201:
{
  "id": "vendor-uuid",
  "vendor_code": "level3_primary",
  "vendor_name": "Level 3 Communications",
  "active": true,
  "health_status": "HEALTHY",
  "created_at": "2025-10-10T20:00:00Z"
}
```

#### Assign Vendor to Partition
```http
POST /api/v1/admin/partitions/{partition_id}/vendors
Content-Type: application/json

{
  "vendor_id": "vendor-uuid",
  "priority": 10,
  "weight": 100
}

Response 201:
{
  "partition_id": "partition-uuid",
  "vendor_id": "vendor-uuid",
  "priority": 10,
  "active": true
}
```

### **3. SIP Trunk Management**

#### Create Trunk (Customer-specific)
```http
POST /api/v1/customers/{customer_id}/trunks
Content-Type: application/json

{
  "trunk_name": "Production Trunk",
  "partition_id": "partition-uuid",

  "inbound_config": {
    "auth_type": "IP_ACL",
    "allowed_ips": ["198.51.100.10/32", "198.51.100.11/32"],
    "signaling_addresses": ["sip.warp.ringer.tel"],
    "port": 5060,
    "transport": "UDP"
  },

  "outbound_config": {
    "destination_ips": [
      {
        "ip": "203.0.113.50",
        "port": 5060,
        "transport": "UDP",
        "priority": 1
      }
    ],
    "options_ping": true
  },

  "codecs": ["PCMU", "PCMA"],
  "max_concurrent_calls": 100,
  "calls_per_second_limit": 10,
  "daily_spend_limit": 1000.00
}

Response 201:
{
  "id": "trunk-uuid",
  "customer_id": "customer-uuid",
  "trunk_name": "Production Trunk",
  "partition": {
    "id": "partition-uuid",
    "code": "STANDARD",
    "name": "Standard Routes"
  },
  "status": "ACTIVE",
  "created_at": "2025-10-10T20:00:00Z"
}
```

#### Test Routing for Trunk
```http
POST /api/v1/trunks/{trunk_id}/test-route
Content-Type: application/json

{
  "ani": "+13035551234",
  "dnis": "+12125556789"
}

Response 200:
{
  "trunk": {
    "id": "trunk-uuid",
    "trunk_name": "Production Trunk",
    "customer_ban": "ACME-001"
  },
  "partition": {
    "code": "STANDARD",
    "name": "Standard Routes"
  },
  "routing_decision": {
    "called_lrn": "2125550000",
    "zone": "INTERSTATE",
    "jurisdiction": "INTERSTATE",
    "selected_vendor": {
      "vendor_code": "level3_primary",
      "vendor_name": "Level 3",
      "sip_endpoint": "sip:+12125556789@sip.level3.com",
      "vendor_rate": 0.0045,
      "customer_rate": 0.0065,
      "margin": 0.0020
    },
    "telique_lookup": {
      "lrn": "2125550000",
      "ocn": "6529",
      "lata": "132",
      "state": "NY",
      "carrier_name": "Verizon"
    }
  }
}
```

### **4. DID (Phone Number) Management**

#### Assign Number to Trunk
```http
POST /api/v1/customers/{customer_id}/dids
Content-Type: application/json

{
  "number": "+13035551234",
  "trunk_id": "trunk-uuid",
  "voice_enabled": true,
  "sms_enabled": true,
  "e911_address": {
    "line1": "123 Main St",
    "city": "Denver",
    "state": "CO",
    "zip": "80202"
  }
}

Response 201:
{
  "id": "did-uuid",
  "number": "+13035551234",
  "customer_id": "customer-uuid",
  "trunk_id": "trunk-uuid",
  "voice_enabled": true,
  "sms_enabled": true,
  "status": "ACTIVE"
}
```

### **5. SMS Vendor Management (go-smpp)**

#### Create SMS Vendor
```http
POST /api/v1/admin/sms-vendors
Content-Type: application/json

{
  "vendor_name": "Sinch_Chicago",
  "vendor_type": "SMPP",
  "smpp_config": {
    "host": "msgbrokersmpp-chi.inteliquent.com",
    "port": 3601,
    "system_id": "teluMBc1",
    "password_ref": "secret://sinch-password",
    "tls_enabled": true,
    "bind_type": "transceiver"
  },
  "sms_rate": 0.0075,
  "throughput_limit": 100
}

Response 201:
{
  "id": "sms-vendor-uuid",
  "vendor_name": "Sinch_Chicago",
  "active": true,
  "health_status": "HEALTHY"
}
```

#### Reconnect SMS Vendor (uses go-smpp API)
```http
POST /api/v1/admin/sms-vendors/{vendor_id}/reconnect

Response 200:
{
  "vendor_id": "sms-vendor-uuid",
  "status": "connected",
  "connected_at": "2025-10-10T20:30:00Z"
}
```

### **6. Messaging APIs (Customer-facing)**

#### Send SMS
```http
POST /api/v1/messages/sms
Authorization: Bearer {customer_jwt}
Content-Type: application/json

{
  "from": "+13035551234",
  "to": "+14155556789",
  "body": "Hello from WARP Platform",
  "webhook_url": "https://customer.com/dlr"
}

Response 201:
{
  "message_id": "msg-uuid-123",
  "from": "+13035551234",
  "to": "+14155556789",
  "status": "QUEUED",
  "segments": 1,
  "estimated_cost": 0.0075,
  "created_at": "2025-10-10T20:35:00Z"
}
```

#### Get Message Status
```http
GET /api/v1/messages/{message_id}
Authorization: Bearer {customer_jwt}

Response 200:
{
  "message_id": "msg-uuid-123",
  "from": "+13035551234",
  "to": "+14155556789",
  "status": "DELIVERED",
  "dlr_status": "DELIVERED",
  "segments": 1,
  "cost": 0.0075,
  "submitted_at": "2025-10-10T20:35:00Z",
  "delivered_at": "2025-10-10T20:35:03Z"
}
```

#### List Messages (with filtering)
```http
GET /api/v1/messages?start_date=2025-10-01&end_date=2025-10-10&status=DELIVERED&limit=100
Authorization: Bearer {customer_jwt}

Response 200:
{
  "messages": [
    {
      "message_id": "msg-uuid-123",
      "from": "+13035551234",
      "to": "+14155556789",
      "direction": "OUTBOUND",
      "status": "DELIVERED",
      "segments": 1,
      "cost": 0.0075,
      "created_at": "2025-10-10T20:35:00Z"
    },
    ...
  ],
  "pagination": {
    "total": 5234,
    "page": 1,
    "per_page": 100,
    "total_pages": 53
  }
}
```

### **7. CDR/Usage Queries**

#### Get Recent CDRs (from PostgreSQL)
```http
GET /api/v1/customers/{customer_id}/cdrs/recent?limit=100
Authorization: Bearer {admin_jwt}

Response 200:
{
  "cdrs": [
    {
      "call_id": "call-uuid-123",
      "start_time": "2025-10-10T20:40:00Z",
      "ani": "+13035551234",
      "dnis": "+12125556789",
      "duration_seconds": 245,
      "zone": "INTERSTATE",
      "vendor": "level3_primary",
      "customer_rate": 0.0065,
      "cost": 0.0265,
      "status": "COMPLETED"
    },
    ...
  ]
}
```

#### Get Historical Usage (from BigQuery)
```http
POST /api/v1/analytics/usage-report
Authorization: Bearer {admin_jwt}
Content-Type: application/json

{
  "customer_id": "customer-uuid",
  "start_date": "2025-09-01",
  "end_date": "2025-09-30",
  "group_by": ["zone", "jurisdiction"],
  "include_details": false
}

Response 200:
{
  "report": {
    "customer": {
      "id": "customer-uuid",
      "ban": "ACME-001",
      "company_name": "Acme Telecom"
    },
    "period": {
      "start": "2025-09-01",
      "end": "2025-09-30"
    },
    "summary": {
      "total_calls": 125430,
      "total_minutes": 542341,
      "total_charges": 35252.15
    },
    "breakdown": [
      {
        "zone": "INTERSTATE",
        "jurisdiction": "INTERSTATE",
        "calls": 98234,
        "minutes": 432123,
        "charges": 28088.00
      },
      {
        "zone": "INTRASTATE",
        "jurisdiction": "INTRASTATE_CO",
        "calls": 23456,
        "minutes": 98765,
        "charges": 6421.45
      },
      {
        "zone": "LOCAL",
        "jurisdiction": "LOCAL",
        "calls": 3740,
        "minutes": 11453,
        "charges": 742.70
      }
    ]
  },
  "bigquery_job_id": "bq-job-uuid",
  "query_execution_time_ms": 1234
}
```

---

## 🔄 **Data Flow Diagrams**

### **Voice Call Flow**

```
1. Inbound SIP INVITE arrives
   ├─ Kamailio receives on LoadBalancer IP
   └─ Extracts ANI, DNIS, IP

2. PostgreSQL Lookup
   ├─ Find trunk by source IP (inbound_config)
   ├─ Get customer_id from trunk
   ├─ Get partition_id from trunk
   └─ Verify trunk status = ACTIVE

3. Telique LRN Dip (via API)
   ├─ Look up DNIS LRN
   ├─ Get OCN, LATA, Rate Center, State
   └─ Determine Zone (INTERSTATE, INTRASTATE, LOCAL)

4. Vendor Selection (LCR)
   ├─ Query partition_vendors for partition_id
   ├─ Get rates for each vendor (by LRN)
   ├─ Filter by capacity, health
   ├─ Sort by priority, then rate
   └─ Select winning vendor

5. Route Call
   ├─ Build SIP URI from vendor.sip_endpoints
   ├─ Set codec, DTMF mode from trunk config
   └─ Forward INVITE to vendor

6. CDR Generation
   ├─ On call end, generate CDR
   ├─ Insert to cdrs_recent (PostgreSQL)
   ├─ Publish to Pub/Sub topic
   └─ Async: Stream to BigQuery
```

### **SMS Message Flow**

```
1. Customer sends API request
   POST /api/v1/messages/sms

2. API Gateway
   ├─ Authenticate customer JWT
   ├─ Extract customer_id from token
   ├─ Validate "from" number ownership
   │  └─ SELECT * FROM voice.dids
   │      WHERE number = :from
   │      AND customer_id = :customer_id
   │      AND sms_enabled = TRUE
   └─ Check rate limits

3. go-smpp Gateway
   ├─ API forwards to go-smpp
   ├─ Select vendor (active SMPP bind)
   ├─ Submit to Sinch via SMPP
   └─ Store DLR tracking in Redis

4. Record Creation
   ├─ Insert to mdrs_recent (PostgreSQL)
   ├─ Publish to Pub/Sub
   └─ Async: Stream to BigQuery

5. DLR Callback
   ├─ Sinch sends DLR via SMPP
   ├─ go-smpp updates Redis
   ├─ Update mdrs_recent status
   ├─ POST to customer webhook_url
   └─ Update BigQuery record
```

---

## 🎯 **Testing Plan - Admin Portal Integration**

### **Step 1: Create Test Customer via API**

```bash
# Create customer
curl -X POST https://api.ringer.tel/v1/customers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ban": "TEST-001",
    "company_name": "Test Customer Inc",
    "customer_type": "POSTPAID",
    "contact": {"name": "Test User", "email": "test@example.com"}
  }'

# Response: {"id": "customer-uuid", ...}
```

### **Step 2: Create SIP Trunk for Customer**

```bash
curl -X POST https://api.ringer.tel/v1/customers/customer-uuid/trunks \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "trunk_name": "Test Trunk",
    "partition_id": "standard-partition-uuid",
    "inbound_config": {
      "auth_type": "IP_ACL",
      "allowed_ips": ["YOUR_TEST_IP/32"]
    }
  }'

# Response: {"id": "trunk-uuid", ...}
```

### **Step 3: Assign Phone Number**

```bash
curl -X POST https://api.ringer.tel/v1/customers/customer-uuid/dids \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "number": "+13035559999",
    "trunk_id": "trunk-uuid",
    "voice_enabled": true,
    "sms_enabled": true
  }'
```

### **Step 4: Configure SMS for Customer**

```bash
curl -X POST https://api.ringer.tel/v1/customers/customer-uuid/sms-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "webhook_url": "https://webhook.site/unique-id",
    "messages_per_second": 10
  }'
```

### **Step 5: Send Test SMS**

```bash
# Get customer JWT token first
TOKEN=$(curl -X POST https://api.ringer.tel/v1/auth/token \
  -d '{"customer_id": "customer-uuid"}' | jq -r '.token')

# Send SMS
curl -X POST https://api.ringer.tel/v1/messages/sms \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "from": "+13035559999",
    "to": "+YOUR_MOBILE_NUMBER",
    "body": "Test message from WARP Platform"
  }'

# Response: {"message_id": "msg-uuid", "status": "QUEUED"}
```

### **Step 6: Verify in Admin Portal**

Admin portal should show:
- Customer created with BAN TEST-001
- 1 trunk associated
- 1 DID assigned
- 1 message sent (in recent messages table)
- Message status updates via DLR

---

## 🔐 **Authentication & Authorization**

### **Admin Endpoints**
- Require `admin` role JWT
- Full access to all customers/vendors

### **Customer Endpoints**
- Require customer JWT with `customer_id` claim
- Scoped to their own resources only
- Rate limited per customer

### **JWT Token Structure**

```json
{
  "sub": "user-uuid",
  "customer_id": "customer-uuid",
  "ban": "ACME-001",
  "role": "customer_admin",
  "scope": ["voice", "messaging", "billing"],
  "exp": 1696982400
}
```

---

## ✅ **Summary**

**You asked:**
1. ✅ **How does trunk belong to customer?** → `trunks.customer_id` FK
2. ✅ **How do we know which vendor for a call?** → Partition-based routing via `trunk.partition_id` → `partition_vendors`
3. ✅ **Where are SMS records stored?** → PostgreSQL (recent 7 days) + BigQuery (7 years)
4. ✅ **Where are CDRs stored?** → PostgreSQL (recent 7 days) + BigQuery (7 years with full enrichment)

**Next Steps:**
1. Implement these APIs in Go
2. Integrate with admin-portal
3. Create test customer and run end-to-end test
4. Build out BigQuery streaming pipeline

Ready to start building the Go API Gateway with these endpoints?
