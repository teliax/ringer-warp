# Product Requirements Document (PRD)
# WARP - Wholesale Accounting Routing and Provisioning

## Executive Summary

**Company**: Ringer
**Project**: WARP (Wholesale Accounting Routing and Provisioning)
**Version**: 3.0
**Date**: January 2025
**Status**: Claude Flow/Hive-mind Reference Implementation
**Purpose**: Comprehensive reference guide for AI-driven development

### Vision Statement
Build a carrier-grade, API-driven SIP trunking platform that enables wholesale telecom carriers to provision and manage voice, messaging, and communication services at scale, preserving and enhancing the sophisticated routing capabilities of the existing VLCAdmin system.

### Target Market
- Primary: Telecom carriers with FCC USF Filer ID
- Secondary: MVNOs and wholesale communication providers
- Geographic Focus: Initially US, expandable to international

## Business Objectives

### Primary Goals
1. Provide wholesale SIP trunking services comparable to Bandwidth Universal Platform
2. Enable fully automated provisioning via RESTful APIs
3. Support 99.999% uptime for carrier-grade reliability
4. Scale to handle millions of concurrent calls

### Success Metrics
- Call completion rate > 99.5%
- API response time < 200ms (p99)
- Platform availability > 99.999%
- Support for 100,000+ concurrent calls
- Sub-second call setup time

## Technical Architecture

### Technology Stack

#### Cloud Infrastructure (GCP)
- **Kubernetes**: GKE with Autopilot for control plane
- **Networking**: Cloud NAT for egress, Private Service Connect
- **Security**: Cloud Armor for DDoS protection
- **Load Balancing**: Cloud Load Balancing (L4/L7)
- **Compute**: GCP VMs for RTPEngine media processing
- **SQL**: Cloud SQL for managed PostgreSQL instances

#### Core Components
- **SIP Control Plane**: Kamailio (on GKE)
- **Media Processing**: RTPEngine (on GCP VMs)
- **Service Discovery**: Consul
- **Databases**:
  - PostgreSQL (primary relational)
  - CockroachDB (distributed SQL for global scale)
  - Redis (caching and session state)

#### Authentication & Authorization
- **OAuth Provider**: Google Identity Platform or Keycloak
  - Multi-factor authentication (MFA)
  - SSO/SAML integration
  - JWT token management
  - RBAC enforcement

#### Messaging Infrastructure
- **SMSC**: Jasmin SMS Gateway
  - SMPP 3.4/5.0 protocol support
  - MM4 for MMS handling
  - REST API for message submission
- **A2P SMS**: Sinch binds for carrier connectivity
  - Direct carrier connections
  - Global SMS reach
  - DLR (Delivery Receipt) handling

#### Development Stack
- **Backend Languages**:
  - Go (primary API services)
  - Rust (high-performance components)
  - Java (legacy integration)
  - TypeScript (Node.js services)
- **Frontend**:
  - Next.js 14+ with App Router
  - TypeScript
  - Tailwind CSS
  - Deployed on Vercel
