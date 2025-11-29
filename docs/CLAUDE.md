# Documentation Directory - Claude Code Instructions

This directory contains comprehensive documentation for the WARP platform.

## Directory Organization

```
docs/
├── architecture/              # System design and architectural decisions
├── security/                  # Auth, permissions, and security documentation
├── integrations/             # Third-party integrations and external services
├── deployment/               # Deployment procedures and infrastructure
├── api/                      # API documentation and specifications
├── development/              # Development guides and environment setup
├── product/                  # Product requirements and business docs
├── guides/                   # Operational and how-to guides
├── status/                   # Platform status reports (live system state)
├── warp-services/           # Service-specific architecture docs
├── api_docs/                # Third-party API specifications
├── runbooks/                # Operational runbooks
├── planning-archives/       # Historical planning documents
├── archive/                 # Historical documentation
│   └── completed-tasks-2025/  # Archived task completion docs
├── CLAUDE.md                # This file (documentation guide)
├── README.md                # Documentation index
└── DOCUMENTATION_MIGRATION_LOG.md  # Migration history (Nov 2025)
```

---

## Documentation Categories

### 1. Architecture & Design (`architecture/`)

**Purpose**: High-level system design, architectural decisions, and design patterns.

**Key Files**:
- `architecture/ARCHITECTURAL_DECISIONS.md` - Platform-wide architectural choices
- `architecture/ARCHITECTURAL_DECISION_GO_SMPP.md` - Why we migrated from Jasmin to Go
- `architecture/GO_SMPP_GATEWAY_ARCHITECTURE.md` - Custom Go SMPP implementation
- `architecture/JASMIN_REDIS_ARCHITECTURE.md` - Jasmin and Redis integration
- `architecture/LCR_ROUTING_ARCHITECTURE.md` - Least Cost Routing design
- `architecture/COMPLEX_ROUTING_ANALYSIS.md` - Advanced routing patterns
- `architecture/PERMISSION_SYSTEM_ADAPTATION.md` - Permission system design
- `warp-services/ARCHITECTURE.md` - Complete system architecture
- `warp-services/SIP_NETWORK_ARCHITECTURE.md` - Kamailio + RTPEngine design
- `warp-services/SMS_ARCHITECTURE.md` - SMPP gateway architecture

**When to Read**:
- Before making major architectural changes
- When designing new services
- When evaluating technology choices
- When onboarding new team members

**When to Update**:
- After major architectural decisions
- When adding new core services
- When refactoring key components
- When changing technology stack

---

### 2. API Documentation (`api/`)

**Purpose**: API design, development guidelines, and integration patterns.

**Key Files**:
- `api/API_DESIGN_FOUNDATION.md` - Complete API endpoint catalog
- `api/API_DEVELOPMENT_GUIDE.md` - How to add new endpoints
- `api/API_ENDPOINTS.md` - Quick reference for all endpoints
- `api/API_CLIENT_SPECIFICATION.md` - Client integration guide
- `api/FRONTEND_API_MAPPING.md` - Frontend to API endpoint mappings
- `integrations/NUMBER_PROCUREMENT_PLAN.md` - Teliport API integration

**When to Read**:
- Before adding new API endpoints
- When integrating external services
- When building API clients
- When troubleshooting API issues

**When to Update**:
- After adding new endpoints
- When changing authentication methods
- When modifying response formats
- When integrating new third-party APIs

---

### 3. Deployment & Operations (`deployment/`)

**Purpose**: Deployment procedures, infrastructure setup, and operational runbooks.

**Key Files**:
- `deployment/DEPLOYMENT.md` - Production deployment procedures
- `deployment/deployment-prerequisites.md` - Required tools and access
- `deployment/deployment-validation-checklist.md` - Post-deployment verification
- `deployment/kubernetes-deployment-guide.md` - K8s-specific procedures
- `deployment/rtpengine-deployment.md` - RTPEngine deployment guide
- `deployment/database-setup-guide.md` - Database initialization
- `deployment/dns-ssl-deployment-guide.md` - DNS and SSL setup
- `deployment/DNS_MANAGEMENT_STRATEGY.md` - DNS automation strategy
- `deployment/monitoring-endpoints.md` - Monitoring configuration
- `development/ENVIRONMENT_SETUP.md` - Development environment setup

