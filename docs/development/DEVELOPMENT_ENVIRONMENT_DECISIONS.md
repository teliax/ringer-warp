# Development Environment Decisions

## 1. Infrastructure Decisions ✅

### Database Architecture
**Decision**: All databases hosted in GCP Project "Ringer" (project-id: `ringer-warp-v01`)

#### Database Usage by Service:
1. **Cloud SQL (PostgreSQL)** - Primary Relational Database
   - Customer accounts, profiles, billing
   - SIP trunk configurations
   - Rate tables and routing rules
   - Authentication/authorization data
   - Invoice and transaction records
   - Audit logs

2. **BigQuery** - Analytics and CDR/MDR Storage
   - Call Detail Records (CDRs) - 7 year retention
   - Message Detail Records (MDRs)
   - Analytics and reporting
   - Real-time streaming via Pub/Sub
   - Partitioned by date for cost optimization

3. **Memorystore (Redis)** - Caching and Real-time State
   - Session management
   - Rate limiting counters
   - LRN/LERG cache (1-hour TTL)
   - Active call state
   - API response caching
   - Pub/Sub for real-time events

4. **Firestore** (Optional) - Document Store
   - User preferences
   - Feature flags
   - Configuration management

**Note**: CockroachDB mentioned in PRD for "global scale" can be reconsidered later. Starting with Cloud SQL is the right approach for MVP.

### Package Manager
**Decision**: `npm` ✅

### API Framework Recommendation
**Recommendation**: **NestJS**

#### Why NestJS?
1. **Most Robust** for enterprise applications
2. **Built-in structure** - Enforces best practices
3. **Dependency Injection** - Critical for testing and modularity
4. **TypeScript-first** - Type safety across large codebase
5. **Microservices ready** - Built-in support for microservices architecture
6. **Extensive decorators** - For validation, authentication, rate limiting
7. **Integration friendly** - Works well with TypeORM, Prisma, GraphQL
8. **Production proven** - Used by enterprise companies

#### Comparison:
| Feature | Express | Fastify | NestJS |
|---------|---------|---------|--------|
| Performance | Good | Excellent | Good |
| Structure | Minimal | Minimal | Opinionated |
| TypeScript | Add-on | Add-on | Native |
| Learning Curve | Low | Medium | High |
| Enterprise Ready | Manual setup | Manual setup | Built-in |
| Microservices | Manual | Manual | Built-in |
| Testing | Manual | Manual | Built-in |

### ORM Recommendation
**Recommendation**: **Prisma**

#### Why Prisma?
1. **Type-safe queries** - Auto-generated TypeScript types
2. **Modern approach** - Declarative schema definition
3. **Migration system** - Excellent migration tools
4. **Multi-database** - Supports PostgreSQL, MySQL, SQLite
5. **Performance** - Efficient query generation
6. **Developer experience** - Best-in-class DX

#### ORM Implications:

**Prisma Pros**:
- Schema-first approach (schema.prisma file)
- Auto-completion in IDEs
- Type-safe database queries
- Built-in migration system
- Great for new projects

**Prisma Cons**:
- Less flexible for complex raw queries
- Schema changes require regeneration
- Learning curve for Prisma-specific syntax

**TypeORM Alternative** (if complex queries needed):
- More traditional ORM approach
- Better for complex queries
- Entity-first approach
- More flexibility but less type safety

## 2. Database Schemas

### PostgreSQL (Cloud SQL) Schema Structure

```sql
-- Core domains for PostgreSQL:
├── auth/           # Authentication & authorization
├── accounts/       # Customer accounts & profiles
├── billing/        # Invoices, payments, transactions
├── trunks/         # SIP trunk configurations
├── numbers/        # DID inventory & management
├── routing/        # LCR tables, rate tables
├── audit/          # Audit logs, compliance
```

### Initial Test Data Requirements

