# WARP Platform Database

This directory contains the PostgreSQL database schema and setup scripts for the WARP wholesale telecom platform.

## Directory Structure

```
database/
├── schema/                     # SQL schema files
│   ├── 00_extensions.sql      # PostgreSQL extensions
│   ├── 01_accounts.sql        # Customer accounts
│   ├── 02_auth.sql            # Authentication
│   ├── 03_numbers.sql         # Phone numbers
│   ├── 04_routing.sql         # SIP routing
│   ├── 05_cdr.sql             # Call records
│   ├── 06_messaging.sql       # SMS/MMS
│   ├── 07_billing.sql         # Billing/rating
│   ├── 08_vendor_mgmt.sql     # Vendor management
│   ├── 09_audit.sql           # Audit/compliance
│   ├── 10_indexes_performance.sql # Performance
│   └── 11_seed_data.sql       # Test data
├── setup/                      # Setup scripts
│   ├── init-database.sh       # Initialization script
│   └── Dockerfile             # Container image
└── DATABASE_ERD.md            # Entity relationship docs
```

## Quick Start

### Option 1: Direct Execution

```bash
# Set environment variables
export DB_HOST=34.42.208.57
export DB_PORT=5432
export DB_NAME=warp
export DB_USER=warp
export DB_PASSWORD=<get-from-secret-manager>

# Run initialization
cd warp/database/setup
./init-database.sh
```

### Option 2: Using Docker

```bash
# Build the init container
cd warp/database
docker build -f setup/Dockerfile -t warp-db-init .

# Run initialization
docker run \
  -e DB_HOST=34.42.208.57 \
  -e DB_PASSWORD=<password> \
  -e LOAD_SEED_DATA=true \
  warp-db-init
```

### Option 3: Kubernetes Job

```bash
# Create the secret first
kubectl create secret generic cloudsql-warp-password \
  --from-literal=password=<password> \
  -n warp

# Run the job
kubectl apply -f kubernetes/jobs/database-init-job.yaml
```

## Schema Overview

The database is organized into 9 logical schemas:

- **accounts** - Customer account management
- **auth** - Users, API keys, permissions
- **numbers** - DID inventory and management
- **routing** - SIP trunks and carrier routing
- **cdr** - Call Detail Records
- **messaging** - SMS/MMS records and campaigns
- **billing** - Rating, invoicing, payments
- **vendor_mgmt** - Third-party service providers
- **audit** - Compliance and audit trails

## Key Features

### Security
- Row-level security via account_id
- Encrypted password storage
- API key hashing
- IP ACL for SIP trunks
- Audit trails for all changes

### Performance
- Monthly partitioning for CDR tables
- Materialized views for reporting
- Extensive indexing
- Query optimization functions

### Compliance
- STIR/SHAKEN certificate tracking
- E911 address validation
- 10DLC campaign management
- Data retention policies
- Comprehensive audit logging

### Multi-Tenancy
- Account-based data isolation
- Routing partition support
- Per-customer rate plans
- Feature flags

## Common Operations

### Check Database Status
```sql
-- Check schema creation
SELECT schemaname, COUNT(*) 
FROM pg_tables 
WHERE schemaname IN ('accounts','auth','billing','cdr','messaging','numbers','routing','vendor_mgmt','audit')
GROUP BY schemaname;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Create Monthly CDR Partitions
```sql
-- Run monthly to create next month's partition
SELECT cdr.create_monthly_partition();
```

### Refresh Materialized Views
```sql
-- Refresh reporting views
SELECT reporting.refresh_hourly_traffic();
SELECT reporting.refresh_daily_summary();
SELECT reporting.refresh_carrier_performance();
```

### Check Compliance
```sql
-- E911 compliance check for an account
SELECT audit.check_e911_compliance('account-uuid-here');
```

## Environment Variables

- `DB_HOST` - PostgreSQL host (default: 34.42.208.57)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: warp)
- `DB_USER` - Database user (default: warp)
- `DB_PASSWORD` - Database password (required)
- `LOAD_SEED_DATA` - Load test data (default: false)

## Backup and Recovery

### Backup
```bash
# Full backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F custom -f warp_backup_$(date +%Y%m%d).dump

# Schema only
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --schema-only -f warp_schema.sql
```

### Restore
```bash
# Restore from custom format
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c warp_backup_20250122.dump
```

## Monitoring

Key metrics to monitor:
- Connection count
- Long-running queries
- Table bloat
- Index usage
- Replication lag (if using replicas)

## Troubleshooting

### Connection Issues
```bash
# Test connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"

# Check Cloud SQL proxy
kubectl logs -n warp deployment/cloudsql-proxy
```

### Performance Issues
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT * FROM debug.find_missing_indexes();
```

### Lock Issues
```sql
-- View current locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Kill blocking query
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid = <blocking_pid>;
```

## Development Guidelines

1. **Schema Changes**: Always add, never modify/delete in production
2. **Migrations**: Use numbered migration files
3. **Testing**: Test all schema changes in dev first
4. **Documentation**: Update ERD for schema changes
5. **Performance**: Add indexes for new foreign keys

## Support

For database issues:
1. Check logs in Cloud SQL console
2. Review slow query log
3. Contact platform team

## Related Documentation

- [DATABASE_ERD.md](DATABASE_ERD.md) - Entity relationship diagram
- [ARCHITECTURAL_DECISIONS.md](../../docs/ARCHITECTURAL_DECISIONS.md) - Architecture overview
- [BILLING_PRD.md](../docs/BILLING_PRD.md) - Billing requirements