**When to Read**:
- Before deploying to production
- When setting up new environments
- When troubleshooting deployment issues
- During incident response

**When to Update**:
- After deployment process changes
- When adding new infrastructure components
- When updating Kubernetes manifests
- After incident post-mortems

---

### 4. Security & Permissions (`security/`)

**Purpose**: Authentication, authorization, and security documentation.

**Key Files**:
- `security/AUTH_AND_PERMISSION_SYSTEM.md` - Complete auth system documentation
- `security/AUTH_IMPLEMENTATION_PLAN.md` - Auth implementation roadmap
- `security/WARP_AUTH_PERMISSION_ARCHITECTURE.md` - Permission architecture design
- `security/SECRETS_MANAGEMENT_GUIDE.md` - Credential management
- `security/SMS_COMPLIANCE_REQUIREMENTS.md` - Compliance and security requirements

**When to Read**:
- Before implementing auth features
- When troubleshooting permission issues
- When adding new API endpoints
- During security reviews

**When to Update**:
- After auth system changes
- When adding new permissions
- After security audits
- When compliance requirements change

---

### 5. Integrations & External Services (`integrations/`)

**Purpose**: Third-party integrations, API specifications, and vendor documentation.

**Key Files**:
- `integrations/INTEGRATION_MATRIX.md` - All external service integrations
- `integrations/EXTERNAL_DEPENDENCIES.md` - Dependency catalog
- `integrations/THIRD_PARTY_API_AUDIT.md` - Vendor API inventory
- `integrations/HUBSPOT_INTEGRATION.md` - HubSpot CRM integration
- `integrations/HUBSPOT_SYNC_STRATEGY.md` - CRM sync design
- `integrations/NETSUITE_INTEGRATION.md` - NetSuite ERP integration
- `integrations/SOMOS_INTEGRATION.md` - SOMOS toll-free integration
- `integrations/GANDI_API_SETUP.md` - DNS provider integration
- `integrations/NUMBER_PROCUREMENT_PLAN.md` - Teliport DID management

**Subdirectories**:
- `api_docs/` - Third-party OpenAPI specs, SDKs, examples
  - HubSpot specs
  - Gandi API
  - Teliport/SOA APIs
  - NetSuite SDK
  - SendGrid
  - And more...

**When to Read**:
- Before integrating new vendors
- When troubleshooting external API issues
- When updating API credentials
- When evaluating vendor alternatives

**When to Update**:
- After vendor API changes
- When adding new integrations
- When rotating credentials
- When vendor documentation updates

---

### 6. Development Environment (`development/`)

**Purpose**: Development setup, environment configuration, and coding guidelines.

**Key Files**:
- `development/DEVELOPMENT_ENVIRONMENT_DECISIONS.md` - Development architecture choices
- `development/ENVIRONMENT_SETUP.md` - Local development setup
- `development/STAGING_ENVIRONMENT_SETUP.md` - Staging environment configuration
- `development/PROVIDER_MODULES_SPECIFICATION.md` - Plugin architecture spec
- `development/PORT_PROCESS_EXPLANATION.md` - Port number management guide

**When to Read**:
- When onboarding new developers
- Before setting up local environment
- When troubleshooting development issues
- When creating new modules

**When to Update**:
- After changing development tools
- When updating setup procedures
- After adding new dependencies
- When changing module architecture

---

### 7. Product & Business (`product/`)

**Purpose**: Product requirements, business logic, and feature specifications.

**Key Files**:
- `product/PRODUCT_CATALOG.md` - Service offerings and products
- `product/IMPLEMENTATION_ROADMAP.md` - Development timeline and milestones
- `product/PROJECT_COMPLETENESS_CHECKLIST.md` - Project status tracking
- `product/ADMIN_PORTAL_INTEGRATION.md` - Admin UI requirements
- `product/USER_INVITATION_SYSTEM.md` - User onboarding flow

**When to Read**:
- Before implementing new features
- When clarifying business requirements
- During sprint planning
- When designing user flows

**When to Update**:
- After product decisions
- When requirements change
- After customer feedback
- When features are completed

---

### 8. Operational Guides (`guides/`)