```yaml
Test Data Set:
  Customers: 10
    - 5 Active (various credit levels)
    - 3 Suspended (payment issues)
    - 2 Testing (internal use)

  Trunks per Customer: 2-5
    - Mix of inbound/outbound
    - Various zones (INTERSTATE, LOCAL, INTL)

  DIDs per Customer: 10-50
    - Mix of local, toll-free
    - Various states/regions

  Rate Tables:
    - Standard US Interstate/Intrastate
    - International zones (5 countries)
    - Toll-free origination

  CDR Records: 10,000
    - Various call scenarios
    - Success/failure cases
    - Different durations
```

## 3. Docker Architecture

### Microservices Approach
You're correct - one docker-compose.yml won't suffice. Recommended structure:

```
/docker/
├── docker-compose.core.yml      # Core services (DB, Redis, Kafka)
├── docker-compose.telecom.yml   # Kamailio, RTPEngine, Homer
├── docker-compose.api.yml       # API services
├── docker-compose.workers.yml   # Background workers
├── docker-compose.monitoring.yml # Prometheus, Grafana
└── docker-compose.dev.yml       # Full stack for development
```

### Service Separation:
1. **Core Infrastructure** (Always running)
   - PostgreSQL (for local dev only)
   - Redis
   - Consul (service discovery)

2. **Telecom Stack** (Domain-specific)
   - Kamailio
   - RTPEngine
   - Homer

3. **API Services** (Microservices)
   - Auth Service
   - Billing Service
   - Trunk Management Service
   - CDR Processing Service

4. **Workers** (Background jobs)
   - Invoice Generator
   - CDR Processor
   - LRN Cache Updater
   - Email Sender

## 4. Makefile Commands

```makefile
# Development commands
.PHONY: setup dev test clean

setup:           ## Initial setup
	npm install
	cp .env.example .env.development
	docker-compose -f docker/docker-compose.core.yml up -d
	npm run db:migrate
	npm run db:seed

dev:            ## Start development environment
	docker-compose -f docker/docker-compose.dev.yml up -d
	npm run dev

test:           ## Run tests
	npm test

migrate:        ## Run database migrations
	npm run db:migrate

seed:           ## Seed test data
	npm run db:seed

clean:          ## Clean up
	docker-compose down -v
	rm -rf node_modules
	rm -rf dist

# GCP commands
gcp-auth:       ## Authenticate with GCP
	gcloud auth login
	gcloud config set project ringer-warp-v01

gcp-deploy-dev: ## Deploy to GCP development
	gcloud app deploy --project=ringer-warp-v01 --version=dev

# Database commands
db-proxy:       ## Start Cloud SQL proxy
	cloud_sql_proxy -instances=ringer-warp-v01:us-central1:ringer-db=tcp:5432

db-backup:      ## Backup database
	gcloud sql backups create --instance=ringer-db

# Monitoring
logs:           ## Tail application logs
	npm run logs:tail

metrics:        ## Open Grafana dashboard
	open http://localhost:3000
```

## 5. Next Steps for Hive-Mind

With these decisions, the hive-mind agents can:

1. **Agent 1**: Set up NestJS project structure with Prisma
2. **Agent 2**: Create database schemas and migrations
3. **Agent 3**: Implement external service integrations
4. **Agent 4**: Build frontend components

## Framework Installation Commands

```bash
# NestJS with Prisma setup
npm i -g @nestjs/cli
nest new warp-api --package-manager npm
cd warp-api
npm install prisma @prisma/client
npm install @nestjs/config @nestjs/jwt @nestjs/passport
npx prisma init

# Configure for Google Cloud SQL
# Update DATABASE_URL in .env to use Cloud SQL proxy
DATABASE_URL="postgresql://user:password@localhost:5432/ringer_dev?schema=public"
```

## Summary of Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| GCP Project | ringer-warp-v01 | Provided |
| Databases | Cloud SQL, BigQuery, Redis | GCP-native, scalable |
| Package Manager | npm | Team preference |
| API Framework | NestJS | Most robust, enterprise-ready |
| ORM | Prisma | Type-safe, modern, good DX |
| Docker Strategy | Microservices | Modular, scalable |
| Test Data | Generated via seeds | Consistent, repeatable |