- **Documentation**:
  - OpenAPI 3.0.3 specification
  - Swagger UI for testing
  - ReDoc for documentation
  - OpenAPI Generator for SDKs

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Customer Portal                      │
│         (Next.js/TypeScript/Tailwind CSS)               │
│              Deployed on Vercel Edge                    │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                           │
│         (Cloud Load Balancer + Cloud Armor)             │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    WARP API Layer                       │
│   (Go/Rust microservices on GKE with Autopilot)        │
│         OAuth (Google Identity Platform/Keycloak) + RBAC                   │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  SIP Control  │   │     Media     │   │   Messaging   │
│   Kamailio    │   │   RTPEngine   │   │  Jasmin SMSC  │
│   (GKE)       │   │  (GCP VMs)    │   │    (GKE)      │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                           │
│  PostgreSQL | CockroachDB | Redis | Consul              │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│              External Services                          │
│  Telique API | Sinch SMS | Number Portability DB       │
└─────────────────────────────────────────────────────────┘
```

### Core Services

#### 1. Control Plane (Kamailio on GKE)
- **Deployment**: GKE with Autopilot
- **Components**:
  - SIP Proxy/Registrar
  - Load Balancer integration
  - Call Routing Engine
  - Database-driven configuration
- **Features**:
  - Dynamic trunk provisioning
  - Real-time routing rules
  - Feature flags per customer
  - Rate limiting and QoS

#### 2. Media Plane (RTPEngine on GCP VMs)
- **Deployment**: GCP Compute Engine VMs
- **Features**:
  - RTP/SRTP handling
  - Codec transcoding (G.711, G.729, Opus)
  - DTMF detection (RFC 2833, SIP INFO)
  - Call recording capabilities
- **Discovery**: Consul service mesh
- **Scaling**: Managed Instance Groups with autoscaling

#### 3. Messaging Platform (Jasmin SMSC)
- **Deployment**: GKE containerized
- **Protocols**:
  - SMPP 3.4/5.0 for carrier binds
  - HTTP/REST API for message submission
  - MM4 for MMS handling
- **Integration**: Sinch for A2P SMS delivery
- **Features**:
  - Message queuing and retry
  - DLR tracking
  - Rate limiting per customer

#### 4. Data Layer
- **PostgreSQL** (Cloud SQL):
  - Customer data
  - Trunk configurations
  - User management
  - Rate plans and contracts
- **BigQuery** (Managed Analytics):
  - CDR/MDR storage (partitioned tables)
  - Usage analytics
  - Real-time streaming tables
  - 7-year retention for compliance
- **Redis Cluster**:
  - Session state
  - Real-time routing cache
  - Rate limiting counters
  - Prepaid balance cache
  - Message queues
- **Consul**:
  - Service discovery
  - Configuration management
  - Health checking
  - Call quality statistics

### API Platform

#### Core API Modules

1. **Account Management**
   - Customer onboarding
   - Organization hierarchy
   - User management with RBAC
   - API key management

2. **Trunk Management**
   - CREATE/UPDATE/DELETE SIP trunks
   - Capacity management
   - Geographic restrictions
   - Security policies (IP ACLs)

3. **Number Management**
   - Number inventory
   - Number porting (LNP)
   - E911 address management
   - CNAM management

4. **Call Control**
   - Real-time call manipulation
   - Call transfer/conference
   - WebRTC endpoints
   - Recording controls

5. **Messaging Services**
   - SMS/MMS routing
   - RCS capabilities
   - Message queuing
   - Delivery receipts

6. **Billing & Rating**
   - Real-time rating
   - Usage tracking
   - Invoice generation
   - Payment processing

7. **Analytics & Reporting**
   - CDR access
   - Call quality metrics (MOS, jitter, packet loss)
   - Usage analytics
   - Custom reports

8. **Telco Data Services Integration**
   - LERG (Local Exchange Routing Guide) queries
   - LRN (Location Routing Number) lookups
   - DNO (Do Not Originate) list management
   - CNAM database queries
   - Number portability checks

## Customer Portal UI/UX Requirements

### Technology Stack
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui components
- **State Management**: Zustand / React Query
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts / Tremor
- **Deployment**: Vercel Edge Network
- **CI/CD**: GitHub Actions → Vercel

### Design Principles
1. **Bandwidth/Twilio Parity**: Mirror the clean, professional interface of industry leaders
2. **Mobile-First**: Responsive design that works on all devices
3. **Accessibility**: WCAG 2.1 AA compliance
4. **Performance**: Core Web Vitals score > 95
5. **Polymet-Ready**: Component-based architecture for easy UI reimagination

### Key UI Sections

#### 1. Dashboard
- **Overview Cards**: Active calls, numbers, trunks, current spend
- **Real-time Metrics**: Live call volume chart (WebSocket updates)
- **Quick Actions**: Add number, create trunk, view CDRs
- **Alerts & Notifications**: System status, billing alerts, API errors
- **Usage Summary**: Minutes used, API calls, message count

#### 2. Phone Numbers
- **Inventory View**: DataTable with search, filter, sort
- **Number Search**: By area code, rate center, features
- **Bulk Operations**: Import/export CSV, bulk assign/release
- **E911 Management**: Address validation and updates
- **Porting Center**: LNP status tracking, document uploads

#### 3. SIP Trunks
- **Configuration Panel**: Similar to Twilio's Elastic SIP
- **Credentials Display**: Username, password, SIP URI
- **Access Control**: IP whitelist management
- **Routing Rules**: Visual rule builder with drag-and-drop
- **Testing Tools**: SIP OPTIONS ping, call simulator

#### 4. Voice & Messaging
- **Call Logs**: Filterable CDR table with export
- **Live Calls**: Real-time active call monitoring
- **Message History**: SMS/MMS logs with delivery status
- **Recording Library**: Playback and download capabilities
- **Quality Metrics**: MOS scores, packet loss graphs

#### 5. Billing & Usage
- **Current Usage**: Real-time spend tracker
- **Invoice History**: PDF downloads, payment status
- **Payment Methods**: Credit card, ACH, wire instructions
- **Usage Reports**: Custom date ranges, downloadable CSV
- **Commitment Plans**: Volume discounts, contract management

#### 6. Developer Hub
- **API Documentation**: Interactive Swagger/OpenAPI
- **SDKs & Libraries**: Download links, quickstart guides
- **Webhooks**: Event subscriptions, delivery logs
- **API Keys**: Create, rotate, scope management
- **Code Examples**: Copy-paste snippets in multiple languages

#### 7. Account Settings
- **Organization Profile**: Company info, tax details
- **User Management**: Invite users, set permissions
- **Security**: 2FA setup, session management, audit logs
- **Notifications**: Email/SMS preferences, webhook configs
- **White-label**: Custom branding for resellers

## User Access Control & RBAC

### User Types & Permissions

#### 1. Super Administrator (Ringer Internal)
- **Scope**: Full platform access
- **Permissions**:
  - Access all customer accounts
  - Modify platform configurations
  - View platform-wide analytics
  - Manage feature flags
  - Access billing for all customers
  - Emergency trunk suspension
  - Database direct access
- **API Scopes**: `platform:*`

#### 2. Support Administrator (Ringer Support)
- **Scope**: Read-only customer access + limited actions
- **Permissions**:
  - View customer configurations
  - Access customer CDRs for debugging
  - Reset customer passwords
  - View but not modify billing
  - Create support tickets
  - Generate diagnostic reports
- **API Scopes**: `support:read`, `support:diagnostics`

#### 3. Sales Administrator (Ringer Sales)
- **Scope**: Prospect and customer management
- **Permissions**:
  - Create trial accounts
  - View usage statistics
  - Access pricing tools
  - Generate quotes
  - View customer growth metrics
- **API Scopes**: `sales:accounts`, `sales:reports`

#### 4. Customer Administrator
- **Scope**: Full control of their organization
- **Permissions**:
  - Manage all organization resources
  - View and pay invoices
  - Manage users within organization
  - Access all API features
  - Configure organization settings
- **API Scopes**: `org:*`

#### 5. Customer Developer
- **Scope**: Technical resources only
- **Permissions**:
  - Manage API keys
  - Configure trunks and numbers
  - Access technical logs
  - View CDRs
  - Cannot view billing
- **API Scopes**: `org:technical`

#### 6. Customer Billing
- **Scope**: Financial resources only
- **Permissions**:
  - View invoices and usage
  - Update payment methods
  - Download financial reports
  - Cannot modify technical configs
- **API Scopes**: `org:billing`

#### 7. Customer Read-Only
- **Scope**: View-only access
- **Permissions**:
  - View configurations
  - View CDRs
  - View usage
  - Cannot make changes
- **API Scopes**: `org:read`

### Permission Matrix

| Resource | Super Admin | Support | Sales | Customer Admin | Developer | Billing | Read-Only |
|----------|------------|---------|-------|----------------|-----------|---------|-----------|
| View All Customers | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modify Platform | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Trunks | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Manage Numbers | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| View CDRs | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Manage Billing | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| API Access | ✅ | Limited | ❌ | ✅ | ✅ | Limited | Limited |

### API Endpoint Scoping

```javascript
// Example endpoint scoping
{
  "GET /api/v1/trunks": ["org:read", "org:technical", "org:*"],
  "POST /api/v1/trunks": ["org:technical", "org:*"],
  "DELETE /api/v1/trunks/:id": ["org:*"],
  "GET /api/v1/invoices": ["org:billing", "org:*"],
  "POST /api/v1/payment-methods": ["org:billing", "org:*"],
  "GET /api/v1/platform/stats": ["platform:*"],
  "POST /api/v1/support/ticket": ["support:*", "org:*"]
}
```

### Authentication Flow
1. **Login**: Email/password or SSO (Google, Microsoft)
2. **MFA**: TOTP (Google Authenticator) or SMS
3. **Session**: JWT with 1-hour expiry, refresh token 30 days
4. **API Keys**: Separate from user sessions, scope-limited
5. **Audit**: All actions logged with user, IP, timestamp

## External Data Services Integration

### Telique Integration (LERG/LRN)
- **Endpoint**: `https://api-dev.ringer.tel/v1/telique`
- **Features**:
  - Real-time LRN lookups for routing
  - LERG data for number metadata
  - OCN (Operating Company Number) queries
  - Rate center information
  - LATA boundaries
  - Block ID assignments

