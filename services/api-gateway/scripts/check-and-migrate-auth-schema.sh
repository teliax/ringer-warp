#!/bin/bash
# Check if auth schema has google_id column and migrate if needed

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking auth schema..."

# Database connection details
DB_HOST="${DATABASE_HOST:-10.126.0.3}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-warp}"
DB_USER="${DATABASE_USER:-warp_app}"
DB_PASSWORD="${DATABASE_PASSWORD}"

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ DATABASE_PASSWORD environment variable not set${NC}"
    exit 1
fi

# Function to run SQL query
run_query() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}

# Check if auth.users table exists
echo "Checking if auth.users table exists..."
TABLE_EXISTS=$(run_query "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');")

if [ "$TABLE_EXISTS" != "t" ]; then
    echo -e "${RED}❌ auth.users table does not exist!${NC}"
    echo "Please run the base auth schema first:"
    echo "  psql < infrastructure/database/schemas/04-auth-system.sql"
    exit 1
fi

echo -e "${GREEN}✅ auth.users table exists${NC}"

# Check which column exists
echo "Checking for column name..."
HAS_GOOGLE_ID=$(run_query "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'google_id');")
HAS_FIREBASE_UID=$(run_query "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'firebase_uid');")

if [ "$HAS_GOOGLE_ID" = "t" ]; then
    echo -e "${GREEN}✅ Schema is correct - google_id column exists${NC}"
    exit 0
fi

if [ "$HAS_FIREBASE_UID" = "t" ]; then
    echo -e "${YELLOW}⚠️  Schema needs migration - firebase_uid column found${NC}"
    echo "Running migration..."
    
    # Run migration
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        < ../../infrastructure/database/schemas/05-update-auth-google-oauth.sql
    
    echo -e "${GREEN}✅ Migration completed successfully${NC}"
    exit 0
fi

echo -e "${RED}❌ Neither google_id nor firebase_uid column found!${NC}"
exit 1

