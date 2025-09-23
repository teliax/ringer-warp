#!/bin/bash
# Initialize WARP database schemas

set -euo pipefail

PROJECT_ID="ringer-warp-v01"
DB_INSTANCE="warp-db"
DB_NAME="warp"
DB_USER="warp"
REGION="us-central1"

echo "🗄️ Initializing database schemas for WARP v0.1..."

# Get database password from secret manager
DB_PASSWORD=$(gcloud secrets versions access latest --secret="warp-db-password" --project="$PROJECT_ID" 2>/dev/null || echo "")
if [[ -z "$DB_PASSWORD" ]]; then
    echo "❌ Database password not found in secret manager"
    exit 1
fi

# Get Cloud SQL instance IP
DB_HOST=$(gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)")
echo "📍 Database host: $DB_HOST"

# Create temporary SQL file with all schemas
cat > /tmp/warp_schemas.sql << 'EOF'
-- WARP Platform Database Schema
-- Version: 1.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS sip;
CREATE SCHEMA IF NOT EXISTS call;
CREATE SCHEMA IF NOT EXISTS message;

-- Customers table (main schema)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table (billing schema)
CREATE TABLE IF NOT EXISTS billing.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_type VARCHAR(50) DEFAULT 'postpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SIP registrations table
CREATE TABLE IF NOT EXISTS sip.registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    username VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    port INTEGER,
    user_agent VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username_domain (username, domain),
    INDEX idx_expires (expires_at)
);

-- Call records table
CREATE TABLE IF NOT EXISTS call.records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    answer_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    rate DECIMAL(6,4) DEFAULT 0.0000,
    cost DECIMAL(10,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_call_id (call_id),
    INDEX idx_customer_time (customer_id, start_time),
    INDEX idx_numbers (from_number, to_number)
);

-- Message records table
CREATE TABLE IF NOT EXISTS message.records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    message_type VARCHAR(10) NOT NULL DEFAULT 'SMS',
    content TEXT,
    status VARCHAR(50) NOT NULL,
    segments INTEGER DEFAULT 1,
    rate DECIMAL(6,4) DEFAULT 0.0000,
    cost DECIMAL(10,4) DEFAULT 0.0000,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_message_id (message_id),
    INDEX idx_customer_time (customer_id, created_at)
);

-- Create update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON billing.accounts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON sip.registrations
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO warp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA billing TO warp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA sip TO warp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA call TO warp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA message TO warp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO warp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA billing TO warp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sip TO warp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA call TO warp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA message TO warp;

-- Create read-only user for reporting (optional)
-- CREATE USER warp_readonly WITH PASSWORD 'readonly_password';
-- GRANT CONNECT ON DATABASE warp TO warp_readonly;
-- GRANT USAGE ON SCHEMA public, billing, sip, call, message TO warp_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public, billing, sip, call, message TO warp_readonly;

EOF

# Execute SQL via gcloud
echo "🔌 Connecting to database via gcloud sql..."

# Create a temporary file with the password for non-interactive login
cat > /tmp/pgpass << EOF
$DB_HOST:5432:$DB_NAME:$DB_USER:$DB_PASSWORD
EOF
chmod 600 /tmp/pgpass

# Use gcloud sql connect with the SQL file
export PGPASSFILE=/tmp/pgpass

if PGPASSWORD="$DB_PASSWORD" psql "host=$DB_HOST dbname=$DB_NAME user=$DB_USER sslmode=require" -f /tmp/warp_schemas.sql; then
    echo "✅ Database schemas created successfully"
else
    echo "⚠️  Direct connection failed, trying alternate method..."
    
    # Try using gcloud sql connect
    gcloud sql connect "$DB_INSTANCE" --user="$DB_USER" --project="$PROJECT_ID" --database="$DB_NAME" < /tmp/warp_schemas.sql
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Database schemas created successfully via gcloud"
    else
        echo "❌ Failed to create database schemas"
        rm -f /tmp/pgpass
        exit 1
    fi
fi

rm -f /tmp/pgpass

# Clean up
rm -f /tmp/warp_schemas.sql
unset PGPASSWORD

echo "🎉 Database initialization complete!"