### DNO (Do Not Originate) Service
- **Purpose**: Prevent calls to prohibited numbers
- **Integration**: Real-time API check before call routing
- **Caching**: Local Redis cache with 1-hour TTL
- **Updates**: Daily sync of DNO list

### Number Inventory Service
- **Providers**: Multiple upstream providers via API
- **Features**:
  - Real-time availability search
  - Instant provisioning
  - Number reservation (15-minute hold)
  - Bulk number ordering
  - Vanity number search

### CNAM Database
- **Purpose**: Caller ID name delivery
- **Integration**: Real-time dip on inbound calls
- **Storage**: Local cache of customer CNAM records
- **Management**: Customer portal for CNAM updates

## Core Routing & Trunk Management Features (From VLCAdmin)

### Partition-Based Routing System

#### Concept: Partitions (formerly "Machines")
Partitions are routing groups that control which downstream vendor routes a customer can access. This provides granular control over routing policies and cost management.

**Example Implementation:**
- Customer: "Foo Corp" (BAN: 12345)
- Partition: ABC123
- Available Routes: Level3, Verizon, AT&T, Sinch
- Result: When Foo Corp makes calls, LCR only considers routes in partition ABC123

#### Partition Management Features
1. **Partition CRUD Operations**
   - Create/Read/Update/Delete partitions
   - Assign human-readable names and descriptions
   - Set default partition for unassigned customers

2. **Route Assignment to Partitions**
   - Bulk assignment of vendor routes to partitions
   - Route exclusion capabilities
   - Override capabilities per partition

3. **Customer-Partition Mapping**
   - One-to-many relationship (customer can access multiple partitions)
   - Priority ordering for partition selection
   - Time-based partition switching (business hours vs off-hours)

### Least Cost Routing (LCR) Engine

#### Core LCR Algorithm
The LCR engine performs complex multi-dimensional queries considering:

1. **Primary Factors**
   - Rate (cost per minute)
   - Route quality metrics
   - Vendor capacity limits
   - Time of day restrictions

2. **Routing Dimensions**
   - **LRN-based**: Most common, using Local Routing Number
   - **OCN/LATA-based**: Operating Company Number + LATA
   - **DNIS-based**: Direct Inward Dialing Number
   - **Prefix-based**: International and special routing

3. **Zone Classification**
   - Interstate
   - Intrastate
   - Local
   - International
   - Zone 1 (Non-US special zones)
   - Toll-free

#### SQL Procedure: get_lrn_rates
```sql
-- Key parameters for LCR query
- machineid_in: Partition ID
- account_in: Customer BAN
- effectivezone_in: Interstate/Intrastate/Local
- lrn_in: Local Routing Number (from dip)
- prefix_in: Full dialed number
- ocn_in: Operating Company Number
- lata_in: LATA identifier
- state_in: Two-letter state code
- ratelimit_in: Maximum acceptable rate
- ij_in: Interstate/Intrastate flag
- ani_class_in: ANI classification (DOM/DOMTF/INTL)
- max_results: Result limit
```

### Vendor/Provider Management

#### Provider Types & Billing Models
1. **LRN Providers**: Bill based on Local Routing Number
2. **OCN/LATA Providers**: Bill based on OCN and LATA combination
3. **DNIS Providers**: Bill based on dialed number
4. **International Providers**: Prefix-based billing
5. **Customer Trunks**: Inbound customer connections
6. **Rate Deck Providers**: Reference pricing only

#### Provider Configuration
1. **Dialstring Management**
   - Multiple SIP gateways per provider
   - Format: `sip:+${number}@gateway1.provider.com:5060`
   - Load balancing across gateways
   - Failover ordering

2. **Jurisdiction Handling**
   - Enhanced vs Non-enhanced classification
   - Dialer traffic identification
   - Interstate/Intrastate policy per provider
   - POI (Point of Interconnection) based routing

3. **Rate Tables**
   - Per-prefix rates
   - Zone-specific pricing (interstate/intrastate/local)
   - Time-based rate changes
   - Minimum duration and increment billing

### Customer Trunk Group Configuration

#### Complete Customer Trunk Setup Workflow

**Step 1: Customer Registration**
```javascript
POST /api/v1/customers
{
  "company": "Foo Corp",
  "contact": {
    "name": "John Doe",
    "email": "john@foo.com",
    "phone": "555-1234"
  },
  "address": {
    "line1": "123 Main St",
    "city": "Denver",
    "state": "CO",
    "zip": "80202"
  }
}
// Returns: { "ban": "12345", "api_key": "sk_live_..." }
```

**Step 2: SIP Trunk Configuration (Bidirectional)**
```javascript
POST /api/v1/trunks
{
  "ban": "12345",
  "name": "Production Trunk",

  // Inbound Configuration (Customer → WARP)
  "inbound": {
    "authentication": {
      "type": "IP_ACL",  // or "CREDENTIALS" or "IP_AND_CREDENTIALS"
      "ip_addresses": [
        "198.51.100.10/32",  // Customer's sending IPs
        "198.51.100.11/32"
      ],
      "credentials": {  // Optional, for digest auth
        "username": "foo_trunk",
        "password": "secure_password_123"
      }
    },
    "signaling_addresses": [  // Where customer sends SIP
      "sip.warp.ringer.com",
      "sip-backup.warp.ringer.com"
    ],
    "port": 5060,
    "transport": "UDP"  // UDP, TCP, TLS
  },

  // Outbound Configuration (WARP → Customer)
  "outbound": {
    "destination_addresses": [
      {
        "ip": "203.0.113.50",  // Customer's receiving IP
        "port": 5060,
        "transport": "UDP",
        "priority": 1
      },
      {
        "ip": "203.0.113.51",  // Backup IP
        "port": 5060,
        "transport": "UDP",
        "priority": 2
      }
    ],
    "options_ping": true,  // Health monitoring
    "max_forwards": 70
  },

  // Common Configuration
  "settings": {
    "codecs": ["PCMU", "PCMA", "G729", "OPUS"],
    "dtmf_mode": "RFC2833",
    "fax": {
      "enabled": true,
      "protocol": "T38"
    },
    "rtp_packetization": 20,
    "session_timers": true,
    "hold_music": false
  },

  // Capacity Limits
  "limits": {
    "concurrent_calls_limit": 100,
    "calls_per_second_limit": 10,
    "monthly_minutes": 1000000,
    "daily_spend_limit": 1000
  },

  // Emergency Calling
  "emergency": {
    "enabled": true,
    "default_address_id": "addr_123",
    "callback_number": "+13035551234"
  }
}
```

