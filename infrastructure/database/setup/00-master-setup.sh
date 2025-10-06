#!/bin/bash

# WARP Platform Database Setup Master Script
# Project: ringer-warp-v01
# This script orchestrates the complete database setup

set -e  # Exit on error

echo "=========================================="
echo "WARP Platform Database Setup"
echo "Project: ringer-warp-v01"
echo "=========================================="

# Check if required environment variables are set
if [ -z "$CLOUDSQL_CONNECTION_NAME" ]; then
    echo "❌ Error: CLOUDSQL_CONNECTION_NAME environment variable not set"
    echo "   Example: export CLOUDSQL_CONNECTION_NAME=ringer-warp-v01:us-central1:warp-db"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: DB_PASSWORD environment variable not set"
    echo "   Set the password for the warp_app database user"
    exit 1
fi

# Configuration
DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_NAME="warp"
DB_ADMIN_USER="postgres"
DB_APP_USER="warp_app"

echo -e "\nDatabase Configuration:"
echo "  Host: $DB_HOST (via Cloud SQL Proxy)"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  App User: $DB_APP_USER"

# Function to execute SQL file
execute_sql() {
    local sql_file=$1
    local description=$2
    
    echo -e "\n🔧 $description"
    echo "   File: $sql_file"
    
    PGPASSWORD=$DB_PASSWORD psql \
        -h $DB_HOST \
        -p $DB_PORT \
        -U $DB_ADMIN_USER \
        -d $DB_NAME \
        -f $sql_file \
        --echo-queries
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Success"
    else
        echo "   ❌ Failed"
        exit 1
    fi
}

# Start Cloud SQL Proxy
echo -e "\n📡 Starting Cloud SQL Proxy..."
cloud_sql_proxy -instances=$CLOUDSQL_CONNECTION_NAME=tcp:5432 &
PROXY_PID=$!

# Wait for proxy to start
echo "   Waiting for proxy to initialize..."
sleep 5

# Test connection
echo -e "\n🔍 Testing database connection..."
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_ADMIN_USER \
    -d postgres \
    -c "SELECT version();" || {
        echo "❌ Failed to connect to database"
        kill $PROXY_PID
        exit 1
    }

# Create database if not exists
echo -e "\n📦 Creating database..."
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_ADMIN_USER \
    -d postgres \
    -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "   Database already exists"

# Create application user
echo -e "\n👤 Creating application user..."
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_ADMIN_USER \
    -d $DB_NAME \
    -c "CREATE USER $DB_APP_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "   User already exists"

# Execute setup scripts in order
echo -e "\n🚀 Executing database setup scripts..."

# Core PostgreSQL schema
execute_sql "$(dirname $0)/../schemas/postgresql-schema.sql" \
    "Creating core PostgreSQL schema"

# SMS schema
execute_sql "$(dirname $0)/01-create-sms-schema.sql" \
    "Creating SMS schema"

# Provider configuration schema
execute_sql "$(dirname $0)/02-create-provider-schema.sql" \
    "Creating provider configuration schema"

# Create indexes
execute_sql "$(dirname $0)/04-create-indexes.sql" \
    "Creating performance indexes"

# Load initial data
execute_sql "$(dirname $0)/05-initial-data.sql" \
    "Loading initial data"

# Grant final permissions
echo -e "\n🔐 Granting permissions..."
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_ADMIN_USER \
    -d $DB_NAME <<EOF
-- Grant database permissions
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_APP_USER;

-- Grant schema permissions
GRANT USAGE, CREATE ON SCHEMA public TO $DB_APP_USER;

-- Grant permissions on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA accounts TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA billing TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA trunks TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA numbers TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA routing TO $DB_APP_USER;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sms TO $DB_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA providers TO $DB_APP_USER;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA accounts TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA billing TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trunks TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA numbers TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA routing TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA audit TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA sms TO $DB_APP_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA providers TO $DB_APP_USER;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO $DB_APP_USER;
EOF

echo "   ✅ Permissions granted"

# Create BigQuery datasets
echo -e "\n📊 Setting up BigQuery datasets..."
bash "$(dirname $0)/03-create-bigquery-datasets.sh"

# Stop Cloud SQL Proxy
echo -e "\n🛑 Stopping Cloud SQL Proxy..."
kill $PROXY_PID

# Store connection information
echo -e "\n💾 Storing database connection information..."
cat > "$(dirname $0)/connection-info.json" <<EOF
{
  "postgresql": {
    "cloud_sql_instance": "$CLOUDSQL_CONNECTION_NAME",
    "database": "$DB_NAME",
    "username": "$DB_APP_USER",
    "host": "localhost (via Cloud SQL Proxy)",
    "port": 5432,
    "ssl_mode": "require",
    "connection_string": "postgresql://$DB_APP_USER:\${DB_PASSWORD}@localhost:5432/$DB_NAME?sslmode=require"
  },
  "bigquery": {
    "project_id": "ringer-warp-v01",
    "datasets": [
      "warp_cdr",
      "warp_mdr",
      "warp_analytics"
    ],
    "location": "us-central1",
    "service_account": "warp-bq-streamer@ringer-warp-v01.iam.gserviceaccount.com"
  },
  "schemas": [
    "auth",
    "accounts",
    "billing",
    "trunks",
    "numbers",
    "routing",
    "audit",
    "sms",
    "providers"
  ]
}
EOF

echo -e "\n✅ Database setup completed successfully!"
echo -e "\n📋 Next Steps:"
echo "1. Save the Cloud SQL instance connection name: $CLOUDSQL_CONNECTION_NAME"
echo "2. Configure your application with the database credentials"
echo "3. Set up the BigQuery streaming service account key"
echo "4. Test the database connectivity from your application"
echo "5. Run the application migrations if any"

echo -e "\n🔐 Connection information saved to: $(dirname $0)/connection-info.json"