#!/bin/bash

# Test database connection using Docker
# This script doesn't require PostgreSQL client to be installed locally

DB_HOST="${DB_HOST:-10.126.0.3}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-warp}"
DB_USER="${DB_USER:-warp}"
DB_PASSWORD="${DB_PASSWORD:-)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Testing WARP Database Connection ===${NC}"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Trying kubectl run...${NC}"
    
    # Use kubectl run to test connection
    echo "Creating temporary pod for database testing..."
    kubectl run db-test --image=postgres:15-alpine --rm -it --restart=Never -- \
        sh -c "PGPASSWORD='$DB_PASSWORD' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
    
    exit $?
fi

# Use Docker to test connection
echo "Testing connection using Docker..."

docker run --rm \
    -e PGPASSWORD="$DB_PASSWORD" \
    postgres:15-alpine \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>&1

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Database connection successful!${NC}"
    
    # Get additional info
    echo -e "\n${YELLOW}Getting database information...${NC}"
    
    docker run --rm \
        -e PGPASSWORD="$DB_PASSWORD" \
        postgres:15-alpine \
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT 'Schemas: ' || COUNT(DISTINCT nspname)
        FROM pg_namespace 
        WHERE nspname IN ('accounts', 'auth', 'billing', 'numbers', 'routing', 'cdr', 'messaging', 'audit', 'vendor_mgmt')
        UNION ALL
        SELECT 'Tables: ' || COUNT(*)
        FROM information_schema.tables 
        WHERE table_schema IN ('accounts', 'auth', 'billing', 'numbers', 'routing', 'cdr', 'messaging', 'audit', 'vendor_mgmt')
        UNION ALL
        SELECT 'Extensions: ' || COUNT(*)
        FROM pg_extension 
        WHERE extname NOT IN ('plpgsql');
    "
else
    echo -e "\n${RED}✗ Database connection failed!${NC}"
    echo -e "${RED}Please check:${NC}"
    echo "  - Database host is reachable: $DB_HOST"
    echo "  - Port is correct: $DB_PORT"
    echo "  - Credentials are valid"
    echo "  - Database exists: $DB_NAME"
    exit 1
fi