**Step 3: Phone Number Assignment**
```javascript
POST /api/v1/trunks/{trunk_id}/numbers
{
  "numbers": ["+13035551000", "+13035551001"],
  "features": {
    "sms_enabled": true,
    "voice_enabled": true,
    "mms_enabled": true,
    "fax_enabled": false
  },
  "e911_address_id": "addr_123"
}
```

**Step 4: Routing Configuration**
```javascript
POST /api/v1/trunks/{trunk_id}/routing
{
  "partition_id": "ABC123",  // Assign to partition
  "allowed_destinations": {
    "domestic": true,
    "international": true,
    "toll_free": true,
    "premium_rate": false,
    "specific_countries": ["US", "CA", "GB"]  // Optional whitelist
  },
  "blocked_prefixes": ["900", "976"],  // Premium rate blocking
  "custom_routes": [
    {
      "prefix": "44",
      "description": "UK Traffic",
      "preferred_carrier": "bt_wholesale"
    }
  ]
}
```

**Step 5: Testing & Validation**
```javascript
POST /api/v1/trunks/{trunk_id}/test
{
  "test_type": "FULL",  // OPTIONS, REGISTER, CALL
  "test_number": "+18005551212"
}
```

This workflow mirrors Bandwidth and Twilio's approach but with our partition-based routing system.

### Advanced Routing Features

#### Override System
Allows custom routing rules that supersede standard LCR:

1. **Customer Overrides**
   - Force specific routes for certain customers
   - Custom pricing per customer
   - Bypass LCR for premium routing

2. **Prefix Overrides**
   - Special handling for specific number ranges
   - Emergency number routing
   - Short code handling

3. **Time-based Overrides**
   - Business hours routing
   - Weekend/holiday routing
   - Maintenance window bypasses

#### Exclusion System
Prevents routing to specific destinations:

1. **Customer Exclusions**
   - Block specific countries/destinations
   - Fraud prevention rules
   - Compliance-based blocking

2. **Provider Exclusions**
   - Temporary vendor blacklisting
   - Quality-based exclusions
   - Capacity management

### Call Detail Record (CDR) Management

#### CDR Data Collection
```javascript
{
  "cdr": {
    "call_id": "uuid-12345",
    "timestamp": "2025-01-15T10:30:00Z",
    "customer": {
      "ban": "12345",
      "trunk_id": "trunk_001"
    },
    "calling_party": {
      "number": "3035551234",
      "lrn": "3035550000",
      "ocn": "7421",
      "lata": "656",
      "state": "CO",
      "cnam": "WIRELESS CALLER"
    },
    "called_party": {
      "number": "2125556789",
      "lrn": "2125550000",
      "ocn": "6529",
      "lata": "132",
      "state": "NY"
    },
    "routing": {
      "zone": "interstate",
      "partition": "ABC123",
      "selected_vendor": "Level3",
      "rate": 0.0045,
      "customer_rate": 0.0065
    },
    "duration": {
      "ring_time": 3,
      "talk_time": 245,
      "total": 248
    },
    "disposition": "ANSWERED",
    "sip_response": 200
  }
}
```

#### Toll-Free Special Handling
For toll-free calls, additional data must be captured:
- **CIC (Carrier Identification Code)**: Retrieved via dip
- **Responsible Organization**: RespOrg ID
- **Dip Number**: Number used for CIC lookup
- **Special Rating**: Toll-free specific rate tables

### Call Simulation & Testing

#### Route Testing Tool
Simulates call routing without placing actual calls:

**Input Parameters:**
- ANI (Calling Number)
- DNIS (Called Number)
- LRN (if known)
- OCN/LATA (if known)
- Zone selection
- Partition selection

**Output:**
- Selected routes in priority order
- Rates for each route
- Routing decision logic
- Estimated cost

### Rate Management System

#### Rate Import/Update
1. **Bulk Rate Import**
   - CSV/Excel upload
   - API-based updates
   - Automated FTP retrieval

2. **Rate Versioning**
   - Historical rate tracking
   - Future rate scheduling
   - Rate change notifications

3. **Rate Analysis**
   - Margin calculation
   - Competitive analysis
   - Route profitability reports

#### Customer Rate Calculation
```sql
-- Customer rate = Vendor rate + Margin + Fees
SELECT
  vendor_rate * (1 + margin_percent/100) + fixed_fee AS customer_rate
FROM rate_calculation
WHERE customer_ban = ? AND destination = ?
```

### Database Schema Considerations

#### Key Tables from VLCAdmin
1. **dial**: Dialstring configurations
2. **origin**: Provider/vendor definitions
3. **routecost**: Rate tables per provider
4. **machine**: Partition definitions
5. **rate_exclusions**: Exclusion rules
6. **provider_policy**: Jurisdiction policies
7. **dialcost_routes**: Named route groups
8. **dialcost_route_toggle**: Route enable/disable per partition
9. **cic_rates**: Toll-free specific rates
10. **localdata2**: Local calling determination

### SMS/RCS Messaging Platform (SMSC Component)

#### Architecture Overview
The SMSC (Short Message Service Center) component provides carrier-grade messaging capabilities fully integrated with the SIP trunk infrastructure.

```
┌─────────────────────────────────────────────────────────┐
│                    Customer API                         │
│              (REST API + Webhooks)                      │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    SMSC Core                            │
│         (Message Router + Queue Manager)                │
└─────────────────────────────────────────────────────────┘
                            │
┌──────────────────┬────────────────┬─────────────────────┐
│   SMPP Gateway   │  MM4 Gateway   │  RCS Gateway       │
│   (SMS/MMS)      │  (MMS)         │  (RBM)            │
└──────────────────┴────────────────┴─────────────────────┘
```

