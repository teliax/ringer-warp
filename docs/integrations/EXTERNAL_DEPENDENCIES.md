# WARP Platform External Dependencies

## Complete External Service Architecture

This document outlines ALL external service dependencies required for the WARP platform to function.

## Customer Relationship Management & Support

### HubSpot (CRM + Service Hub)
- **Purpose**: Unified customer data management, sales pipeline, and support ticketing
- **Features**:
  - **CRM Capabilities**:
    - Customer profiles
    - Company hierarchies
    - Contact history
    - Custom properties for telecom data
    - Deal Pipeline
    - Quote management
    - Contract tracking
    - Revenue forecasting
  - **Service Hub Features**:
    - Ticket management
    - SLA tracking
    - Escalation workflows
    - Knowledge base
    - Live chat
    - Customer portal
    - Conversation inbox
    - Customer satisfaction surveys
    - Support analytics
  - **Integration Capabilities**:
    - Bidirectional sync
    - Webhook events
    - Custom objects for trunks/numbers
    - Activity timeline
    - Unified customer view
- **Integration Points**:
  - Customer creation/update sync
  - Trunk provisioning to deal close
  - Usage data to customer timeline
  - Support ticket creation and tracking
  - Invoice status updates
  - Lead scoring based on usage
  - Ticket association with technical objects
  - Chat widget on customer portal
- **Custom Properties Required**:
  - BAN (Billing Account Number)
  - Trunk IDs
  - Monthly usage
  - MRR (Monthly Recurring Revenue)
  - Service tier
  - Number count
  - Ticket priority mapping
  - Technical issue categories
- **API Documentation**: https://developers.hubspot.com/

## Payment Processing

### Authorize.Net (Credit Cards)
- **Purpose**: PCI-compliant credit card processing
- **Features Used**:
  - Customer payment profiles (tokenization)
  - Recurring billing subscriptions
  - Payment method updates
  - Fraud detection suite
  - Webhook notifications for payment events
- **Integration Points**:
  - Customer portal payment page
  - Admin portal refund processing
  - Automated monthly billing
- **API Documentation**: https://developer.authorize.net/api/reference/

### Mustache/Plaid (ACH Payments)
- **Purpose**: ACH payment processing with instant verification
- **Features Used**:
  - Bank account linking via Plaid Link
  - Instant account verification
  - ACH debit initiation
  - Balance checking (optional)
  - Webhook notifications for ACH status
- **Integration Points**:
  - Customer portal bank account setup
  - Recurring ACH for high-volume customers
  - Lower fees than credit cards (important for wholesale)
- **API Documentation**: https://plaid.com/docs/

## Telecom Data Services

### Telique
- **Purpose**: Comprehensive telecom data provider
- **Endpoint**: `https://api-dev.ringer.tel/v1/telique`
- **Features**:
  - **LERG Database**:
    - Operating Company Numbers (OCN)
    - Rate centers
    - LATA boundaries
    - NPA-NXX assignments
    - Block ID data
  - **LRN Services**:
    - Real-time LRN dips for routing decisions
    - Porting status checks
    - Carrier identification
  - **Do Not Originate (DNO)**:
    - Prohibited number checking
    - Compliance with regulations
- **Integration Points**:
  - Pre-call LRN lookup for every call
  - Batch LERG updates (daily)
  - Real-time porting validation
  - DNO list synchronization
- **Caching Strategy**:
  - LRN: 24-hour cache
  - LERG: Weekly refresh
  - DNO: 1-hour cache

### TransUnion TruContact (CNAM)
- **Purpose**: Caller ID name management
- **Features**:
  - CNAM database dips
  - CNAM registration/updates
  - Outbound CNAM delivery
  - CNAM storage for customer numbers
  - Spam likely detection
- **Integration Points**:
  - Inbound call CNAM lookup
  - Customer CNAM management portal
  - Batch CNAM updates
  - API for real-time queries
- **API Documentation**: https://www.transunion.com/solution/trucontact

### Sinch
- **Purpose**: Global SMS/MMS gateway and voice termination
- **Features**:
  - **SMS/MMS**:
    - SMPP 3.4/5.0 binds
    - High-volume A2P messaging
    - Global carrier connectivity
    - DLR (Delivery Receipt) tracking
    - Short code support
    - 10DLC campaign management
  - **Voice**:
    - International termination
    - Emergency backup routing
    - Direct carrier connections
- **Integration Points**:
  - Jasmin SMSC → Sinch SMPP
  - REST API for low-volume
  - Webhook for DLRs
  - Voice failover routing
- **API Documentation**: https://developers.sinch.com/