**Purpose**: How-to guides, operational procedures, and troubleshooting.

**Key Files**:
- `guides/ADMIN_UI_TRUNK_CONFIG_PROMPT.md` - Admin UI configuration guide
- `guides/HIVEMIND_ORCHESTRATION_GUIDE.md` - Multi-agent orchestration
- `guides/manifest-review-findings.md` - Kubernetes manifest review

**When to Read**:
- When performing specific tasks
- During troubleshooting
- When learning new procedures
- For quick reference

**When to Update**:
- After process improvements
- When procedures change
- After discovering new solutions
- When adding new guides

---

### 9. Service-Specific Documentation (`warp-services/`)

**Purpose**: Detailed documentation for specific platform services.

**Key Files**:
- `warp-services/ARCHITECTURE.md` - Complete system architecture
- `warp-services/PRD.md` - Product Requirements Document
- `warp-services/PRD-UPDATES.md` - Feature updates log
- `warp-services/BILLING_SYSTEM.md` - Billing architecture
- `warp-services/BILLING_FLOWS.md` - Billing workflows
- `warp-services/BILLING_PRD.md` - Billing requirements
- `warp-services/SIP_NETWORK_ARCHITECTURE.md` - Voice routing
- `warp-services/SMS_ARCHITECTURE.md` - Messaging architecture
- `warp-services/HOMER_ARCHITECTURE.md` - SIP capture system
- `warp-services/HOMER_TROUBLESHOOTING.md` - Homer debugging guide
- `warp-services/PROMETHEUS_METRICS_ARCHITECTURE.md` - Monitoring design
- `warp-services/BIGQUERY_CDR_ARCHITECTURE.md` - Analytics pipeline

**When to Read**:
- When working on specific services
- During service troubleshooting
- When planning service changes
- For deep technical understanding

**When to Update**:
- After service modifications
- When adding new features
- After troubleshooting discoveries
- When service architecture changes

---

### 10. Infrastructure as Code

**Purpose**: Terraform, Kubernetes, and infrastructure documentation.

**Related Directories**:
- `../infrastructure/terraform/` - IaC modules
- `../infrastructure/kubernetes/` - K8s manifests
- `../infrastructure/database/` - Database schemas