#### SMS/MMS API Specifications

##### Send SMS
```javascript
POST /api/v1/messages/sms
{
  "from": "+13035551234",  // Must be owned by customer
  "to": "+12125556789",
  "body": "Hello from WARP",
  "trunk_id": "trunk_123",  // Optional, auto-selected if not provided
  "webhook_url": "https://customer.com/status",
  "metadata": {
    "campaign_id": "promo_2025",
    "customer_ref": "msg_12345"
  }
}

Response:
{
  "message_id": "msg_uuid_12345",
  "status": "queued",
  "segments": 1,
  "estimated_cost": 0.0075,
  "created_at": "2025-01-15T10:30:00Z"
}
```

##### Send MMS
```javascript
POST /api/v1/messages/mms
{
  "from": "+13035551234",
  "to": "+12125556789",
  "body": "Check out this image!",
  "media_urls": [
    "https://example.com/image.jpg",
    "https://example.com/video.mp4"
  ],
  "trunk_id": "trunk_123"
}
```

##### Bulk Messaging
```javascript
POST /api/v1/messages/bulk
{
  "from": "+13035551234",
  "recipients": [
    {
      "to": "+12125556789",
      "variables": {"name": "John", "code": "ABC123"}
    },
    {
      "to": "+14155551234",
      "variables": {"name": "Jane", "code": "XYZ789"}
    }
  ],
  "template": "Hi {{name}}, your code is {{code}}",
  "schedule_time": "2025-01-15T14:00:00Z",
  "throttle": {
    "messages_per_second": 10
  }
}
```

##### Message Status Webhook
```javascript
// Webhook payload sent to customer
POST https://customer.com/webhook
{
  "event": "message.delivered",
  "message_id": "msg_uuid_12345",
  "from": "+13035551234",
  "to": "+12125556789",
  "status": "delivered",
  "delivered_at": "2025-01-15T10:31:00Z",
  "segments_sent": 1,
  "segments_delivered": 1,
  "cost": 0.0075,
  "metadata": {
    "campaign_id": "promo_2025",
    "customer_ref": "msg_12345"
  }
}
```

#### RCS (Rich Communication Services) Support

##### Send RCS Message
```javascript
POST /api/v1/messages/rcs
{
  "from": "+13035551234",
  "to": "+12125556789",
  "content": {
    "text": "Welcome to WARP RCS!",
    "suggestions": [
      {
        "type": "reply",
        "text": "Learn More",
        "postback_data": "learn_more"
      },
      {
        "type": "action",
        "text": "Call Us",
        "dial_action": {
          "phone_number": "+13035551234"
        }
      }
    ],
    "rich_card": {
      "standalone": {
        "card_orientation": "VERTICAL",
        "card_content": {
          "title": "WARP Communications",
          "description": "Enterprise messaging solutions",
          "media": {
            "height": "MEDIUM",
            "content_info": {
              "file_url": "https://example.com/hero.jpg"
            }
          },
          "suggestions": [
            {
              "action": {
                "text": "Visit Website",
                "open_url_action": {
                  "url": "https://warp.ringer.com"
                }
              }
            }
          ]
        }
      }
    }
  }
}
```

#### SMSC Features

1. **Message Routing**
   - Intelligent carrier selection
   - Automatic failover
   - Gray routing detection
   - Number pooling for high volume

2. **Delivery Optimization**
   - Adaptive routing based on delivery rates
   - Time-zone aware scheduling
   - Retry logic with exponential backoff
   - DLR (Delivery Receipt) aggregation

3. **Compliance & Filtering**
   - TCPA compliance checking
   - Opt-out management (STOP/HELP)
   - Content filtering
   - SHAFT compliance (Sex, Hate, Alcohol, Firearms, Tobacco)
   - 10DLC registration support

4. **Analytics & Reporting**
   - Real-time delivery metrics
   - Conversion tracking
   - Cost analysis per campaign
   - Carrier performance reports

5. **Integration with Voice Platform**
   - Shared number inventory
   - Unified billing
   - Combined CDRs/MDRs (Message Detail Records)
   - Single API for voice and messaging

### Integration Requirements

#### Telique API Integration
- Real-time LRN lookups for every call
- LERG data synchronization
- OCN/LATA information retrieval
- Do Not Originate (DNO) list checking

#### Number Inventory Integration
- Available number searching
- Number reservation/ordering
- Porting status tracking
- E911 provisioning
- SMS capability verification

#### Messaging Aggregator Integration
- Primary SMPP connections to Tier 1 carriers
- MM4 interfaces for MMS delivery
- RCS MaaP (Messaging as a Platform) connections
- International SMS gateway partnerships

## Functional Requirements

### Phase 1: Core Platform (Q1 2025)
- [x] Infrastructure setup (GKE, GCP VMs)
- [ ] Basic Kamailio deployment
- [ ] RTPEngine cluster with Consul
- [ ] CockroachDB setup
- [ ] Basic SIP trunk CRUD operations
- [ ] Simple authentication

### Phase 2: Advanced Features (Q2 2025)
- [ ] Full API implementation
- [ ] Number management
- [ ] E911 support
- [ ] Basic billing engine
- [ ] Customer portal MVP

### Phase 3: Messaging & Analytics (Q3 2025)
- [ ] SMS/MMS gateway
- [ ] RCS support
- [ ] Advanced analytics
- [ ] Real-time dashboards
- [ ] API webhooks

### Phase 4: Scale & Reliability (Q4 2025)
- [ ] Multi-region deployment
- [ ] Disaster recovery
- [ ] Advanced load balancing
- [ ] Performance optimization
- [ ] Compliance certifications

## Non-Functional Requirements

### Performance
- Call setup time < 1 second
- API latency < 200ms (p99)
- Support 100K concurrent calls
- 1M API requests per minute

### Reliability
- 99.999% uptime SLA
- RPO < 1 minute
- RTO < 5 minutes
- Automatic failover

### Security
- TLS 1.3 for all APIs
- SRTP for media
- OAuth 2.0 / JWT authentication
- PCI DSS compliance
- SOC 2 Type II certification

### Scalability
- Horizontal scaling for all components
- Auto-scaling based on load
- Multi-region support
- Edge PoPs for media

