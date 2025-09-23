# WARP Database Setup Guide

## Overview
This guide documents the complete process for setting up the WARP platform database on Google Cloud SQL (PostgreSQL 15) for project `ringer-warp-v01`.

## Prerequisites

### 1. Environment Requirements
- **Google Cloud CLI** (`gcloud`) installed and authenticated
- **Cloud SQL Proxy** installed
- **PostgreSQL client** (`psql`) version 15 or compatible
- **BigQuery CLI** (`bq`) installed
- **Bash** shell environment

### 2. Required Environment Variables
```bash
# Cloud SQL Connection (REQUIRED)
export CLOUDSQL_CONNECTION_NAME="ringer-warp-v01:us-central1:warp-postgres"

# Database Password (REQUIRED)
export DB_PASSWORD="your-secure-password-here"
```

### 3. Required Permissions
- Cloud SQL Client
- Cloud SQL Admin (for database creation)
- BigQuery Admin (for dataset creation)
- Service Account Admin (for creating BigQuery service account)

## Database Architecture

### PostgreSQL Schemas
1. **auth** - Authentication & authorization
2. **accounts** - Customer management
3. **billing** - CDR, MDR, invoicing, payments
4. **trunks** - SIP trunk configuration
5. **numbers** - DID inventory and porting
6. **routing** - LCR and rate management
7. **audit** - Change tracking
8. **sms** - Messaging, campaigns, 10DLC
9. **providers** - Third-party integrations

### BigQuery Datasets
1. **warp_cdr** - Call Detail Records (90-day retention)
2. **warp_mdr** - Message Detail Records (90-day retention)
3. **warp_analytics** - Aggregated analytics (no expiration)

## Setup Process

### Step 1: Verify Cloud SQL Instance
```bash
# Check if Cloud SQL instance exists
gcloud sql instances describe warp-postgres \
    --project=ringer-warp-v01 \
    --region=us-central1
```

### Step 2: Set Environment Variables
```bash
# Set required variables
export CLOUDSQL_CONNECTION_NAME="ringer-warp-v01:us-central1:warp-postgres"
export DB_PASSWORD="your-secure-password"  # Use a strong password

# Verify variables are set
echo "Connection: $CLOUDSQL_CONNECTION_NAME"
echo "Password is set: $([ -n "$DB_PASSWORD" ] && echo "Yes" || echo "No")"
```

### Step 3: Run the Master Setup Script
```bash
# Navigate to setup directory
cd /home/daldworth/repos/ringer-warp/warp/database/setup

# Make script executable
chmod +x 00-master-setup.sh

# Run the setup
./00-master-setup.sh
```

### Step 4: What the Script Does

1. **Starts Cloud SQL Proxy**
   - Connects to `$CLOUDSQL_CONNECTION_NAME` on local port 5432
   - Enables secure connection to Cloud SQL

2. **Creates Database**
   - Database name: `warp`
   - Creates if not exists

3. **Creates Application User**
   - Username: `warp_app`
   - Password: Value from `$DB_PASSWORD`

4. **Executes Schema Scripts** (in order):
   - `postgresql-schema.sql` - Core database schema
   - `01-create-sms-schema.sql` - SMS/MMS schema
   - `02-create-provider-schema.sql` - Provider integrations
   - `04-create-indexes.sql` - Performance indexes
   - `05-initial-data.sql` - Default data

5. **Creates BigQuery Resources**
   - Runs `03-create-bigquery-datasets.sh`
   - Creates datasets: warp_cdr, warp_mdr, warp_analytics
   - Creates tables with appropriate schemas
   - Creates service account: `warp-bq-streamer@ringer-warp-v01.iam.gserviceaccount.com`

6. **Grants Permissions**
   - All necessary permissions for `warp_app` user
   - Read/write on all application schemas

7. **Saves Connection Info**
   - Creates `connection-info.json` with all connection details

### Step 5: Manual Cloud SQL Proxy (if needed)
If the script fails to start the proxy automatically:

```bash
# Start Cloud SQL Proxy manually
cloud_sql_proxy -instances=$CLOUDSQL_CONNECTION_NAME=tcp:5432 &

# Wait for it to initialize
sleep 5

# Test connection
PGPASSWORD=$DB_PASSWORD psql \
    -h 127.0.0.1 \
    -p 5432 \
    -U postgres \
    -d postgres \
    -c "SELECT version();"
```

### Step 6: Verify Installation
```bash
# Connect to the database
PGPASSWORD=$DB_PASSWORD psql \
    -h 127.0.0.1 \
    -p 5432 \
    -U postgres \
    -d warp

# Check schemas
\dn

# Expected output:
# auth
# accounts
# billing
# trunks
# numbers
# routing
# audit
# sms
# providers

# Check tables in a schema
\dt sms.*

# Check BigQuery datasets
bq ls --project_id=ringer-warp-v01
```

### Step 7: Save Service Account Key
```bash
# Create service account key for BigQuery streaming
gcloud iam service-accounts keys create \
    ~/warp-bq-streamer-key.json \
    --iam-account=warp-bq-streamer@ringer-warp-v01.iam.gserviceaccount.com \
    --project=ringer-warp-v01

# Store securely and configure in application
```

## Post-Setup Configuration

### 1. Application Configuration
Update your application configuration with:
- PostgreSQL connection string
- BigQuery service account credentials
- Database credentials

### 2. Connection String Format
```
postgresql://warp_app:${DB_PASSWORD}@localhost:5432/warp?sslmode=require
```

When using Cloud SQL from GKE, use:
```
postgresql://warp_app:${DB_PASSWORD}@/warp?host=/cloudsql/${CLOUDSQL_CONNECTION_NAME}&sslmode=disable
```

### 3. Test Application Connectivity
```go
// Example Go connection
import (
    "database/sql"
    _ "github.com/lib/pq"
)

db, err := sql.Open("postgres", 
    "user=warp_app password=YOUR_PASSWORD dbname=warp sslmode=require")
```

## Troubleshooting

### Common Issues

1. **Cloud SQL Proxy fails to start**
   - Check if port 5432 is already in use: `lsof -i :5432`
   - Kill existing processes: `pkill cloud_sql_proxy`

2. **Permission denied errors**
   - Ensure your gcloud account has Cloud SQL Client role
   - Run: `gcloud auth application-default login`

3. **Database already exists**
   - This is normal; the script handles existing databases

4. **BigQuery dataset creation fails**
   - Check BigQuery API is enabled
   - Verify project permissions

### Rollback Procedure
If setup fails and you need to start over:

```bash
# Connect to postgres database
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d postgres

# Drop the warp database (CAUTION!)
DROP DATABASE IF EXISTS warp;

# Drop the user
DROP USER IF EXISTS warp_app;

# Delete BigQuery datasets
bq rm -f -r ringer-warp-v01:warp_cdr
bq rm -f -r ringer-warp-v01:warp_mdr
bq rm -f -r ringer-warp-v01:warp_analytics
```

## Security Considerations

1. **Password Management**
   - Never commit passwords to version control
   - Use Google Secret Manager for production
   - Rotate passwords regularly

2. **Network Security**
   - Cloud SQL Proxy provides encrypted connection
   - No direct internet exposure of database

3. **Access Control**
   - Application uses dedicated `warp_app` user
   - Limited permissions per schema
   - Audit logging enabled

## Maintenance

### Regular Tasks
1. **Monitor disk usage** - Cloud SQL instance storage
2. **Check slow queries** - Use pg_stat_statements
3. **Update statistics** - Run ANALYZE weekly
4. **Review audit logs** - Check audit.audit_log table

### Backup Strategy
Cloud SQL automated backups are configured for:
- Daily backups retained for 7 days
- Point-in-time recovery enabled
- Transaction logs retained

## Next Steps

After successful database setup:

1. Configure application database connections
2. Set up BigQuery streaming service
3. Configure monitoring and alerting
4. Run application migrations (if any)
5. Test end-to-end connectivity
6. Set up regular maintenance jobs

## Support

For issues or questions:
- Check Cloud SQL logs in GCP Console
- Review PostgreSQL logs
- Contact the platform team

---

Last updated: 2025-09-21