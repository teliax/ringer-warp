# Database Deployment Checklist for WARP Platform

## Project: ringer-warp-v01
## Instance: warp-db (Cloud SQL PostgreSQL 15)

## Pre-Deployment Requirements

### 1. Environment Variables
- [ ] Set `CLOUDSQL_CONNECTION_NAME` to `ringer-warp-v01:us-central1:warp-db`
- [ ] Set `DB_PASSWORD` for the `warp_app` database user

### 2. Cloud SQL Setup
- [ ] Verify Cloud SQL instance `warp-db` is created in project `ringer-warp-v01`
- [ ] Ensure instance is running PostgreSQL 15
- [ ] Verify instance is in `us-central1` region
- [ ] Enable Cloud SQL API if not already enabled
- [ ] Configure SSL/TLS for secure connections

### 3. Service Accounts
- [ ] Create service account `warp-bq-streamer@ringer-warp-v01.iam.gserviceaccount.com`
- [ ] Grant BigQuery Data Editor role to the service account
- [ ] Generate and securely store service account key

### 4. BigQuery Setup
- [ ] Enable BigQuery API in project `ringer-warp-v01`
- [ ] Ensure BigQuery datasets will be created in `us-central1`

## Deployment Steps

### 1. Cloud SQL Proxy Setup
```bash
# Install Cloud SQL Proxy if not already installed
gcloud components install cloud_sql_proxy

# Start proxy (will be done automatically by script)
cloud_sql_proxy -instances=ringer-warp-v01:us-central1:warp-db=tcp:5432
```

### 2. Run Master Setup Script
```bash
# Navigate to setup directory
cd /home/daldworth/repos/ringer-warp/warp/database/setup

# Set required environment variables
export CLOUDSQL_CONNECTION_NAME="ringer-warp-v01:us-central1:warp-db"
export DB_PASSWORD="your-secure-password-here"

# Run the master setup script
./00-master-setup.sh
```

### 3. Script Execution Order
The master script will execute the following in order:
1. **PostgreSQL Schema Creation** (`../schemas/postgresql-schema.sql`)
   - Creates extensions: uuid-ossp, pgcrypto, pg_trgm, btree_gin
   - Creates schemas: auth, accounts, billing, trunks, numbers, routing, audit, sms, providers

2. **SMS Schema** (`01-create-sms-schema.sql`)
   - Creates SMS-related tables
   - Sets up Jasmin configurations
   - Creates campaign management tables

3. **Provider Schema** (`02-create-provider-schema.sql`)
   - Creates provider configuration tables
   - Sets up NetSuite integration tables
   - Creates toll-free management tables

4. **BigQuery Datasets** (`03-create-bigquery-datasets.sh`)
   - Creates `warp_cdr` dataset (90-day retention)
   - Creates `warp_mdr` dataset (90-day retention)
   - Creates `warp_analytics` dataset (no expiration)
   - Sets up initial tables and views

5. **Performance Indexes** (`04-create-indexes.sql`)
   - Creates indexes for all major query patterns
   - Sets up composite indexes for performance

6. **Initial Data** (`05-initial-data.sql`)
   - Loads default providers
   - Sets up initial rate plans
   - Configures tax rates
   - Creates system settings

## Post-Deployment Verification

### 1. Database Connectivity
- [ ] Test connection to database using Cloud SQL Proxy
- [ ] Verify `warp_app` user can connect with provided password
- [ ] Test SSL/TLS connection is enforced

### 2. Schema Verification
```sql
-- List all schemas
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema');

-- Verify tables were created
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('auth', 'accounts', 'billing', 'trunks', 'numbers', 'routing', 'audit', 'sms', 'providers')
ORDER BY table_schema, table_name;
```

### 3. BigQuery Verification
```bash
# List datasets
bq ls --project_id=ringer-warp-v01

# Verify tables
bq ls ringer-warp-v01:warp_cdr
bq ls ringer-warp-v01:warp_mdr
bq ls ringer-warp-v01:warp_analytics
```

### 4. Application Integration
- [ ] Update application configuration with new connection string
- [ ] Test application connectivity to database
- [ ] Verify BigQuery streaming service account is configured
- [ ] Test sample API calls to ensure database operations work

## Connection Information
- **Cloud SQL Instance**: `ringer-warp-v01:us-central1:warp-db`
- **Database Name**: `warp`
- **Application User**: `warp_app`
- **Connection String**: `postgresql://warp_app:${DB_PASSWORD}@localhost:5432/warp?sslmode=require`
- **BigQuery Project**: `ringer-warp-v01`
- **BigQuery Datasets**: `warp_cdr`, `warp_mdr`, `warp_analytics`

## Security Checklist
- [ ] Ensure `DB_PASSWORD` is strong and stored securely
- [ ] Verify Cloud SQL instance has private IP only (if applicable)
- [ ] Confirm SSL/TLS is required for all connections
- [ ] Review and restrict database user permissions as needed
- [ ] Secure BigQuery service account key
- [ ] Enable audit logging on Cloud SQL instance

## Troubleshooting

### Common Issues
1. **Cloud SQL Proxy Connection Failed**
   - Verify `gcloud` authentication: `gcloud auth list`
   - Check project permissions: `gcloud projects get-iam-policy ringer-warp-v01`
   - Ensure Cloud SQL API is enabled

2. **Permission Denied Errors**
   - Verify service account has correct IAM roles
   - Check database user permissions
   - Ensure all GRANT statements were executed

3. **BigQuery Dataset Creation Failed**
   - Verify BigQuery API is enabled
   - Check service account has BigQuery Data Editor role
   - Ensure location matches (us-central1)

## Rollback Plan
If issues occur during deployment:
1. Stop the deployment script immediately
2. Drop the database if partially created: `DROP DATABASE warp;`
3. Delete BigQuery datasets if created
4. Review error logs and fix issues
5. Re-run deployment after fixes

## Sign-off
- [ ] Database Administrator Review
- [ ] Security Review
- [ ] Application Team Verification
- [ ] Production Readiness Confirmed