### Number Inventory Providers (TBD)
- **Potential Providers**:
  - **Bandwidth**: Primary for US DIDs
  - **Telnyx**: Secondary provider
  - **Twilio**: Backup/international
  - **Direct carrier relationships**: For bulk inventory
- **Required Features**:
  - Real-time availability API
  - Instant provisioning
  - Number porting API
  - E911 provisioning
  - SMS enablement
  - Toll-free RespOrg

## Messaging Compliance & Registration

### The Campaign Registry (TCR)
- **Purpose**: 10DLC SMS campaign registration and compliance
- **Features**:
  - **Brand Registration**:
    - Business verification
    - Brand score calculation
    - Entity type classification
    - Tax ID validation
  - **Campaign Management**:
    - Use case registration
    - Sample message approval
    - Throughput tier assignment
    - Monthly volume limits
  - **Compliance Monitoring**:
    - Message content filtering
    - Opt-out compliance
    - SHAFT detection
    - Velocity checking
- **Integration Points**:
  - Brand registration API
  - Campaign creation/update API
  - Campaign sharing with CNPs (Sinch)
  - Webhook for status updates
  - Quarterly brand vetting
- **Requirements**:
  - EIN/Tax ID verification
  - Business address validation
  - Industry classification
  - Website verification
- **API Documentation**: https://www.campaignregistry.com/api-documentation/

### Somos Toll-Free Management
- **Purpose**: Toll-free number provisioning and RespOrg services
- **Features**:
  - **Number Management**:
    - Available number search
    - Instant provisioning
    - Number reservation
    - Vanity number requests
    - RespOrg transfers
  - **Routing Control**:
    - Toll-free routing plans
    - Disaster recovery routing
    - Time-of-day routing
    - Geographic routing
    - Percentage-based routing
  - **Compliance**:
    - RespOrg certification
    - FCC compliance
    - Text-enablement for toll-free
    - Verified calling registration
- **Integration Points**:
  - SMS/800 API for number management
  - Routing plan updates
  - RespOrg change notifications
  - Text-enable toll-free numbers
  - Real-time routing changes
- **Requirements**:
  - RespOrg ID required
  - FCC 499 Filer status
  - Quarterly regulatory fees
  - 24x7 support capability
- **API Documentation**: https://somos.com/api/

## Cloud Services (GCP)

### Core Infrastructure
- **Cloud SQL**: Managed PostgreSQL
- **Memorystore**: Managed Redis
- **BigQuery**: CDR analytics warehouse
- **Cloud Pub/Sub**: Event streaming
- **Cloud Tasks**: Job scheduling
- **Cloud Storage**: Backups and recordings
- **GKE**: Kubernetes clusters
- **Cloud Load Balancing**: L4/L7 load balancing
- **Cloud Armor**: DDoS protection
- **Cloud NAT**: Egress IP management

## Authentication & Security

### Google Identity Platform
- **Purpose**: Identity management and authentication
- **Features**:
  - SSO/SAML integration
  - MFA enforcement
  - JWT token management
  - RBAC policies
  - Social login providers
  - Passwordless authentication

## Billing & Financial Systems

### NetSuite
- **Purpose**: ERP, invoicing, and financial management
- **Features**:
  - Customer master data management
  - Invoice generation and delivery
  - Revenue recognition
  - Accounts receivable
  - Financial reporting
  - Contract management
  - Subscription billing
- **Integration Points**:
  - Customer sync (bidirectional)
  - Usage data export for invoicing
  - Payment status updates
  - Credit limit checks
  - Contract terms retrieval
- **Integration Method**: REST API + SuiteScript + CSV import/export
- **API Documentation**: https://docs.oracle.com/en/cloud/saas/netsuite/

### Avalara
- **Purpose**: Tax calculation and compliance
- **Features**:
  - Real-time sales tax calculation
  - Telecom tax determination (critical for USF, E911 fees)
  - Tax exemption certificate management
  - Multi-jurisdiction support
  - Tax filing and remittance
  - Audit reports
- **Integration Points**:
  - Quote tax calculation
  - Invoice tax calculation
  - Tax reporting to NetSuite
  - Exemption certificate validation
- **API Documentation**: https://developer.avalara.com/

## Monitoring & Analytics

### Prometheus
- **Purpose**: Metrics collection
- **Exporters Required**:
  - Kamailio exporter
  - RTPEngine exporter
  - Custom business metrics exporter
  - Node exporter for system metrics

### Grafana
- **Purpose**: Metrics visualization
- **Dashboards**:
  - System health
  - Call quality metrics
  - Revenue/cost analytics
  - API performance

