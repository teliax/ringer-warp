# Documentation Hierarchy Guide

## Overview
This guide explains the relationship between key documentation files to prevent confusion during hive-mind execution.

## Document Purposes

### Strategic Documents (WHY)
Located in `/docs/` - Platform-wide decisions and rationale

1. **ARCHITECTURAL_DECISIONS.md**
   - Purpose: Captures WHY we made specific technology choices
   - Audience: All agents, especially for understanding constraints
   - Use: When you need to understand rationale or trade-offs

2. **DEVELOPMENT_ENVIRONMENT_DECISIONS.md**
   - Purpose: Explains framework and tooling choices
   - Audience: All development agents
   - Use: When setting up development environment

3. **HIVEMIND_ORCHESTRATION_GUIDE.md**
   - Purpose: Coordinates multi-agent execution
   - Audience: All agents
   - Use: For understanding your role and dependencies

### Implementation Documents (HOW)
Located in `/warp/docs/` - Technical specifications

1. **ARCHITECTURE.md**
   - Purpose: Technical blueprint for building the system
   - Audience: Agents 1-3 (Infrastructure, Services, Integrations)
   - Use: For exact specifications, configs, performance targets

2. **PRD.md**
   - Purpose: Business requirements and features
   - Audience: All agents
   - Use: For understanding WHAT to build

3. **BILLING_SYSTEM.md** / **BILLING_PRD.md**
   - Purpose: Detailed billing implementation
   - Audience: Agent 2 (Core Services)
   - Use: For building billing services

### API & Integration Documents
Located in various places

1. **openapi.yaml** (`/warp/api/`)
   - Purpose: API contract specification
   - Audience: Agents 2 and 4
   - Use: For implementing and consuming APIs

2. **FRONTEND_API_MAPPING.md** (`/docs/`)
   - Purpose: Maps UI to API endpoints
   - Audience: Agent 4 (Frontend)
   - Use: For connecting frontend to backend

3. **API_CLIENT_SPECIFICATION.md** (`/docs/`)
   - Purpose: API client implementation guide
   - Audience: Agent 4 (Frontend)
   - Use: For building API clients

## Reading Order for Hive-Mind Agents

### Agent 1 (Infrastructure & Data)
1. ARCHITECTURAL_DECISIONS.md (understand choices)
2. ARCHITECTURE.md (get specifications)
3. Database schema files
4. Terraform modules

### Agent 2 (Core Services)
1. PRD.md (understand requirements)
2. ARCHITECTURAL_DECISIONS.md (understand constraints)
3. openapi.yaml (implement endpoints)
4. ARCHITECTURE.md (performance targets)

### Agent 3 (Integrations)
1. EXTERNAL_DEPENDENCIES.md (understand integrations)
2. SMS_ARCHITECTURE.md (messaging implementation)
3. INTEGRATION_MATRIX.md (integration overview)
4. External API docs in `/docs/api_docs/`

### Agent 4 (Frontend & Admin)
1. PRD.md (UI requirements)
2. FRONTEND_API_MAPPING.md (UI to API mapping)
3. API_CLIENT_SPECIFICATION.md (implementation guide)
4. openapi.yaml (API contracts)

## Key Relationships

```
PRD.md (WHAT to build)
    ↓
ARCHITECTURAL_DECISIONS.md (WHY these choices)
    ↓
ARCHITECTURE.md (HOW to build)
    ↓
openapi.yaml (API contracts)
    ↓
FRONTEND_API_MAPPING.md (UI integration)
```

## Conflict Resolution

If documents conflict:
1. **Business Requirements**: PRD.md is authoritative
2. **Technology Choices**: ARCHITECTURAL_DECISIONS.md is authoritative
3. **Implementation Details**: ARCHITECTURE.md is authoritative
4. **API Contracts**: openapi.yaml is authoritative

## Document Maintenance

- **ARCHITECTURAL_DECISIONS.md**: Update when making new technology choices
- **ARCHITECTURE.md**: Update when implementation details change
- **PRD.md**: Update when business requirements change
- **openapi.yaml**: Update when API contracts change
- All updates should maintain consistency across related documents