### Compliance
- FCC regulations
- STIR/SHAKEN
- GDPR/CCPA
- E911 requirements
- Lawful intercept capability

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui
- **State**: Zustand, React Query
- **Deployment**: Vercel Edge Network
- **CDN**: Vercel Edge Functions
- **Analytics**: Vercel Analytics + Custom

### Backend
- **Languages**: Go (API), Python (automation), C (Kamailio modules)
- **Frameworks**: Gin (Go), FastAPI (Python)
- **API Design**: REST primary, GraphQL for complex queries
- **Authentication**: JWT + OAuth 2.0
- **Authorization**: Casbin RBAC engine
- **Databases**: CockroachDB, Redis, InfluxDB
- **Message Queue**: NATS / Kafka
- **Service Mesh**: Consul

### Infrastructure
- **Cloud**: Google Cloud Platform
- **Orchestration**: Kubernetes (GKE)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions (UI → Vercel, API → GKE)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack
- **Tracing**: Jaeger
- **Secrets**: Google Secret Manager

### SIP/Telecom
- **SIP Server**: Kamailio 5.7+
- **Media Server**: RTPEngine
- **Transcoding**: FFmpeg
- **STUN/TURN**: coturn
- **LERG/LRN**: Telique API
- **Number Inventory**: Multiple providers
- **CNAM**: Neustar/Syniverse

## Database Schema Overview

### Core Entities
1. **Organizations**
   - Carrier accounts
   - Hierarchical structure
   - Billing relationships

2. **Trunks**
   - Configuration
   - Capacity limits
   - Routing rules
   - Security policies

3. **Numbers**
   - DID inventory
   - Assignments
   - Features
   - E911 addresses

4. **CDRs**
   - Call records
   - Quality metrics
   - Billing data

5. **Users**
   - Authentication
   - Permissions
   - API keys

## Comprehensive API Specifications for WARP

### Partition Management APIs

#### GET /api/v1/partitions
List all partitions in the system
```json
Response:
{
  "partitions": [
    {
      "id": "ABC123",
      "name": "Premium Routes",
      "description": "High-quality tier 1 carriers",
      "created_at": "2025-01-15T10:00:00Z",
      "route_count": 15,
      "customer_count": 5
    }
  ]
}
```

#### POST /api/v1/partitions/{partition_id}/routes
Assign routes to a partition
```json
Request:
{
  "route_ids": ["level3_primary", "verizon_backup", "att_tertiary"],
  "action": "add" // or "remove"
}
```

#### POST /api/v1/customers/{ban}/partitions
Assign customer to partitions
```json
Request:
{
  "partitions": [
    {
      "partition_id": "ABC123",
      "priority": 1,
      "time_restrictions": {
        "days": ["MON", "TUE", "WED", "THU", "FRI"],
        "hours": "09:00-17:00",
        "timezone": "America/Denver"
      }
    }
  ]
}
```

### Routing APIs

#### POST /api/v1/routing/simulate
Simulate call routing without placing a call
```json
Request:
{
  "ani": "3035551234",
  "dnis": "2125556789",
  "customer_ban": "12345",
  "partition_override": "ABC123", // optional
  "include_telique_dip": true
}

Response:
{
  "routing_decision": {
    "zone": "interstate",
    "lrn": "2125550000",
    "ocn": "6529",
    "lata": "132",
    "state": "NY",
    "selected_routes": [
      {
        "vendor": "Level3",
        "dialstring": "sip:+12125556789@gateway1.level3.com",
        "rate": 0.0045,
        "customer_rate": 0.0065,
        "margin": 0.0020
      }
    ]
  }
}
```

#### GET /api/v1/routing/lcr
Get LCR results for a specific call scenario
```json
Request Parameters:
?partition_id=ABC123
&account_ban=12345
&zone=interstate
&lrn=2125550000
&prefix=2125556789
&ocn=6529
&lata=132
&state=NY
&rate_limit=0.01
&ani_class=DOM
&max_results=5

Response:
{
  "routes": [
    {
      "provider_id": "level3",
      "provider_name": "Level 3 Communications",
      "dialstring": "sip:+12125556789@gateway1.level3.com",
      "rate": 0.0045,
      "zone": "interstate",
      "quality_score": 4.8
    }
  ]
}
```

### Vendor/Provider Management APIs

#### POST /api/v1/providers
Create a new provider/vendor
```json
Request:
{
  "name": "New Carrier Inc",
  "type": "LRN", // LRN, OCN_LATA, DNIS, INTERNATIONAL
  "billing_model": {
    "type": "LRN",
    "jurisdiction_class": "ENHANCED",
    "ij_policy": "INTRASTATE"
  },
  "gateways": [
    {
      "host": "gateway1.carrier.com",
      "port": 5060,
      "transport": "UDP",
      "priority": 1
    }
  ]
}
```

#### POST /api/v1/providers/{provider_id}/rates
Upload rate deck for a provider
```json
Request:
{
  "effective_date": "2025-02-01T00:00:00Z",
  "rates": [
    {
      "prefix": "1212",
      "description": "New York City",
      "interstate": 0.0045,
      "intrastate": 0.0042,
      "local": 0.0015
    }
  ]
}
```

### Customer Trunk Management APIs

#### POST /api/v1/customers
Create customer account with trunk configuration
```json
Request:
{
  "ban": "12345",
  "company": "Foo Corp",
  "contact": {
    "name": "John Doe",
    "email": "john@foo.com",
    "phone": "555-1234"
  },
  "trunk_config": {
    "auth_type": "IP_ACL", // IP_ACL, DIGEST, COMBINED
    "allowed_ips": ["198.51.100.0/24"],
    "credentials": {
      "username": "foo_trunk",
      "password": "secure_password"
    },
    "capacity": {
      "concurrent_calls": 100,
      "cps_limit": 10,
      "monthly_minutes": 1000000
    },
    "codecs": ["PCMU", "PCMA", "G729"],
    "partitions": ["ABC123"]
  }
}
```