### Homer
- **Purpose**: SIP capture and analysis
- **Features**:
  - HEP protocol support
  - Call flow visualization
  - PCAP export
  - Troubleshooting tools

## SIP/Telecom Components

### Kamailio
- **Version**: 5.7+
- **Purpose**: SIP proxy and registrar with embedded routing engine
- **Core Technology**: 
  - **LuaJIT**: High-performance Lua runtime with FFI
  - **FFI (Foreign Function Interface)**: Direct C library calls from Lua
  - **KEMI**: Kamailio Embedded Interface for Lua scripting
- **Dependencies**:
  - Redis for state management
  - PostgreSQL for configuration
  - RTPEngine for media handling
  - LuaJIT 2.1+ with FFI support
  - lua-resty-http for API calls to WARP services
- **Performance**:
  - Sub-50ms routing decisions via FFI
  - JIT compilation for hot code paths
  - Direct memory access to SIP messages

### RTPEngine
- **Purpose**: Media proxy and transcoding
- **Features**:
  - RTP/SRTP handling
  - Codec transcoding
  - DTMF detection
  - Recording capability

### Jasmin SMSC
- **Purpose**: SMS gateway
- **Dependencies**:
  - RabbitMQ for message queuing
  - Redis for routing cache
  - PostgreSQL for configuration

## Communication Services

### SendGrid
- **Purpose**: Transactional and marketing email delivery
- **Features**:
  - Transactional email API
  - Email templates
  - Dynamic content personalization
  - Delivery optimization
  - Bounce/complaint handling
  - Unsubscribe management
  - Email analytics
  - IP warm-up for high volume
- **Integration Points**:
  - Invoice delivery
  - Password reset emails
  - Account notifications
  - CDR reports delivery
  - System alerts to admins
  - Welcome emails
  - Usage alerts
- **API Documentation**: https://docs.sendgrid.com/

## Development Tools

### GitHub Actions
- **Purpose**: CI/CD pipeline
- **Workflows**:
  - Frontend deployment to Vercel
  - Backend deployment to GKE
  - Database migrations
  - Terraform applies

### Vercel
- **Purpose**: Frontend hosting
- **Features**:
  - Edge network CDN
  - Automatic deployments
  - Preview environments
  - Analytics

### Terraform Cloud
- **Purpose**: Infrastructure as Code management
- **Features**:
  - State management
  - Plan/apply workflows
  - Variable management
  - Team collaboration

## External Service Dependencies Summary

| Service | Critical | Failover Strategy | Monthly Cost Estimate |
|---------|----------|-------------------|----------------------|
| Google Identity Platform | Yes | Cache JWT validation | $500-2000/month |
| GCP Infrastructure | Yes | Multi-region failover | $5000-15000/month |
| Telique | Yes | Cache LRN/LERG data | Usage-based (~$2000/mo) |
| TransUnion CNAM | Yes | Cache CNAM data | $0.0035/dip |
| Sinch SMS/Voice | Yes | Multiple SMPP binds | Usage-based |
| TCR (10DLC) | Yes | Pre-register campaigns | $15/brand + $10/campaign |
| Somos (Toll-Free) | Yes | Cache routing plans | $2/number/month + fees |
| NetSuite | Yes | Queue for batch sync | $999+/month |
| Avalara | Yes | Cache tax rates | $3000+/month |
| Authorize.Net | Yes | Queue for retry | $25 + 2.9% + $0.30/txn |
| Mustache/Plaid | Yes | Fall back to manual | $0.30/ACH + Plaid fees |
| HubSpot Service Hub | Yes | Degrade to email only | Included with CRM |
| Number Inventory | Yes | Multiple providers | TBD based on provider |

## Integration Priority Order

### Phase 1 (MVP)
1. Google Identity Platform - Required for login
2. GCP Core Services - Infrastructure
3. Telique - Required for routing

### Phase 2 (Billing)
4. Authorize.Net - Credit card payments
5. NetSuite - Invoice generation

### Phase 3 (Complete)
6. Mustache/Plaid - ACH payments
7. Sinch - SMS gateway
8. Homer - SIP debugging

## Security Considerations

### API Keys Management
- All keys stored in Google Secret Manager
- Rotation schedule: 90 days
- Separate keys for dev/staging/production

### PCI Compliance
- No credit card data stored
- Authorize.Net handles all PCI requirements
- Payment forms use hosted fields

### Data Residency
- All data stays in US regions
- No EU processing initially
- GDPR compliance deferred to Phase 2

---
*Last Updated: January 2025*