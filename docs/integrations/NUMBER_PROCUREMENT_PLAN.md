# WARP Platform - Number Procurement & Management Plan

**Document Version**: 1.0.0
**Date**: October 27, 2025
**Status**: Planning Phase
**Owner**: Platform Engineering Team

---

## Executive Summary

This document outlines the complete strategy for telephone number procurement and management in the WARP platform. Numbers (DIDs) are **foundational infrastructure** required before WARP can provide:

- ✅ Inbound voice routing (SIP trunking)
- ✅ SMS messaging (inbound/outbound)
- ✅ MMS messaging
- ✅ Fax services
- ✅ E911 emergency services
- ✅ CNAM (Caller ID Name)

**Current State**: WARP database has comprehensive DID schema but **ZERO numbers in inventory** (voice.dids table empty).

**Source of Truth**: **Teliport (formerly SOA)** - Ringer's internal Service Order Acceptance platform at `https://soa-api.ringer.tel`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Teliport Integration](#teliport-integration)
3. [Number Procurement Workflows](#number-procurement-workflows)
4. [Number Porting Workflows](#number-porting-workflows)
5. [Database Schema Mapping](#database-schema-mapping)
6. [API Gateway Implementation](#api-gateway-implementation)
7. [Admin & Customer Portal Features](#admin--customer-portal-features)
8. [Implementation Phases](#implementation-phases)
9. [Testing Strategy](#testing-strategy)
10. [Production Readiness](#production-readiness)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     WARP Platform                           │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │ Admin Portal │    │ Customer     │    │  API        │  │
│  │ (Number      │───▶│  Portal      │───▶│  Gateway    │  │
│  │  Management) │    │ (Self-serve) │    │  (Go)       │  │
│  └──────────────┘    └──────────────┘    └──────┬──────┘  │
│                                                   │         │
│  ┌──────────────────────────────────────────────┼──────┐  │
│  │  PostgreSQL (voice.dids)                     │      │  │
│  │  - DID inventory (local cache)               │      │  │
│  │  - Customer assignments                      │      │  │
│  │  - Routing configuration                     │      │  │
│  └──────────────────────────────────────────────┼──────┘  │
└────────────────────────────────────────────────┼──────────┘
                                                  │
                                                  │ HTTPS/REST
                                                  ↓
┌─────────────────────────────────────────────────────────────┐
│               Teliport (SOA Platform)                       │
│          https://soa-api.ringer.tel/api/v1                  │
│                                                             │
│  ┌──────────────────────┐    ┌────────────────────────┐   │
│  │  Inventory API       │    │  Portability API       │   │
│  │  v2.11.0             │    │  v2.0.0                │   │
│  │                      │    │                        │   │
│  │  • Search numbers    │    │  • Port projects       │   │
│  │  • Reserve           │    │  • CSV/Excel upload    │   │
│  │  • Assign            │    │  • Lifecycle tracking  │   │
│  │  • Update metadata   │    │  • Batch operations    │   │
│  │  • Release           │    │  • NPAC integration    │   │
│  └──────────────────────┘    └────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Master Inventory Database                          │  │
│  │  - 100,000+ DIDs available                          │  │
│  │  - Real-time NPAC sync                              │  │
│  │  - LERG/LRN data                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Number Procurement (New Numbers)**:
```
1. Customer searches numbers (by area code, city, pattern)
   ↓
2. WARP API Gateway → Teliport Inventory API (search)
   ↓
3. Results displayed in Customer Portal
   ↓
4. Customer selects number(s) → Reserve (15-minute hold)
   ↓
5. Customer confirms → Assign (with WARP metadata: BAN, customer_id, etc.)
   ↓
6. WARP receives confirmation → Insert into voice.dids
   ↓
7. Number ready for voice/SMS routing configuration
```

**Number Porting (Import from Other Carriers)**:
```
1. Customer creates port project in Customer Portal
   ↓
2. Upload CSV/Excel with numbers + carrier info
   ↓
3. WARP API Gateway → Teliport Portability API (create project)
   ↓
4. Async validation against NPAC (15-30 minutes)
   ↓
5. Customer reviews validation errors, fixes, resubmits
   ↓
6. Submit port order (FOC date: 3-7 business days)
   ↓
7. Track progress: PENDING → SUBMITTED → FOC → ACTIVE
   ↓
8. On activation → WARP receives webhook → Insert into voice.dids
```

---

## Teliport Integration

### Authentication & Authorization

**API Token Requirements**:

```yaml
Token Format: rng_<48_character_random_string>
Token Creation: SOA Dashboard → Customers → Create Token

Required Permissions (Gatekeeper operations):
  inventory:search     # Search and view inventory
  inventory:reserve    # Reserve numbers temporarily
  inventory:assign     # Assign numbers with metadata
  inventory:release    # Release numbers back to pool
  portability:read     # View port projects
  portability:write    # Create/update port projects
  portability:submit   # Submit ports to NPAC

Token Scoping:
  - SPID: 567G (Ringer's Service Provider ID)
  - IP Whitelist: (optional - WARP API Gateway IPs)
  - Rate Limit: 100 requests/minute per customer
  - Expiration: Never (rotate quarterly for security)
```

**Storing the Token**:

```yaml
# Kubernetes Secret (warp-api namespace)
apiVersion: v1
kind: Secret
metadata:
  name: teliport-api-credentials
  namespace: warp-api
type: Opaque
stringData:
  TELIPORT_API_URL: "https://soa-api.ringer.tel/api/v1"
  TELIPORT_API_TOKEN: "rng_<actual_token_here>"
  TELIPORT_SPID: "567G"
```

**API Client Configuration** (`services/api-gateway/internal/teliport/client.go`):

```go
type TeliportClient struct {
    baseURL    string
    apiToken   string
    spid       string
    httpClient *http.Client
}

func NewTeliportClient(config *Config) *TeliportClient {
    return &TeliportClient{
        baseURL:  config.TeliportAPIURL,
        apiToken: config.TeliportAPIToken,
        spid:     config.TeliportSPID,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *TeliportClient) makeRequest(method, endpoint string, body interface{}) (*http.Response, error) {
    // Add Authorization: Bearer <token>
    // Add Content-Type: application/json
    // Handle rate limiting (429) with exponential backoff
    // Log all requests for audit
}
```

### API Endpoints (Teliport)

#### Inventory API (Number Procurement)

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/inventory/query` | POST | **Search numbers** by NPA, NXX, state, locality | `{"query": "status=available and npa=303", "page": 0, "size": 50}` | Array of TNs with metadata |
| `/inventory/query/validate` | POST | **Validate query syntax** | `{"query": "status=available"}` | `{"valid": true, "parsedQuery": "..."}` |
| `/inventory/summary` | GET | **Get inventory stats** | `?spid=567G` | Counts by status (available, reserved, in_use) |
| `/inventory/numbers/{tn}` | GET | **Get number details** | Path: `/inventory/numbers/3035551234` | Full TN record with metadata |
| `/inventory/numbers/{tn}/reserve` | POST | **Reserve number** (15-min hold) | `{"reservedBy": "WARP-customer-123"}` | Reserved until timestamp |
| `/inventory/numbers/{tn}/assign` | POST | **Assign & activate** | `{"applicationId": "WARP", "metadata": {"ban": "TB-071161708", "customer_id": "uuid"}}` | Assigned, status=IN_USE |
| `/inventory/numbers/{tn}/metadata` | PUT | **Update metadata** | `{"metadata": {"trunk_id": "uuid", "sms_enabled": true}}` | Updated metadata |
| `/inventory/numbers/{tn}/release` | POST | **Release to pool** | `{}` | Status=AVAILABLE |

**Query Language Examples**:

```sql
-- Simple search by area code
status=available and npa=303

-- Multi-value search (multiple area codes)
npa in (303,720,970) and status=available

-- Search by city
locality or lata_name contains "denver" and status=available

-- Complex query with metadata
(status=available or status=reserved) and metadata.customer_type=postpaid

-- LATA-based search
lata in (656,658) and status=available and ported=in
```

#### Portability API (Number Porting)

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/port-projects/projects` | POST | **Create port project** | `{"name": "Q4 2025 Port", "spid": "567G", "description": "..."}` | Project UUID |
| `/port-projects/projects` | GET | **List projects** | `?page=0&size=20` | Paginated project list |
| `/port-projects/projects/{id}` | GET | **Get project details** | Path: `/port-projects/projects/{uuid}` | Full project with stats |
| `/port-projects/projects/{id}/upload` | POST | **Upload CSV/Excel** | `multipart/form-data` file | `202 Accepted` + job ID |
| `/port-projects/projects/{id}/progress` | GET | **Track upload progress** | Path param: project ID | Validation status, TN counts |
| `/port-projects/projects/{id}/details` | GET | **Get project TNs** | `?page=0&size=100` | Paginated TN list with statuses |
| `/port-projects/projects/{id}/validate` | POST | **Bulk validate TNs** | `{}` (async) | Job ID for tracking |
| `/port-projects/projects/{id}/submit` | POST | **Submit to NPAC** | `{"focDate": "2025-11-15"}` | Submission confirmation |
| `/port-projects/projects/{id}/activate` | POST | **Activate ported TNs** | `{"tnList": ["303555..."] }` | Activation results |

**CSV Upload Format**:

```csv
telephone_number,lsp_name,lsp_spid,btn,account_number,pin,notes
3035551234,Verizon,1234,3035551200,ACC-9876,1234,Main office
7205552345,AT&T,5678,7205552300,12345678,5678,Branch location
```

---

## Number Procurement Workflows

### Workflow 1: Search & Reserve Numbers

**User Story**: Customer wants to find available numbers in Denver, CO (area codes 303/720).

**Steps**:

1. **Customer Portal**: Navigate to Numbers → Acquisition
2. **Search Form**:
   ```json
   {
     "searchType": "area_code",
     "npa": "303",
     "quantity": 50,
     "features": {
       "sms_enabled": true,
       "voice_enabled": true
     }
   }
   ```
3. **WARP API**: `POST /v1/numbers/search`
   - Translates to Teliport query: `npa=303 and status=available`
   - Calls: `POST https://soa-api.ringer.tel/api/v1/inventory/query`
4. **Teliport Response**:
   ```json
   {
     "content": [
       {
         "telephoneNumber": "3035551234",
         "npa": "303",
         "nxx": "555",
         "locality": "DENVER",
         "state": "CO",
         "lata": "656",
         "status": "AVAILABLE"
       }
     ],
     "totalElements": 4327,
     "page": 0
   }
   ```
5. **Display Results**: Customer sees 50 available numbers with pricing
6. **Customer Selects**: Checks 5 numbers → Click "Reserve"
7. **WARP API**: `POST /v1/numbers/reserve`
   - Loops through selected TNs
   - For each: `POST /inventory/numbers/{tn}/reserve`
   - Teliport holds for 15 minutes
8. **Shopping Cart UI**:
   - Shows reserved numbers with countdown timer (15:00)
   - Displays total monthly cost
   - "Checkout" button
9. **Customer Confirms**: Click "Purchase Numbers"
10. **WARP API**: `POST /v1/numbers/assign-batch`
    - For each TN: `POST /inventory/numbers/{tn}/assign`
    - Metadata sent:
      ```json
      {
        "applicationId": "WARP",
        "metadata": {
          "customer_id": "uuid-here",
          "ban": "TB-071161708",
          "company_name": "Test Account",
          "platform": "Kamailio",
          "assigned_by": "david.aldworth@ringer.tel",
          "assigned_at": "2025-10-27T12:00:00Z"
        }
      }
      ```
11. **Insert into WARP Database**:
    ```sql
    INSERT INTO voice.dids (
      number, customer_id, status,
      voice_enabled, sms_enabled,
      acquired_date, custom_fields
    ) VALUES (
      '3035551234',
      'customer-uuid',
      'ACTIVE',
      true,
      true,
      CURRENT_DATE,
      '{"teliport_assigned": true}'::jsonb
    );
    ```
12. **Success Notification**:
    - Email to customer
    - Toast in portal: "5 numbers successfully assigned"
13. **Next Step**: Customer configures routing (SIP trunk assignment)

**Error Handling**:

- **Reservation Expired**: If customer takes >15 minutes, show error: "Reservation expired. Please search again."
- **Number No Longer Available**: If assign fails, release remaining reservations, show which numbers failed
- **Rate Limit Hit**: Show "Too many requests, please wait 60 seconds" with countdown

---

### Workflow 2: Bulk Number Import (CSV) - **future feature**

**User Story**: Customer has 500 existing numbers they want to import into WARP (not porting, just configuration).

**Steps**:

1. **Admin Portal**: Numbers → Bulk Import
2. **Upload CSV**:
   ```csv
   telephone_number,friendly_name,sms_enabled,voice_enabled
   3035551234,Main Office,true,true
   7205552345,Branch 1,true,true
   ```
3. **WARP API**: `POST /v1/numbers/bulk-import`
   - Validates CSV format
   - For each TN: Check if exists in Teliport
   - If exists and available: Reserve → Assign
   - If already assigned to this customer: Skip
   - If assigned to different customer: Error
4. **Background Job**: Process async (large files)
   - Create job record: `import_job` table
   - Status: PROCESSING
   - Progress: 0/500 TNs
5. **Job Processing**:
   ```go
   for _, tn := range csvRows {
       // Check Teliport
       tnDetails, err := teliportClient.GetNumber(tn.TelephoneNumber)

       if err != nil {
           job.AddError(tn, "Not found in inventory")
           continue
       }

       if tnDetails.Status == "AVAILABLE" {
           // Assign to customer
           err = teliportClient.AssignNumber(tn.TelephoneNumber, metadata)
           if err != nil {
               job.AddError(tn, err.Error())
               continue
           }
       }

       // Insert into WARP
       err = db.InsertDID(tn)
       if err != nil {
           job.AddError(tn, err.Error())
           // Rollback: Release from Teliport
           teliportClient.ReleaseNumber(tn.TelephoneNumber)
           continue
       }

       job.IncrementSuccess()
   }
   ```
6. **Progress Tracking**: Poll `/v1/numbers/import-jobs/{id}`
   ```json
   {
     "status": "PROCESSING",
     "totalTNs": 500,
     "processed": 347,
     "successful": 340,
     "failed": 7,
     "errors": [
       {"tn": "3035551111", "error": "Not found in inventory"},
       {"tn": "7205552222", "error": "Already assigned to another customer"}
     ]
   }
   ```
7. **Completion**:
   - Email: "Bulk import complete: 493/500 successful, 7 errors"
   - Download error CSV for manual review

---

## Number Porting Workflows

### Workflow 3: Port Numbers from Another Carrier

**User Story**: Customer wants to port 100 numbers from Verizon to WARP.

**Steps**:

1. **Customer Portal**: Numbers → Porting → Create Port Project
2. **Create Project Form**:
   ```json
   {
     "name": "Verizon Port - Nov 2025",
     "description": "Porting main office numbers from Verizon",
     "requestedFOCDate": "2025-11-15",
     "losingCarrier": "Verizon",
     "authorizedPerson": "John Doe",
     "authorizedTitle": "CEO"
   }
   ```
3. **WARP API**: `POST /v1/porting/projects`
   - Creates project in WARP database
   - Calls Teliport: `POST /api/v1/port-projects/projects`
   - Stores Teliport project ID
4. **Upload Numbers**:
   - CSV/Excel file with TNs + current account info
   - Required fields: telephone_number, lsp_name, btn, account_number, pin
5. **WARP API**: `POST /v1/porting/projects/{id}/upload`
   - Proxies to Teliport: `POST /port-projects/projects/{teliportProjectId}/upload`
   - Response: `202 Accepted` + job ID
6. **Async Validation** (15-30 minutes):
   - Teliport validates each TN against NPAC
   - Checks: Is TN active? Correct carrier? BTN valid?
7. **Poll Progress**:
   ```javascript
   // Customer Portal polls every 5 seconds
   GET /v1/porting/projects/{id}/progress

   Response:
   {
     "status": "VALIDATING",
     "totalTNs": 100,
     "validated": 73,
     "errors": 12,
     "validationRate": "~5 TNs/second"
   }
   ```
8. **Review Validation Errors**:
   ```json
   {
     "tn": "3035551111",
     "error": "BTN mismatch. Expected: 3035551200, Got: 3035551100",
     "fixable": true,
     "suggestedFix": "Update BTN to 3035551200"
   }
   ```
9. **Customer Fixes Errors**:
   - Edit TN details inline
   - Click "Revalidate" → Teliport re-checks
10. **Submit Port Order**:
    - All TNs validated ✅
    - Upload LOA (Letter of Authorization) PDF
    - Review and confirm FOC date
    - Click "Submit to NPAC"
11. **WARP API**: `POST /v1/porting/projects/{id}/submit`
    - Teliport: `POST /port-projects/projects/{id}/submit`
    - Creates LSR (Local Service Request) with NPAC
12. **Track Port Status**:
    ```
    SUBMITTED → PENDING → CONFIRMED → FOC_ASSIGNED → ACTIVATING → COMPLETE
    ```
13. **FOC Day (Firm Order Commitment)**:
    - Port activates at 12:00 PM local time
    - Teliport receives NPAC notification
    - Webhook to WARP: `POST /webhooks/teliport/port-activated`
14. **WARP Processes Webhook**:
    ```go
    func HandlePortActivated(portProjectID string, tns []string) {
        for _, tn := range tns {
            // Insert into voice.dids
            db.InsertDID(&models.DID{
                Number:       tn,
                CustomerID:   customer.ID,
                Status:       "ACTIVE",
                Ported:       true,
                PortedFrom:   "Verizon",
                PortedDate:   time.Now(),
                VoiceEnabled: true,
                SMSEnabled:   true,
            })

            // Send email notification
            emailService.Send("Port Complete", customer.Email)
        }
    }
    ```
15. **Customer Notification**:
    - Email: "Your port is complete! 98/100 numbers activated successfully."
    - Portal shows numbers ready for routing configuration

**Port Timeline**:
```
Day 0:  Submit port order
Day 1:  NPAC validation
Day 2:  Losing carrier review (can reject/request changes)
Day 3-5: FOC negotiation
Day 7:  Port activates (typical timeline)
```

---

## Database Schema Mapping

### WARP Schema → Teliport Metadata

**voice.dids Table** (WARP database):

| WARP Column | Teliport Metadata Key | Purpose |
|-------------|----------------------|---------|
| `id` | `metadata.warp_did_id` | WARP's UUID for the DID record |
| `number` | Primary key (TN) | E.164 phone number |
| `customer_id` | `metadata.customer_id` | WARP customer UUID |
| `ban` (via customers) | `metadata.ban` | Billing Account Number |
| `trunk_id` | `metadata.trunk_id` | SIP trunk assignment |
| `status` | Derived from Teliport `status` | ACTIVE, RESERVED, DISCONNECTED |
| `voice_enabled` | `metadata.voice_enabled` | Boolean for voice capability |
| `sms_enabled` | `metadata.sms_enabled` | Boolean for SMS capability |
| `mms_enabled` | `metadata.mms_enabled` | Boolean for MMS capability |
| `ported` | Teliport `ported` field | true if number was ported in |
| `ported_from_carrier` | `metadata.losing_carrier` | Previous carrier name |
| `ported_date` | `metadata.port_completion_date` | Date port activated |
| `cnam` | `metadata.cnam` | Caller ID Name (15 chars) |
| `custom_fields` | `metadata.*` (JSONB) | Flexible additional data |

**Sync Strategy**:

```yaml
Write Path (WARP → Teliport):
  - When customer updates DID settings in WARP
  - WARP writes to voice.dids table
  - ALSO updates Teliport metadata via PUT /inventory/numbers/{tn}/metadata
  - Keeps both systems in sync

Read Path (Teliport → WARP):
  - Nightly sync job queries Teliport for all assigned TNs
  - Compares with WARP voice.dids table
  - Detects drift (numbers released, metadata changed)
  - Auto-reconciles or alerts admin

Source of Truth:
  - Teliport = authoritative for assignment/status
  - WARP = authoritative for routing configuration
  - Both must stay in sync via API calls + webhooks
```

---

## API Gateway Implementation

### New Endpoints to Create

**Number Search & Procurement** (`services/api-gateway/internal/handlers/numbers.go`):

```go
// Search available numbers
// POST /v1/numbers/search
func (h *NumbersHandler) SearchNumbers(c *gin.Context) {
    var req NumberSearchRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // Build Teliport query
    query := buildTeliportQuery(req)

    // Call Teliport
    results, err := h.teliportClient.QueryInventory(query, req.Page, req.Size)
    if err != nil {
        c.JSON(500, gin.H{"error": "Failed to search inventory"})
        return
    }

    // Transform response
    c.JSON(200, transformSearchResults(results))
}

// Reserve numbers (shopping cart)
// POST /v1/numbers/reserve
func (h *NumbersHandler) ReserveNumbers(c *gin.Context) {
    var req ReserveRequest // {tns: ["3035551234", ...]}

    for _, tn := range req.TNs {
        err := h.teliportClient.ReserveNumber(tn, req.ReservedBy)
        // Handle errors, log failures
    }

    c.JSON(200, gin.H{"reserved": successCount, "failed": failures})
}

// Assign numbers (purchase)
// POST /v1/numbers/assign-batch
func (h *NumbersHandler) AssignBatch(c *gin.Context) {
    var req AssignBatchRequest

    tx := h.db.Begin()
    defer tx.Rollback()

    for _, tn := range req.TNs {
        // Assign in Teliport
        metadata := buildMetadata(req.CustomerID, tn)
        err := h.teliportClient.AssignNumber(tn, "WARP", metadata)
        if err != nil {
            return c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to assign %s", tn)})
        }

        // Insert into WARP database
        did := &models.DID{
            Number:       tn,
            CustomerID:   req.CustomerID,
            Status:       "ACTIVE",
            VoiceEnabled: req.VoiceEnabled,
            SMSEnabled:   req.SMSEnabled,
        }
        if err := tx.Create(did).Error; err != nil {
            // Rollback Teliport assignment
            h.teliportClient.ReleaseNumber(tn)
            return c.JSON(500, gin.H{"error": "Database error"})
        }
    }

    tx.Commit()
    c.JSON(201, gin.H{"message": "Numbers assigned successfully"})
}

// Release numbers
// POST /v1/numbers/release
func (h *NumbersHandler) ReleaseNumbers(c *gin.Context) {
    // Release from Teliport
    // Delete from WARP database
    // Audit log the action
}
```

**Number Porting** (`services/api-gateway/internal/handlers/porting.go`):

```go
// Create port project
// POST /v1/porting/projects
func (h *PortingHandler) CreateProject(c *gin.Context) {
    // Create in WARP database
    // Create in Teliport
    // Link Teliport project ID to WARP record
}

// Upload port file
// POST /v1/porting/projects/{id}/upload
func (h *PortingHandler) UploadFile(c *gin.Context) {
    // Receive multipart file
    // Proxy to Teliport
    // Return job ID for tracking
}

// Get port progress
// GET /v1/porting/projects/{id}/progress
func (h *PortingHandler) GetProgress(c *gin.Context) {
    // Query Teliport for real-time status
    // Return progress percentage, errors
}

// Webhook handler (from Teliport)
// POST /webhooks/teliport/port-activated
func (h *PortingHandler) HandlePortActivated(c *gin.Context) {
    // Validate webhook signature
    // Parse payload (project ID, activated TNs)
    // Insert TNs into voice.dids
    // Send customer notifications
}
```

### Service Layer (`services/api-gateway/internal/teliport/`)

```
teliport/
├── client.go           # HTTP client with auth
├── inventory.go        # Inventory API wrapper
├── portability.go      # Portability API wrapper
├── models.go           # Request/response types
├── metadata.go         # Metadata builder
└── webhooks.go         # Webhook signature validation
```

---

## Admin & Customer Portal Features

### Customer Portal (`apps/customer-portal/`)

**Number Acquisition Page** (`src/polymet/pages/numbers-acquisition.tsx`):

✅ Already exists! - Just needs API integration

**Features to Implement**:
- [ ] Connect search form to `/v1/numbers/search`
- [ ] Display results in table with pricing
- [ ] Shopping cart UI for selected numbers
- [ ] Reservation countdown timer (15:00)
- [ ] Checkout flow with confirmation
- [ ] Success/error notifications

**Number Porting Page** (`src/polymet/pages/numbers-porting.tsx`):

✅ Already exists! - Just needs API integration

**Features to Implement**:
- [ ] Create port project form
- [ ] CSV/Excel upload component
- [ ] Real-time validation progress bar
- [ ] Error review table with inline editing
- [ ] LOA document upload
- [ ] Port status timeline view
- [ ] Webhook-triggered notifications

**Number Inventory** (`src/polymet/pages/numbers.tsx`):

✅ Already exists! - Using mock data

**Features to Update**:
- [ ] Replace mock data with real API calls
- [ ] Add "Release Number" action
- [ ] Add "Update Configuration" modal
- [ ] Add "View Usage Stats" (CDR/MDR integration)

### Admin Portal (`apps/admin-portal/`)

**Admin Number Management** (New page):

**Features Needed**:
- [ ] View all numbers across all customers
- [ ] Bulk assign numbers to customers
- [ ] Bulk release numbers
- [ ] Audit log viewer (who assigned/released what)
- [ ] Cost tracking per number
- [ ] Sync status dashboard (WARP vs Teliport drift detection)

---

## Implementation Phases

### Phase 1: Foundation (Week 1) - 20-24 hours

**Goal**: Basic number search and single-number procurement

**Tasks**:

1. **Teliport Client Setup** (4 hours)
   - [ ] Create `internal/teliport/client.go`
   - [ ] Implement authentication with Bearer token
   - [ ] Add rate limiting and retry logic
   - [ ] Write unit tests for HTTP client

2. **Inventory API Integration** (6 hours)
   - [ ] Implement `QueryInventory()`
   - [ ] Implement `GetNumber(tn)`
   - [ ] Implement `ReserveNumber(tn)`
   - [ ] Implement `AssignNumber(tn, metadata)`
   - [ ] Implement `ReleaseNumber(tn)`

3. **API Gateway Endpoints** (6 hours)
   - [ ] POST `/v1/numbers/search` → Teliport query
   - [ ] POST `/v1/numbers/reserve` → Reserve batch
   - [ ] POST `/v1/numbers/assign-batch` → Assign + DB insert
   - [ ] POST `/v1/numbers/release` → Release + DB delete
   - [ ] GET `/v1/numbers/inventory` → List customer's numbers

4. **Database Integration** (4 hours)
   - [ ] Verify `voice.dids` table schema
   - [ ] Create repository methods (Insert, Update, Delete DIDs)
   - [ ] Add metadata JSONB helper functions
   - [ ] Write migration for any missing indexes

**Deliverable**: API endpoints working with Teliport (test with Postman/curl)

---

### Phase 2: Customer Portal Integration (Week 2) - 16-20 hours

**Goal**: Customers can search and purchase numbers via UI

**Tasks**:

1. **Number Search UI** (6 hours)
   - [ ] Connect `number-acquisition-section.tsx` to API
   - [ ] Implement area code search
   - [ ] Implement city/state search
   - [ ] Implement contains pattern search (e.g., "555" in any position)
   - [ ] Display search results with pricing

2. **Shopping Cart & Checkout** (6 hours)
   - [ ] Shopping cart component with selected numbers
   - [ ] Reservation countdown timer
   - [ ] Checkout confirmation modal
   - [ ] Payment integration (if applicable - or just "assign")
   - [ ] Success/error handling

3. **Number Inventory Management** (4 hours)
   - [ ] Replace mock data in `numbers.tsx`
   - [ ] Add "Release Number" action
   - [ ] Add "Configure Number" modal (trunk assignment, CNAM, E911)
   - [ ] Add usage statistics view

**Deliverable**: Customer Portal UI fully functional for number procurement

---

### Phase 3: Number Porting (Week 3) - 20-24 hours

**Goal**: Customers can port numbers from other carriers

**Tasks**:

1. **Portability API Integration** (8 hours)
   - [ ] Create `internal/teliport/portability.go`
   - [ ] Implement `CreatePortProject()`
   - [ ] Implement `UploadPortFile()`
   - [ ] Implement `GetPortProgress()`
   - [ ] Implement `SubmitPortOrder()`
   - [ ] Implement `ValidatePortTNs()`

2. **Port Project API Endpoints** (6 hours)
   - [ ] POST `/v1/porting/projects` → Create project
   - [ ] POST `/v1/porting/projects/{id}/upload` → Upload CSV
   - [ ] GET `/v1/porting/projects/{id}/progress` → Track progress
   - [ ] POST `/v1/porting/projects/{id}/submit` → Submit to NPAC
   - [ ] GET `/v1/porting/projects/{id}/details` → Get TN list

3. **Porting UI** (6 hours)
   - [ ] Connect `number-porting-section.tsx` to API
   - [ ] CSV/Excel upload with drag-and-drop
   - [ ] Real-time progress tracking with polling
   - [ ] Error review table with inline editing
   - [ ] LOA document upload
   - [ ] Port status timeline

**Deliverable**: Full porting workflow functional end-to-end

---

### Phase 4: Webhooks & Automation (Week 4) - 12-16 hours

**Goal**: Automated sync between Teliport and WARP

**Tasks**:

1. **Webhook Handler** (4 hours)
   - [ ] POST `/webhooks/teliport/port-activated`
   - [ ] POST `/webhooks/teliport/port-cancelled`
   - [ ] Webhook signature validation (HMAC)
   - [ ] Insert ported TNs into `voice.dids`
   - [ ] Send customer email notifications

2. **Nightly Sync Job** (6 hours)
   - [ ] Create cron job: `cmd/sync-teliport/main.go`
   - [ ] Query Teliport for all assigned TNs (metadata.customer_id)
   - [ ] Compare with WARP `voice.dids` table
   - [ ] Detect drift (numbers released, metadata changed)
   - [ ] Auto-reconcile or generate admin alert
   - [ ] Kubernetes CronJob manifest

3. **Admin Sync Dashboard** (4 hours)
   - [ ] Sync status page in Admin Portal
   - [ ] Show last sync time, TNs synced, errors
   - [ ] Manual "Force Sync" button
   - [ ] Drift report (TNs in Teliport but not WARP, vice versa)

**Deliverable**: Fully automated sync with webhook integration

---

### Phase 5: Production Hardening (Week 5) - 12-16 hours

**Goal**: Production-ready with monitoring, error handling, documentation

**Tasks**:

1. **Error Handling & Retries** (4 hours)
   - [ ] Exponential backoff for Teliport 429 (rate limit)
   - [ ] Automatic retry on 5xx errors (max 3 attempts)
   - [ ] Dead letter queue for failed assignments
   - [ ] Admin notifications for critical errors

2. **Monitoring & Alerting** (4 hours)
   - [ ] Prometheus metrics for Teliport API calls
   - [ ] Grafana dashboard for number operations
   - [ ] Alert: Sync drift detected
   - [ ] Alert: Teliport API down (>5 consecutive failures)

3. **Documentation** (4 hours)
   - [ ] Update CLAUDE.md with Teliport integration
   - [ ] Create admin runbook for number operations
   - [ ] API documentation (OpenAPI spec)
   - [ ] Customer-facing help docs

**Deliverable**: Production deployment ready

---

## Testing Strategy

### Unit Tests

```go
// services/api-gateway/internal/teliport/client_test.go

func TestTeliportClient_QueryInventory(t *testing.T) {
    mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        assert.Equal(t, "/inventory/query", r.URL.Path)
        assert.Equal(t, "Bearer rng_test_token", r.Header.Get("Authorization"))

        w.WriteHeader(200)
        json.NewEncoder(w).Encode(QueryResponse{
            Content: []TelephoneNumber{
                {TelephoneNumber: "3035551234", Status: "AVAILABLE"},
            },
        })
    }))
    defer mockServer.Close()

    client := NewTeliportClient(&Config{BaseURL: mockServer.URL, Token: "rng_test_token"})
    results, err := client.QueryInventory("npa=303 and status=available", 0, 50)

    assert.NoError(t, err)
    assert.Equal(t, 1, len(results.Content))
    assert.Equal(t, "3035551234", results.Content[0].TelephoneNumber)
}
```

### Integration Tests

```bash
# Test with real Teliport API (staging environment)
# services/api-gateway/tests/integration/teliport_test.go

func TestTeliportIntegration_SearchAndReserve(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }

    client := NewTeliportClient(loadConfigFromEnv())

    // Search
    results, err := client.QueryInventory("npa=720 and status=available", 0, 10)
    require.NoError(t, err)
    require.Greater(t, len(results.Content), 0)

    // Reserve first number
    tn := results.Content[0].TelephoneNumber
    err = client.ReserveNumber(tn, "integration-test")
    require.NoError(t, err)

    // Verify reserved
    details, err := client.GetNumber(tn)
    require.NoError(t, err)
    assert.Equal(t, "RESERVED", details.Status)

    // Release
    err = client.ReleaseNumber(tn)
    require.NoError(t, err)
}
```

### End-to-End Tests

```typescript
// apps/customer-portal/tests/e2e/number-procurement.spec.ts

describe('Number Procurement Flow', () => {
  it('should search, reserve, and purchase a number', () => {
    cy.login('test-customer@example.com')
    cy.visit('/numbers/acquisition')

    // Search
    cy.get('[data-testid="area-code-input"]').type('303')
    cy.get('[data-testid="search-button"]').click()

    // Wait for results
    cy.get('[data-testid="search-results"]').should('be.visible')
    cy.get('[data-testid="number-row"]').should('have.length.greaterThan', 0)

    // Select first number
    cy.get('[data-testid="number-row"]').first().find('[data-testid="select-checkbox"]').click()

    // Reserve
    cy.get('[data-testid="reserve-button"]').click()
    cy.get('[data-testid="shopping-cart"]').should('contain', '1 number')

    // Checkout
    cy.get('[data-testid="checkout-button"]').click()
    cy.get('[data-testid="confirm-purchase-button"]').click()

    // Verify success
    cy.get('[data-testid="success-message"]').should('contain', 'successfully assigned')
    cy.visit('/numbers')
    cy.get('[data-testid="number-inventory"]').should('contain', '303555')
  })
})
```

---

## Production Readiness

### Pre-Launch Checklist

**Infrastructure**:
- [ ] Teliport API token created and stored in Kubernetes secrets
- [ ] API Gateway deployed with Teliport client code
- [ ] Webhooks configured in Teliport (if supported)
- [ ] Nightly sync CronJob deployed
- [ ] Monitoring dashboards created

**Security**:
- [ ] API token rotated from default
- [ ] IP whitelist configured (WARP API Gateway IPs only)
- [ ] Webhook signature validation implemented
- [ ] Audit logging enabled for all number operations
- [ ] Rate limiting configured (100 req/min)

**Testing**:
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing (with real Teliport API)
- [ ] E2E tests passing (procurement + porting flows)
- [ ] Load test: 100 concurrent number searches
- [ ] Load test: 1000 bulk number assignments

**Documentation**:
- [ ] Admin runbook created
- [ ] Customer help docs published
- [ ] API documentation (OpenAPI spec)
- [ ] CLAUDE.md updated

**Operations**:
- [ ] On-call rotation includes Teliport escalation contact
- [ ] PagerDuty alerts configured
- [ ] Rollback plan documented
- [ ] Customer support trained on number operations

### Go-Live Criteria

✅ **All checklist items complete**
✅ **Successful end-to-end test with real customer**
✅ **No critical bugs in staging**
✅ **Monitoring dashboards showing healthy metrics**
✅ **Executive sign-off obtained**

---

## Appendix

### Cost Analysis

**Teliport Number Costs** (estimated):

| Number Type | Monthly Cost | Setup Fee | Notes |
|-------------|--------------|-----------|-------|
| Local DID (US) | $0.50 - $1.50 | $1.00 | Varies by area code |
| Toll-Free (US) | $2.00 - $5.00 | $5.00 | 800/888/877/866/855/844/833 |
| International | $5.00 - $50.00 | Varies | Country-dependent |

**Porting Costs**:
- Port-in fee: $10 per number (industry standard)
- Rush port (3-day FOC): +$25 per number
- Failed port (rejected): $0 (no charge)

### Glossary

- **BAN**: Billing Account Number - Unique identifier for customer billing
- **BTN**: Billing Telephone Number - Primary number on account (for porting)
- **CNAM**: Caller ID Name - 15-character display name
- **DID**: Direct Inward Dialing - Individual phone number
- **E911**: Enhanced 911 - Emergency services with location
- **FOC**: Firm Order Commitment - Scheduled port activation date
- **LATA**: Local Access and Transport Area - Geographic region
- **LERG**: Local Exchange Routing Guide - Telecom routing database
- **LOA**: Letter of Authorization - Document authorizing port
- **LRN**: Location Routing Number - Routing identifier
- **LSR**: Local Service Request - Port order submission
- **NPA**: Numbering Plan Area - Area code (first 3 digits)
- **NPAC**: Number Portability Administration Center - Industry database
- **NXX**: Central Office Code - Exchange (middle 3 digits)
- **OCN**: Operating Company Number - Carrier identifier
- **SPID**: Service Provider ID - Teliport/NPAC identifier
- **TN**: Telephone Number - E.164 format phone number

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-27 | Platform Engineering | Initial comprehensive plan |

**Next Review**: 2025-11-10 (after Phase 1 completion)

---

**Status**: ✅ **READY FOR IMPLEMENTATION**

This plan provides everything needed to integrate Teliport number procurement into WARP. The API Gateway team can begin Phase 1 immediately once the Teliport API token is provided.

