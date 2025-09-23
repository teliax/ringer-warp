#!/bin/bash
# Simple database initialization for WARP

set -euo pipefail

PROJECT_ID="ringer-warp-v01"
DB_INSTANCE="warp-db"
DB_NAME="warp"
DB_USER="warp"

echo "🗄️ Initializing database schemas..."

# Create SQL file
cat > /tmp/init.sql << 'EOF'
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create basic customer table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create basic call records table  
CREATE TABLE IF NOT EXISTS call_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    call_id VARCHAR(255) UNIQUE NOT NULL,
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT 'Database initialized' as status;
EOF

# Connect and run SQL
echo "Connecting to Cloud SQL..."
gcloud sql connect "$DB_INSTANCE" \
    --user="$DB_USER" \
    --project="$PROJECT_ID" \
    --database="$DB_NAME" < /tmp/init.sql

rm -f /tmp/init.sql
echo "✅ Database initialization complete!"