# Documentation Structure Guide

## 📊 Current Status
**Last Updated**: 2025-09-23  
**Project**: `ringer-warp-v01` (Production)  
**Phase 1**: ✅ **COMPLETE** - Infrastructure fully deployed  
**Phase 2**: 🚧 **STARTING** - Application deployment beginning  

📄 **Status Documents**:
- [CURRENT_STATUS.md](/CURRENT_STATUS.md) - Live deployment status
- [PHASE1_COMPLETE.md](/PHASE1_COMPLETE.md) - Infrastructure completion report
- [PHASE2_PLAN.md](/PHASE2_PLAN.md) - Application deployment plan

## Overview
This directory (`/docs/`) contains platform-wide documentation, external integrations, and cross-cutting concerns for the WARP platform. Service-specific implementation details are located in `/warp/docs/`.

## Documentation Organization

### 📁 `/docs/` - Platform-Wide Documentation
This directory contains documentation that applies to the entire platform or external integrations:

#### Platform Architecture & Decisions
- `ARCHITECTURAL_DECISIONS.md` - High-level platform architecture decisions
- `DEVELOPMENT_ENVIRONMENT_DECISIONS.md` - Development framework and tooling choices
- `IMPLEMENTATION_ROADMAP.md` - Platform implementation timeline and milestones

#### External Integrations
- `HUBSPOT_INTEGRATION.md` - HubSpot CRM integration guide
- `GANDI_API_SETUP.md` - Gandi DNS management setup
- `DNS_MANAGEMENT_GANDI_API.md` - DNS management via Gandi API
- `DNS_MANAGEMENT_STRATEGY.md` - Overall DNS strategy
- `EXTERNAL_DEPENDENCIES.md` - All third-party dependencies
- `INTEGRATION_MATRIX.md` - Integration overview matrix
- `THIRD_PARTY_API_AUDIT.md` - Third-party API inventory

#### Development & Operations
- `ENVIRONMENT_SETUP.md` - Development environment configuration
- `STAGING_ENVIRONMENT_SETUP.md` - Staging environment setup
- `CREATE_GITHUB_REPO.md` - Repository setup guide
- `PROJECT_COMPLETENESS_CHECKLIST.md` - Project completion checklist

#### Developer Guides
- `CLAUDE_FLOW_GUIDE.md` - Claude AI assistant guide
- `HIVEMIND_ORCHESTRATION_GUIDE.md` - AI orchestration guide

#### Compliance & Business Processes
- `SMS_COMPLIANCE_REQUIREMENTS.md` - SMS regulatory compliance
- `PORT_PROCESS_EXPLANATION.md` - Number porting process
- `PRODUCT_CATALOG.md` - Product offerings catalog
- `API_ENDPOINTS.md` - API endpoint documentation
- `COMPLEX_ROUTING_ANALYSIS.md` - Routing logic analysis

#### Third-Party API Documentation (`/api_docs/`)
- `authorize.net-sdk-node-master/` - Payment processing SDK
- `AvaTax-REST-V2-JS-SDK-main/` - Tax calculation SDK
- `Hubspot-PublicApiSpecs/` - HubSpot API specifications
- `netsuite-suitecloud-sdk-master/` - NetSuite integration SDK
- `sendgrid-nodejs-main/` - Email service SDK
- `sinch-java-sms-master/` - SMS provider SDK
- Various API specifications (YAML/JSON files)

### 📁 `/warp/docs/` - WARP Service Documentation
Located in the WARP service directory, contains implementation-specific documentation:

#### Product & Architecture
- `PRD.md` - Product Requirements Document
- `PRD-UPDATES.md` - PRD revision history
- `ARCHITECTURE.md` - WARP service architecture

#### Billing System
- `BILLING_PRD.md` - Billing product requirements
- `BILLING_SYSTEM.md` - Billing implementation details
- `BILLING_ARCHITECTURE.md` - Billing technical architecture
- `BILLING_FLOWS.md` - Billing data flows

#### Data & Analytics
- `BIGQUERY_CDR_ARCHITECTURE.md` - CDR/MDR data pipeline

#### Network & Infrastructure
- `SIP_NETWORK_ARCHITECTURE.md` - SIP network design
- `SMS_ARCHITECTURE.md` - SMS/MMS system architecture
- `HOMER_ARCHITECTURE.md` - Homer SIP capture setup
- `HOMER_TROUBLESHOOTING.md` - Homer troubleshooting guide
- `PROMETHEUS_METRICS_ARCHITECTURE.md` - Metrics and monitoring

#### Configuration Files
- `telique.json` - Telique API configuration

## When to Use Which Directory

### Use `/docs/` for:
✅ Platform-wide architectural decisions  
✅ External API integrations and SDKs  
✅ Cross-service documentation  
✅ Development environment setup  
✅ Compliance and regulatory documentation  
✅ Third-party vendor documentation  
✅ General developer guides  

### Use `/warp/docs/` for:
✅ WARP-specific implementation details  
✅ Service architecture and design  
✅ Internal APIs and data flows  
✅ Service-specific configurations  
✅ Operational runbooks  
✅ Service-specific troubleshooting  

## Contributing

When adding new documentation:
1. Determine if it's platform-wide or WARP-specific
2. Place in appropriate directory following the structure above
3. Update this README if adding a new category
4. Keep related documentation together
5. Use clear, descriptive filenames

## Quick Links

### Platform Documentation
- [Architectural Decisions](./ARCHITECTURAL_DECISIONS.md)
- [Environment Setup](./ENVIRONMENT_SETUP.md)
- [External Dependencies](./EXTERNAL_DEPENDENCIES.md)
- [Integration Matrix](./INTEGRATION_MATRIX.md)

### WARP Service Documentation
- [Product Requirements](/warp/docs/PRD.md)
- [Service Architecture](/warp/docs/ARCHITECTURE.md)
- [Billing System](/warp/docs/BILLING_SYSTEM.md)
- [BigQuery CDR Architecture](/warp/docs/BIGQUERY_CDR_ARCHITECTURE.md)

## Documentation Standards

1. **File Naming**: Use UPPERCASE with underscores for documentation files
2. **Format**: Markdown (`.md`) for all documentation
3. **Structure**: Include table of contents for documents > 100 lines
4. **Diagrams**: Use Mermaid or ASCII art for inline diagrams
5. **Updates**: Include version history or last updated date
