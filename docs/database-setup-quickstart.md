# WARP Database Setup - Quick Reference

## Quick Setup Commands

```bash
# 1. Set environment variables
export CLOUDSQL_CONNECTION_NAME="ringer-warp-v01:us-central1:warp-postgres"
export DB_PASSWORD="your-secure-password"

# 2. Navigate to setup directory
cd /home/daldworth/repos/ringer-warp/warp/database/setup

# 3. Run the master setup script
./00-master-setup.sh
```

## Manual Steps (if script fails)

```bash
# Start Cloud SQL Proxy
cloud_sql_proxy -instances=$CLOUDSQL_CONNECTION_NAME=tcp:5432 &
sleep 5

# Create database and user
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d postgres <<EOF
CREATE DATABASE warp;
CREATE USER warp_app WITH PASSWORD '$DB_PASSWORD';
EOF

# Run schema files in order
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d warp \
  -f ../schemas/postgresql-schema.sql

PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d warp \
  -f 01-create-sms-schema.sql

PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d warp \
  -f 02-create-provider-schema.sql

PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d warp \
  -f 04-create-indexes.sql

PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d warp \
  -f 05-initial-data.sql

# Run BigQuery setup
./03-create-bigquery-datasets.sh

# Stop proxy when done
pkill cloud_sql_proxy
```

## Verification Commands

```bash
# Test database connection
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -p 5432 -U warp_app -d warp -c "\dn"

# Check BigQuery datasets
bq ls --project_id=ringer-warp-v01

# View connection info
cat connection-info.json
```

## Connection Strings

### Local Development (via Cloud SQL Proxy)
```
postgresql://warp_app:${DB_PASSWORD}@localhost:5432/warp?sslmode=require
```

### From GKE/Cloud Run
```
postgresql://warp_app:${DB_PASSWORD}@/warp?host=/cloudsql/${CLOUDSQL_CONNECTION_NAME}&sslmode=disable
```

### JDBC URL
```
jdbc:postgresql://localhost:5432/warp?user=warp_app&password=${DB_PASSWORD}&sslMode=require
```

## Key Information

- **Project ID**: ringer-warp-v01
- **Database Name**: warp
- **App Username**: warp_app
- **Cloud SQL Instance**: warp-postgres (us-central1)
- **BigQuery Service Account**: warp-bq-streamer@ringer-warp-v01.iam.gserviceaccount.com

## Troubleshooting

```bash
# Check if proxy is running
ps aux | grep cloud_sql_proxy

# Kill existing proxy
pkill cloud_sql_proxy

# Check port 5432
lsof -i :5432

# View Cloud SQL logs
gcloud sql operations list --instance=warp-postgres --project=ringer-warp-v01
```