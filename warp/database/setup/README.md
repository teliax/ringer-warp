# WARP Database Setup

This directory contains robust database initialization scripts for the WARP platform PostgreSQL database.

## Quick Start

### Method 1: Kubernetes Deployment (Recommended)
```bash
# Deploy database initialization job to Kubernetes
./deploy.sh
```

### Method 2: Direct Execution with Docker
```bash
# Test connection first
./test-connection.sh

# Run initialization using bash script
docker run --rm -v $(pwd)/../schema:/schema \
  -e PGHOST=10.126.0.3 \
  -e PGPORT=5432 \
  -e PGDATABASE=warp \
  -e PGUSER=warp \
  -e PGPASSWORD=')T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}' \
  postgres:15-alpine \
  /schema/../setup/init-database.sh
```

### Method 3: Python Script (Local)
```bash
# Install dependencies
pip install psycopg2-binary

# Run initialization
./init-database.py --host 10.126.0.3
```

## Files Overview

### Core Scripts
- `deploy.sh` - Main deployment script for Kubernetes
- `init-database.sh` - Bash-based initialization script
- `init-database.py` - Python-based initialization with enhanced error handling
- `test-connection.sh` - Test database connectivity

### Kubernetes Resources
- `k8s-init-job.yaml` - Kubernetes Job specification with embedded scripts
- `create-configmap.sh` - Create ConfigMap from schema files

## Database Configuration

| Parameter | Value |
|-----------|-------|
| Host | 10.126.0.3 |
| Port | 5432 |
| Database | warp |
| User | warp |
| Password | )T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:} |

## Features

### Robust Error Handling
- Connection retry logic (up to 30 attempts)
- Transaction-based execution for atomicity
- Detailed error reporting
- Network connectivity validation

### Safety Features
- Checks for existing schemas before initialization
- Interactive confirmation for re-initialization
- Preserves existing data by default
- Comprehensive validation after completion

### Kubernetes Integration
- Init containers ensure database readiness
- ConfigMap-based schema management
- Secret-based credential handling
- Job TTL for automatic cleanup

## Schema Files

The initialization process executes SQL files in the following order:
1. `00_extensions.sql` - PostgreSQL extensions
2. `01_accounts.sql` - Account management schema
3. `02_auth.sql` - Authentication schema
4. `03_numbers.sql` - Phone number management
5. `04_routing.sql` - Call routing rules
6. `05_cdr.sql` - Call detail records
7. `06_messaging.sql` - SMS/MMS schema
8. `07_billing.sql` - Billing and rating
9. `08_vendor_mgmt.sql` - Vendor management
10. `09_audit.sql` - Audit logging
11. `10_indexes_performance.sql` - Performance indexes
12. `11_seed_data.sql` - Initial data

## Troubleshooting

### Connection Issues
```bash
# Test basic connectivity
./test-connection.sh

# Check with kubectl
kubectl run db-test --image=postgres:15-alpine --rm -it --restart=Never -- \
  pg_isready -h 10.126.0.3 -p 5432
```

### View Kubernetes Logs
```bash
# View initialization logs
kubectl logs -n warp-core job/warp-db-init

# Watch logs in real-time
kubectl logs -f -n warp-core job/warp-db-init
```

### Manual Cleanup
```bash
# Delete failed job
kubectl delete job warp-db-init -n warp-core

# Delete all resources
kubectl delete -f k8s-init-job.yaml
```

### Direct Database Access
```bash
# Using Docker
docker run -it --rm postgres:15-alpine \
  psql postgresql://warp:)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}@10.126.0.3:5432/warp

# Using kubectl
kubectl run psql --image=postgres:15-alpine --rm -it --restart=Never -- \
  psql postgresql://warp:)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}@10.126.0.3:5432/warp
```

## Verification

After successful initialization, the database should contain:
- 9 custom schemas (accounts, auth, billing, etc.)
- ~50+ tables across all schemas
- Required PostgreSQL extensions (uuid-ossp, pg_trgm, etc.)
- Initial seed data for lookups

### Verify Installation
```bash
# Check schemas
docker run --rm postgres:15-alpine \
  psql postgresql://warp:)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}@10.126.0.3:5432/warp \
  -c "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' ORDER BY nspname;"

# Check table counts
docker run --rm postgres:15-alpine \
  psql postgresql://warp:)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}@10.126.0.3:5432/warp \
  -c "SELECT table_schema, COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') GROUP BY table_schema ORDER BY table_schema;"
```

## Security Notes

- Database credentials are stored in Kubernetes secrets
- Use environment variables to override default credentials
- Consider using sealed secrets or external secret management in production
- Network policies should restrict database access to authorized pods only

## Maintenance

### Re-initialization
```bash
# Force re-initialization (DROPS ALL DATA!)
./init-database.py --force

# Or with Kubernetes (will prompt for confirmation)
./deploy.sh
```

### Backup Before Changes
```bash
# Create backup
kubectl exec -n warp-core deployment/postgres -- \
  pg_dump -U warp warp > warp_backup_$(date +%Y%m%d_%H%M%S).sql
```

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify network connectivity to the database host
3. Ensure Kubernetes cluster access is configured correctly
4. Validate schema files are present and readable