#### GET /api/v1/customers/{ban}/cdrs
Retrieve CDRs for a customer
```json
Request Parameters:
?start_date=2025-01-01T00:00:00Z
&end_date=2025-01-31T23:59:59Z
&page=1
&per_page=100

Response:
{
  "cdrs": [
    {
      "call_id": "uuid-12345",
      "timestamp": "2025-01-15T10:30:00Z",
      "ani": "3035551234",
      "dnis": "2125556789",
      "duration": 245,
      "rate": 0.0045,
      "cost": 0.0184,
      "routing_metadata": {
        "lrn": "2125550000",
        "ocn": "6529",
        "lata": "132",
        "zone": "interstate",
        "vendor": "Level3"
      }
    }
  ],
  "pagination": {
    "total": 50000,
    "page": 1,
    "per_page": 100
  }
}
```

### Rate Management APIs

#### POST /api/v1/rates/import
Bulk import rates
```json
Request:
{
  "provider_id": "level3",
  "format": "CSV",
  "data": "base64_encoded_csv_data",
  "effective_date": "2025-02-01T00:00:00Z",
  "notify_customers": true
}
```

#### GET /api/v1/rates/analysis
Analyze rate competitiveness
```json
Request Parameters:
?destination=1212
&zone=interstate

Response:
{
  "analysis": {
    "destination": "1212",
    "our_rate": 0.0065,
    "market_average": 0.0070,
    "lowest_competitor": 0.0060,
    "highest_competitor": 0.0080,
    "margin": 0.0020,
    "recommendation": "COMPETITIVE"
  }
}
```

### Override & Exclusion APIs

#### POST /api/v1/overrides
Create routing override
```json
Request:
{
  "type": "CUSTOMER", // CUSTOMER, PREFIX, TIME_BASED
  "customer_ban": "12345",
  "prefix": "1212",
  "forced_route": "premium_carrier",
  "custom_rate": 0.0055,
  "valid_from": "2025-01-01T00:00:00Z",
  "valid_until": "2025-12-31T23:59:59Z"
}
```

#### POST /api/v1/exclusions
Create routing exclusion
```json
Request:
{
  "type": "DESTINATION", // DESTINATION, PROVIDER, CUSTOMER
  "customer_ban": "12345",
  "excluded_prefixes": ["53", "850"], // Cuba, North Korea
  "reason": "COMPLIANCE",
  "effective_date": "2025-01-01T00:00:00Z"
}
```

### Toll-Free Specific APIs

#### POST /api/v1/tollfree/cic-dip
Perform CIC dip for toll-free number
```json
Request:
{
  "toll_free_number": "8005551234",
  "ani": "3035556789"
}

Response:
{
  "cic": "0288",
  "carrier_name": "AT&T",
  "resp_org": "TFORG",
  "routing": {
    "vendor": "att_tollfree",
    "rate": 0.0180
  }
}
```

### Real-time Call Control APIs (WebSocket)

#### WebSocket: /ws/v1/calls
Real-time call events and control
```javascript
// Client subscribes to call events
{
  "action": "subscribe",
  "customer_ban": "12345"
}

// Server sends call events
{
  "event": "call.started",
  "call_id": "uuid-12345",
  "timestamp": "2025-01-15T10:30:00Z",
  "ani": "3035551234",
  "dnis": "2125556789",
  "routing": {
    "vendor": "Level3",
    "rate": 0.0045
  }
}

// Client can control active calls
{
  "action": "hangup",
  "call_id": "uuid-12345"
}
```

## API Design Principles & OpenAPI Requirements

### OpenAPI 3.0.3 Specification

#### Documentation Strategy
All APIs must be fully documented using OpenAPI 3.0.3 specification with:

1. **Auto-generated Documentation**
   - ReDoc for beautiful, interactive documentation
   - Swagger UI for testing capabilities
   - Postman collection generation
   - Client SDK generation (Python, Go, JavaScript, Ruby, PHP)

2. **OpenAPI Structure**
```yaml
openapi: 3.0.3
info:
  title: WARP API
  version: 1.0.0
  description: Wholesale Accounting Routing and Provisioning Platform
  contact:
    name: Ringer API Support
    email: api-support@ringer.com
    url: https://developers.warp.ringer.com
  license:
    name: Proprietary
    url: https://warp.ringer.com/terms

servers:
  - url: https://api.warp.ringer.com/v1
    description: Production
  - url: https://sandbox-api.warp.ringer.com/v1
    description: Sandbox
  - url: http://localhost:8080/v1
    description: Local Development

security:
  - ApiKeyAuth: []
  - OAuth2: [read, write]

tags:
  - name: Trunks
    description: SIP trunk management
  - name: Routing
    description: Call routing and LCR
  - name: Messages
    description: SMS/MMS/RCS messaging
  - name: Numbers
    description: Phone number management
  - name: Billing
    description: Usage and billing
```

3. **Complete API Examples**
Every endpoint must include:
- Request/response schemas
- Multiple examples
- Error responses
- Rate limiting headers
- Webhook payloads

### RESTful API Standards
1. **Versioning**: URL path versioning (`/api/v1/`, `/api/v2/`)
2. **Authentication**: Bearer token in Authorization header
3. **Rate Limiting**: Per-endpoint limits based on user tier
4. **Pagination**: Cursor-based for large datasets
5. **Filtering**: Query parameters for resource filtering
6. **Response Format**: JSON with consistent envelope

### API-First Development Workflow

1. **Design Phase**
   - Write OpenAPI spec first
   - Review with stakeholders
   - Generate mock server
   - Test with frontend team

2. **Implementation Phase**
   - Generate server stubs from OpenAPI
   - Implement business logic
   - Validate against spec
   - Auto-generate tests

3. **Documentation Phase**
   - Auto-generate ReDoc site
   - Create interactive examples
   - Generate client SDKs
   - Publish to developer portal

### Pain Points Addressed

#### Current System Limitations → WARP Solutions

1. **No API Access** → **Full API Coverage**
   - Every UI feature has corresponding API
   - Bulk operations via API
   - Real-time webhooks
   - WebSocket for live data

2. **Manual Rate Updates** → **Automated Rate Management**
   - API endpoints for rate imports
   - Scheduled rate changes
   - Automatic margin calculations
   - Rate change notifications

3. **Limited Visibility** → **Real-time Analytics**
   - Live call metrics API
   - Streaming CDR access
   - Custom report generation
   - Predictive analytics

4. **Complex Routing Setup** → **Simplified Configuration**
   - Visual routing builder API
   - Template-based routing
   - A/B testing capabilities
   - Automatic failover configuration

5. **No Integration Options** → **Extensive Integrations**
   - Webhook system for all events
   - Zapier/Make.com connectors
   - CRM integrations (Salesforce, HubSpot)
   - Billing system integrations