**Key Files in docs/**:
- `architecture/COMPLEX_ROUTING_ANALYSIS.md` - Network routing design
- `architecture/LCR_ROUTING_ARCHITECTURE.md` - Least Cost Routing
- `deployment/DNS_MANAGEMENT_STRATEGY.md` - DNS automation

---

### 11. Status Reports (`status/`)

**Purpose**: Point-in-time snapshots of platform health.

**Files**:
- `PLATFORM_STATUS_<date>.md` - Comprehensive system audit
- `README.md` - Report generation guidelines
- `CLAUDE.md` - Instructions for Claude (you are here)

See `status/CLAUDE.md` for detailed report generation instructions.

---

## Documentation Lifecycle

### Creating New Documentation

1. **Choose the right location**:
   - Architecture decisions → `ARCHITECTURAL_*.md`
   - API design → `API_*.md`
   - Service-specific → `warp-services/`
   - Status reports → `status/`
   - External APIs → `api_docs/`

2. **Use standard format**:
   ```markdown
   # Title
   **Version**: 1.0.0
   **Date**: YYYY-MM-DD
   **Status**: Draft|Review|Approved|Archived
   **Owner**: Team/Person

   ## Executive Summary
   [High-level overview]

   ## Table of Contents
   [Sections]

   ## [Content sections]

   ## Document Control
   | Version | Date | Author | Changes |
   |---------|------|--------|---------|
   ```

3. **Link related docs**:
   - Cross-reference related documents
   - Update index/README files
   - Add to relevant sections above

### Updating Existing Documentation

1. **Check document version** and status
2. **Increment version number** (semantic: major.minor.patch)
3. **Update "Last Updated" date**
4. **Add entry to Document Control table**
5. **If major changes**: Archive old version to `archive/`

### Archiving Documentation

When documentation becomes obsolete:

1. **Move to** `archive/` with date suffix:
   ```bash
   mv docs/OLD_FEATURE.md docs/archive/OLD_FEATURE_2025-10-27.md
   ```

2. **Add deprecation notice** to old doc:
   ```markdown
   > **DEPRECATED**: This document was superseded by NEW_DOC.md on 2025-10-27.
   > Archived for historical reference only.
   ```

3. **Update references** in other docs

---

## Finding Documentation

### Quick Reference

**"I need to..."** → **Read this doc**:

| Task | Documentation |
|------|---------------|
| Deploy a new service | `deployment/DEPLOYMENT.md` + `deployment/deployment-validation-checklist.md` |
| Add API endpoint | `api/API_DEVELOPMENT_GUIDE.md` + `api/API_DESIGN_FOUNDATION.md` |
| Integrate vendor API | `integrations/INTEGRATION_MATRIX.md` + `api_docs/<vendor>/` |
| Understand SMPP gateway | `architecture/GO_SMPP_GATEWAY_ARCHITECTURE.md` + `architecture/ARCHITECTURAL_DECISION_GO_SMPP.md` |
| Configure DNS | `deployment/DNS_MANAGEMENT_STRATEGY.md` + `integrations/GANDI_API_SETUP.md` |
| Manage secrets | `security/SECRETS_MANAGEMENT_GUIDE.md` |
| Set up billing | `warp-services/BILLING_SYSTEM.md` + `warp-services/BILLING_FLOWS.md` |
| Understand auth system | `security/AUTH_AND_PERMISSION_SYSTEM.md` + `security/AUTH_IMPLEMENTATION_PLAN.md` |
| Check platform health | `status/PLATFORM_STATUS_<latest>.md` |
| Port telephone numbers | `integrations/NUMBER_PROCUREMENT_PLAN.md` + `development/PORT_PROCESS_EXPLANATION.md` |
| Manage DIDs | `integrations/NUMBER_PROCUREMENT_PLAN.md` |
| Setup dev environment | `development/ENVIRONMENT_SETUP.md` + `development/DEVELOPMENT_ENVIRONMENT_DECISIONS.md` |

### Search Commands

```bash
# Search all docs for a topic
grep -r "SMPP" docs/ --include="*.md" | grep -v node_modules

# Find files related to authentication
find docs/security/ -name "*.md"

# List all architecture docs
ls docs/architecture/*.md

# Search for API endpoints
grep -r "POST /v1/" docs/api/ --include="*.md"

# Find integration documentation
ls docs/integrations/*.md

# Search deployment guides
ls docs/deployment/*.md
```

---

## Documentation Best Practices

### Writing Guidelines

**DO**:
- ✅ Use clear, concise language
- ✅ Include code examples
- ✅ Provide diagrams (ASCII art or links to images)
- ✅ Add table of contents for docs >200 lines
- ✅ Include version numbers and dates
- ✅ Cross-reference related docs
- ✅ Provide "Quick Start" sections
- ✅ Include troubleshooting sections

**DON'T**:
- ❌ Duplicate information across multiple docs
- ❌ Include sensitive credentials (use placeholders)
- ❌ Write overly detailed docs that will become stale
- ❌ Create docs without clear purpose/audience
- ❌ Forget to update related docs when making changes

### Markdown Standards

```markdown
# H1 - Document Title (one per doc)
## H2 - Major Section
### H3 - Subsection
#### H4 - Sub-subsection (use sparingly)

**Bold** for emphasis
*Italic* for terms
`code` for inline code
```code blocks``` for multi-line code

> Blockquotes for important notes

- Bullet lists for items
1. Numbered lists for procedures

| Tables | For | Structured | Data |
|--------|-----|-----------|------|

[Links](relative/path.md) for internal references
[External](https://example.com) for web resources
```

### Code Examples

Always include:
- Language identifier (```go, ```bash, ```sql, ```yaml)
- Comments explaining non-obvious code
- Error handling examples
- Full working examples when possible

---

## Subdirectory Guidelines

### warp-services/

**Purpose**: Service-specific documentation (Kamailio, RTPEngine, SMPP, etc.)

**Contents**:
- Architecture diagrams
- Configuration guides
- API specifications
- Troubleshooting guides

**Naming**: `<SERVICE>_<TYPE>.md`
- `SMS_ARCHITECTURE.md`
- `BILLING_SYSTEM.md`
- `PRD.md`

### api_docs/

**Purpose**: Third-party vendor API documentation (OpenAPI specs, SDKs, examples)

**Organization**:
```
api_docs/
├── Hubspot-PublicApiSpecs/    # HubSpot OpenAPI specs
├── netsuite-suitecloud-sdk/   # NetSuite SDK
├── sendgrid-nodejs/            # SendGrid SDK
├── inventory-api.yaml          # Teliport Inventory API (copy from ringer-soa)
├── portability.yaml            # Teliport Portability API (copy from ringer-soa)
├── lerg-api.yaml               # Telique LERG API
├── lrn-api.yaml                # Telique LRN API
└── README.md                   # API docs index
```

**Maintenance**:
- Keep vendor API specs up-to-date
- Document API version changes
- Include code examples for each vendor

### archive/

**Purpose**: Historical documentation, deprecated guides, old deployment logs

**Organization**:
```
archive/
├── deployment-logs-<YYYY-MM>/  # Deployment history
├── <DEPRECATED_DOC>_<DATE>.md  # Archived with date suffix
└── README.md                    # Archive index
```

**Rule**: Archive docs older than 90 days or superseded by newer versions

### status/

**Purpose**: Live platform health reports

See `status/CLAUDE.md` for complete guidelines.

---

## Key Documentation Quick Links

### Most Important (Read First)

1. **[../CLAUDE.md](../CLAUDE.md)** - **ROOT** project instructions (start here!)
2. **[warp-services/ARCHITECTURE.md](warp-services/ARCHITECTURE.md)** - Complete system design
3. **[status/PLATFORM_STATUS_<latest>.md](status/)** - Current platform state
4. **[api/API_DESIGN_FOUNDATION.md](api/API_DESIGN_FOUNDATION.md)** - API endpoint catalog
5. **[integrations/NUMBER_PROCUREMENT_PLAN.md](integrations/NUMBER_PROCUREMENT_PLAN.md)** - DID management strategy

### Infrastructure

- **[deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md)** - How to deploy
- **[architecture/ARCHITECTURAL_DECISIONS.md](architecture/ARCHITECTURAL_DECISIONS.md)** - Why things are built this way
- **[security/SECRETS_MANAGEMENT_GUIDE.md](security/SECRETS_MANAGEMENT_GUIDE.md)** - Credential handling

### Services

- **[architecture/GO_SMPP_GATEWAY_ARCHITECTURE.md](architecture/GO_SMPP_GATEWAY_ARCHITECTURE.md)** - SMPP/SMS service
- **[warp-services/SIP_NETWORK_ARCHITECTURE.md](warp-services/SIP_NETWORK_ARCHITECTURE.md)** - Voice routing
- **[warp-services/BILLING_SYSTEM.md](warp-services/BILLING_SYSTEM.md)** - Billing architecture

### Integration

- **[integrations/INTEGRATION_MATRIX.md](integrations/INTEGRATION_MATRIX.md)** - All vendor integrations
- **[integrations/HUBSPOT_SYNC_STRATEGY.md](integrations/HUBSPOT_SYNC_STRATEGY.md)** - CRM sync design
- **[integrations/GANDI_API_SETUP.md](integrations/GANDI_API_SETUP.md)** - DNS automation

---

## Working with Documentation

### Before Starting Work

1. **Check status reports** (`status/PLATFORM_STATUS_<latest>.md`)
   - Understand current system state
   - Identify known issues
   - Review pending work

2. **Read relevant architecture docs**
   - Understand design patterns in use
   - Follow established conventions
   - Check for existing solutions

3. **Review API documentation**
   - Check if endpoints already exist
   - Understand authentication patterns
   - Follow naming conventions

### While Working

1. **Update in-progress docs** as you build
2. **Add code comments** referencing documentation
3. **Note decisions** that should be documented later
4. **Create TODO comments** for missing documentation

### After Completing Work

1. **Update architecture docs** if design changed
2. **Document new API endpoints** in relevant files
3. **Create/update status report** if deployed
4. **Update CLAUDE.md** (root) with new capabilities
5. **Archive superseded documentation**

---

## Documentation Standards

### File Naming

```
Format: <TOPIC>_<TYPE>.md

Examples:
  GOOD: API_DESIGN_FOUNDATION.md
  GOOD: SMPP_GATEWAY_ARCHITECTURE.md
  GOOD: HUBSPOT_SYNC_STRATEGY.md

  BAD: api.md (too vague)
  BAD: notes.md (not descriptive)
  BAD: temp_file_v2_final.md (versioning in filename)
```

### Document Headers

**Required**:
```markdown
# Document Title

**Version**: 1.0.0 (semantic versioning)
**Date**: YYYY-MM-DD (last update)
**Status**: Draft|Review|Approved|Deprecated|Archived
**Owner**: Team or person responsible

## Executive Summary
[2-3 paragraph overview]
```

**Optional**:
```markdown
**Related Docs**: [Link], [Link]
**Supersedes**: OLD_DOC.md
**Review Date**: YYYY-MM-DD (when to review again)
```

### Code Examples

Always include working examples:

```markdown
# Don't just describe - show!

## Good Example
\`\`\`bash
# Reserve a number from Teliport
curl -X POST https://soa-api.ringer.tel/api/v1/inventory/numbers/3035551234/reserve \
  -H "Authorization: Bearer rng_your_token" \
  -H "Content-Type: application/json" \
  -d '{"reservedBy":"WARP-customer-123"}'

# Expected response:
# {"success": true, "reservedUntil": "2025-10-27T12:15:00Z"}
\`\`\`

## Bad Example
Reserve a number using the API.
```

### Diagrams

Use ASCII art for architecture diagrams:

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────┐
│ API Gateway │
└──────┬──────┘
       │ SQL
       ↓
┌─────────────┐
│  Database   │
└─────────────┘
```

Tools:
- https://asciiflow.com/ - Draw ASCII diagrams
- https://www.planttext.com/ - Generate from PlantUML
- https://monodraw.helftone.com/ - Mac app for ASCII art

---

## Common Documentation Tasks

### Task 1: Document New API Endpoint

1. **Update** `api/API_DESIGN_FOUNDATION.md`:
   ```markdown
   ### POST /v1/numbers/search
   **Purpose**: Search available telephone numbers
   **Auth**: JWT required
   **Request**:
   \`\`\`json
   {
     "npa": "303",
     "quantity": 50
   }
   \`\`\`
   **Response**:
   \`\`\`json
   {
     "numbers": [...]
   }
   \`\`\`
   ```

2. **Update** OpenAPI spec (`../infrastructure/api-specs/openapi.yaml`)

3. **Update** `api/API_ENDPOINTS.md` quick reference

### Task 2: Document New Service

1. **Create** `<SERVICE>_ARCHITECTURE.md` in `warp-services/`
2. **Include**:
   - Purpose and overview
   - Architecture diagram
   - Technology stack
   - Configuration
   - Deployment instructions
   - API endpoints
   - Monitoring and metrics
   - Troubleshooting

3. **Update** `warp-services/ARCHITECTURE.md` with new service

4. **Update** `integrations/INTEGRATION_MATRIX.md` if service has external dependencies

### Task 3: Document Architectural Decision

1. **Create or update** `architecture/ARCHITECTURAL_DECISIONS.md`

2. **Follow ADR format**:
   ```markdown
   ## Decision: <Title>
   **Date**: YYYY-MM-DD
   **Status**: Proposed|Accepted|Deprecated

   ### Context
   [What problem are we solving?]

   ### Decision
   [What did we decide?]

   ### Consequences
   [What are the trade-offs?]

   ### Alternatives Considered
   [What else did we evaluate?]
   ```

### Task 4: Create Status Report

See `status/CLAUDE.md` for complete instructions.

Quick command:
```bash
# Generate status report
# (Use Claude Code with context from running system)
```

---

## Documentation Health Metrics

### Current State Assessment

Run these checks periodically:

```bash
# Check for broken links
find docs/ -name "*.md" -exec grep -l "docs/" {} \; | \
  xargs -I {} bash -c 'echo "Checking: {}"; grep -o "docs/[^)]*" {}'

# Find docs without version numbers
grep -L "Version:" docs/*.md

# Find stale docs (not updated in 90+ days)
find docs/ -name "*.md" -mtime +90

# Count total documentation
find docs/ -name "*.md" | wc -l
```

### Documentation Coverage

**Well-Documented** ✅:
- Architecture and design decisions
- API endpoints and development guides
- Deployment procedures
- External integrations (HubSpot, Gandi, Teliport)
- SMPP Gateway (comprehensive)
- Status reports

**Needs Improvement** ⚠️:
- Customer onboarding procedures
- Incident response runbooks
- Disaster recovery procedures
- Performance tuning guides
- Security audit procedures

**Missing** 🔴:
- SRE/on-call playbooks
- Capacity planning guides
- Cost optimization strategies
- Customer support knowledge base
- Training materials for new hires

---

## Notes for Claude Code

### When Reading Documentation

1. **Start with root CLAUDE.md** - It's the source of truth for current project state
2. **Check status reports** - Understand live system before making changes
3. **Read architecture docs** - Don't reinvent existing patterns
4. **Verify information** - Docs can be stale, check live system

### When Creating Documentation

1. **Don't create duplicates** - Search for existing docs first
2. **Use standard formats** - Follow templates above
3. **Include examples** - Working code, not just descriptions
4. **Cross-reference** - Link to related docs
5. **Version control** - Track changes in Document Control table

### When Updating Documentation

1. **Increment version** - Semantic versioning (major.minor.patch)
2. **Update date** - Last updated timestamp
3. **Document changes** - What changed and why
4. **Check references** - Update docs that link to this one
5. **Archive if major changes** - Keep old version for reference

### Documentation Priority

**High Priority** (always update):
- `../CLAUDE.md` - Root project instructions
- `status/PLATFORM_STATUS_<date>.md` - Current state
- `api/API_DESIGN_FOUNDATION.md` - API catalog
- `architecture/ARCHITECTURAL_DECISIONS.md` - Design decisions
- `security/AUTH_AND_PERMISSION_SYSTEM.md` - Auth documentation

**Medium Priority** (update when relevant):
- Service-specific architecture docs
- Integration guides
- Deployment procedures

**Low Priority** (update occasionally):
- Historical logs
- Archived documentation
- Third-party API docs (they version independently)

---

## Integration with Root CLAUDE.md

**Relationship**:
```
../CLAUDE.md (ROOT)
  ├─ Project overview and current status
  ├─ Essential commands for all services
  ├─ Quick troubleshooting guides
  └─ Points to docs/ for detailed information

docs/<specific>.md (DETAILED)
  ├─ Deep-dive technical documentation
  ├─ Architecture and design decisions
  ├─ API specifications
  └─ Comprehensive guides
```

**When to Update Root vs Docs**:

| Change | Update Root CLAUDE.md | Update docs/ |
|--------|----------------------|--------------|
| New service deployed | ✅ Yes (add to Essential Commands) | ✅ Yes (create architecture doc) |
| Service status changed | ✅ Yes (update Current Status) | ✅ Yes (create status report) |
| New API endpoint | Maybe (if critical) | ✅ Yes (api/API_DESIGN_FOUNDATION.md) |
| Bug fix | No | Maybe (if architectural) |
| Configuration change | ✅ Yes (if essential command) | ✅ Yes (service doc) |
| Documentation cleanup | No | ✅ Yes (archive old docs) |

---

## Maintenance Schedule

**Weekly**:
- [ ] Review and close stale issues
- [ ] Update status reports
- [ ] Check for broken links

**Monthly**:
- [ ] Review all architecture docs for accuracy
- [ ] Archive docs older than 90 days
- [ ] Update API documentation
- [ ] Review and update INTEGRATION_MATRIX.md

**Quarterly**:
- [ ] Comprehensive documentation audit
- [ ] Update all version numbers
- [ ] Reorganize if needed
- [ ] Create documentation health report

---

## Getting Help

**For documentation issues**:
1. Check `README.md` in relevant subdirectory
2. Search existing docs for similar content
3. Review archived docs for historical context
4. Ask in team chat with link to specific doc

**For Claude Code assistance**:
- Claude can read all documentation
- Claude can search across all files
- Claude can update documentation following these guidelines
- Claude should prioritize accuracy over completeness

---

**Last Updated**: 2025-10-27
**Next Review**: 2025-11-27
**Maintainer**: Platform Engineering Team