### API Response Structure
```json
{
  "success": true,
  "data": {
    // Resource data
  },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "cursor": "eyJpZCI6MTAwfQ=="
  },
  "errors": []
}
```

### Error Response Format
```json
{
  "success": false,
  "data": null,
  "errors": [
    {
      "code": "INVALID_PHONE_NUMBER",
      "message": "The phone number format is invalid",
      "field": "to_number",
      "details": {
        "provided": "123",
        "expected": "E.164 format"
      }
    }
  ]
}
```

### Webhook Events
```json
{
  "event_id": "evt_abc123",
  "event_type": "call.completed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "call_id": "call_xyz789",
    "duration": 245,
    "status": "completed"
  },
  "signature": "sha256=..."
}
```

## CI/CD Pipeline

### Frontend (Next.js → Vercel)

```yaml
# .github/workflows/frontend-deploy.yml
name: Deploy Frontend to Vercel

on:
  push:
    branches: [main, develop]
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend-deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: ./frontend

      - name: Run type checking
        run: npm run type-check
        working-directory: ./frontend

      - name: Run linting
        run: npm run lint
        working-directory: ./frontend

      - name: Run tests
        run: npm run test
        working-directory: ./frontend

      - name: Build application
        run: npm run build
        working-directory: ./frontend
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}

      - name: Deploy to Vercel
        uses: vercel/action@v3
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
        env:
          NODE_ENV: production
```

### Backend (API → GKE)

```yaml
# .github/workflows/api-deploy.yml
name: Deploy API to GKE

on:
  push:
    branches: [main, develop]
    paths:
      - 'api/**'
      - '.github/workflows/api-deploy.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Run tests
        run: |
          go test -v ./...
          go test -race -coverprofile=coverage.txt ./...
        working-directory: ./api

      - name: Build Docker image
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT }}/warp-api:${{ github.sha }} .
          docker tag gcr.io/${{ secrets.GCP_PROJECT }}/warp-api:${{ github.sha }} gcr.io/${{ secrets.GCP_PROJECT }}/warp-api:latest
        working-directory: ./api

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker for GCR
        run: gcloud auth configure-docker

      - name: Push Docker image
        run: |
          docker push gcr.io/${{ secrets.GCP_PROJECT }}/warp-api:${{ github.sha }}
          docker push gcr.io/${{ secrets.GCP_PROJECT }}/warp-api:latest

      - name: Deploy to GKE
        run: |
          gcloud container clusters get-credentials warp-cluster --region us-central1
          kubectl set image deployment/warp-api warp-api=gcr.io/${{ secrets.GCP_PROJECT }}/warp-api:${{ github.sha }}
          kubectl rollout status deployment/warp-api
```

### Database Migrations

```yaml
# .github/workflows/db-migrate.yml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'database/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run migrations
        run: |
          flyway migrate \
            -url=${{ secrets.DB_URL }} \
            -user=${{ secrets.DB_USER }} \
            -password=${{ secrets.DB_PASSWORD }} \
            -locations=filesystem:./database/migrations
```

## Development Roadmap

### Milestone 1: Infrastructure Foundation (Month 1-2)
- GCP project setup
- Terraform modules
- Basic Kubernetes cluster
- Consul deployment
- Database cluster

### Milestone 2: Core SIP Platform (Month 3-4)
- Kamailio configuration
- RTPEngine deployment
- Basic routing logic
- Database integration

### Milestone 3: API Development (Month 5-6)
- REST API framework
- Authentication system
- Trunk management
- Number management

### Milestone 4: Production Readiness (Month 7-8)
- Monitoring & alerting
- Security hardening
- Load testing
- Documentation

### Milestone 5: Advanced Features (Month 9-12)
- Messaging gateway
- Analytics platform
- Billing integration
- Customer portal

## Risk Assessment

### Technical Risks
- **Risk**: Scaling RTP media at high volumes
- **Mitigation**: SR-IOV, dedicated instances, CDN integration

- **Risk**: Database performance at scale
- **Mitigation**: CockroachDB sharding, Redis caching

- **Risk**: DDoS attacks on SIP infrastructure
- **Mitigation**: Cloud Armor, rate limiting, geo-blocking

### Business Risks
- **Risk**: Regulatory compliance complexity
- **Mitigation**: Legal counsel, compliance automation

- **Risk**: Competition from established providers
- **Mitigation**: API-first approach, competitive pricing

## UI Evolution Strategy (Polymet Integration)

### Component Architecture for AI-Driven UI
1. **Atomic Design System**
   - Atoms: Buttons, inputs, labels
   - Molecules: Form fields, cards, alerts
   - Organisms: Data tables, navigation, forms
   - Templates: Page layouts
   - Pages: Complete views

2. **Component Library Structure**
   ```typescript
   // Example component with Polymet-ready props
   interface TrunkCardProps {
     trunk: SIPTrunk;
     onEdit?: (id: string) => void;
     onDelete?: (id: string) => void;
     variant?: 'compact' | 'detailed' | 'minimal';
     theme?: ThemeConfig;
     customStyles?: CustomStyles;
   }
   ```

3. **Design Token System**
   - Colors, typography, spacing as variables
   - Easy theme switching
   - Brand customization support
   - Accessibility modes

4. **API-First Component Design**
   - All data fetched via API
   - No business logic in components
   - Pure presentation layer
   - Storybook documentation

### Polymet Preparation Checklist
- [ ] Comprehensive Storybook with all components
- [ ] Design tokens in CSS variables
- [ ] Component prop documentation
- [ ] Visual regression testing
- [ ] Accessibility annotations
- [ ] Responsive breakpoint system
- [ ] Animation/transition library
- [ ] Icon system with replaceable sets

## Success Criteria

### Year 1 Goals
- 50+ carrier customers
- 10M minutes per month
- 99.99% uptime achieved
- Full API feature parity with competitors

### Key Performance Indicators
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Call Success Rate (CSR)
- Mean Opinion Score (MOS)
- API adoption rate

## Appendices

### A. API Specification
See `/api/docs/openapi.yaml`

### B. Database Schema
See `/database/schemas/`

### C. Network Architecture
See `/docs/network-architecture.md`

### D. Security Policy
See `/docs/security-policy.md`

### E. Disaster Recovery Plan
See `/docs/disaster-recovery.md`

---

*This document is a living specification and will be updated as the project evolves.*