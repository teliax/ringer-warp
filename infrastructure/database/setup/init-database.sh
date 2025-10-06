#!/bin/bash
set -e

# Database connection parameters
DB_HOST="${DB_HOST:-10.126.0.3}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-warp}"
DB_USER="${DB_USER:-warp}"
DB_PASSWORD="${DB_PASSWORD:-)T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}}"

# Schema directory (can be overridden)
SCHEMA_DIR="${SCHEMA_DIR:-/schema}"
# If not in container, use local path
if [ ! -d "$SCHEMA_DIR" ] && [ -d "../schema" ]; then
    SCHEMA_DIR="../schema"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Export PostgreSQL connection variables
export PGHOST="$DB_HOST"
export PGPORT="$DB_PORT"
export PGDATABASE="$DB_NAME"
export PGUSER="$DB_USER"
export PGPASSWORD="$DB_PASSWORD"

# Function to print colored messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to test database connectivity
test_connection() {
    log_info "Testing database connectivity..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
            log_success "Database server is ready"
            
            # Test actual connection with credentials
            if psql -c "SELECT 1" > /dev/null 2>&1; then
                log_success "Successfully connected to database"
                return 0
            else
                log_error "Database server is up but authentication failed"
                return 1
            fi
        else
            log_warning "Database not ready (attempt $attempt/$max_attempts)"
            sleep 2
            ((attempt++))
        fi
    done
    
    log_error "Failed to connect to database after $max_attempts attempts"
    return 1
}

# Function to check if schema exists
schema_exists() {
    local schema=$1
    local result=$(psql -tAc "SELECT 1 FROM pg_namespace WHERE nspname = '$schema';" 2>/dev/null || echo "0")
    [ "$result" = "1" ]
}

# Function to get table count
get_table_count() {
    local count=$(psql -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('accounts', 'auth', 'billing', 'numbers', 'routing', 'cdr', 'messaging', 'audit', 'vendor_mgmt');" 2>/dev/null || echo "0")
    echo "$count"
}

# Function to execute SQL file with error handling
execute_sql_file() {
    local sql_file=$1
    local filename=$(basename "$sql_file")
    
    log_info "Executing $filename..."
    
    # Create temporary file with transaction wrapper
    local temp_file="/tmp/${filename}.tmp"
    cat > "$temp_file" << EOF
BEGIN;
\i $sql_file
COMMIT;
EOF
    
    # Execute with detailed error reporting
    if psql -v ON_ERROR_STOP=1 -f "$temp_file" 2>&1 | tee /tmp/sql_output.log; then
        log_success "Successfully executed $filename"
        rm -f "$temp_file" /tmp/sql_output.log
        return 0
    else
        log_error "Failed to execute $filename"
        log_error "Error output:"
        cat /tmp/sql_output.log
        rm -f "$temp_file" /tmp/sql_output.log
        return 1
    fi
}

# Function to verify schema installation
verify_installation() {
    log_info "Verifying database installation..."
    
    echo -e "\n${GREEN}=== Installed Schemas ===${NC}"
    psql -c "SELECT nspname as schema_name FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public') ORDER BY nspname;"
    
    echo -e "\n${GREEN}=== Tables per Schema ===${NC}"
    psql -c "SELECT table_schema, COUNT(*) as table_count FROM information_schema.tables WHERE table_schema IN ('accounts', 'auth', 'billing', 'numbers', 'routing', 'cdr', 'messaging', 'audit', 'vendor_mgmt') GROUP BY table_schema ORDER BY table_schema;"
    
    echo -e "\n${GREEN}=== Installed Extensions ===${NC}"
    psql -c "SELECT extname as extension, extversion as version FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY extname;"
    
    # Check specific important tables
    echo -e "\n${GREEN}=== Key Tables Status ===${NC}"
    for table in "accounts.accounts" "auth.api_keys" "numbers.phone_numbers" "routing.routes"; do
        if psql -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = '${table%%.*}' AND table_name = '${table#*.}';" | grep -q 1; then
            echo -e "${GREEN}✓${NC} $table exists"
        else
            echo -e "${RED}✗${NC} $table missing"
        fi
    done
}

# Main execution
main() {
    echo -e "${GREEN}=== WARP Database Schema Initialization ===${NC}"
    echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
    echo "User: $DB_USER"
    echo "Schema Directory: $SCHEMA_DIR"
    echo ""
    
    # Test connection
    if ! test_connection; then
        log_error "Cannot proceed without database connection"
        exit 1
    fi
    
    # Check if database is already initialized
    local table_count=$(get_table_count)
    if [ "$table_count" -gt 0 ]; then
        log_warning "Database already contains $table_count tables"
        
        # Ask for confirmation if running interactively
        if [ -t 0 ]; then
            read -p "Do you want to reinitialize the database? This will DROP all existing data! (yes/no): " -r
            if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
                log_info "Initialization cancelled"
                verify_installation
                exit 0
            fi
            log_warning "Dropping all existing schemas..."
            psql -c "DROP SCHEMA IF EXISTS accounts, auth, billing, numbers, routing, cdr, messaging, audit, vendor_mgmt CASCADE;"
        else
            log_info "Database already initialized. Skipping..."
            verify_installation
            exit 0
        fi
    fi
    
    # Check if schema files exist
    if [ ! -d "$SCHEMA_DIR" ]; then
        log_error "Schema directory not found: $SCHEMA_DIR"
        exit 1
    fi
    
    # Count SQL files
    local sql_files=($(find "$SCHEMA_DIR" -name "*.sql" -type f | sort))
    if [ ${#sql_files[@]} -eq 0 ]; then
        log_error "No SQL files found in $SCHEMA_DIR"
        exit 1
    fi
    
    log_info "Found ${#sql_files[@]} SQL files to execute"
    
    # Execute each SQL file in order
    local failed=0
    for sql_file in "${sql_files[@]}"; do
        if ! execute_sql_file "$sql_file"; then
            failed=1
            break
        fi
    done
    
    if [ $failed -eq 0 ]; then
        log_success "All SQL files executed successfully!"
        verify_installation
        
        # Final summary
        echo -e "\n${GREEN}=== Initialization Complete ===${NC}"
        echo "Database initialized successfully with:"
        echo "- $(psql -tAc "SELECT COUNT(DISTINCT nspname) FROM pg_namespace WHERE nspname IN ('accounts', 'auth', 'billing', 'numbers', 'routing', 'cdr', 'messaging', 'audit', 'vendor_mgmt');") schemas"
        echo "- $(get_table_count) tables"
        echo "- $(psql -tAc "SELECT COUNT(*) FROM pg_extension WHERE extname NOT IN ('plpgsql');") extensions"
    else
        log_error "Database initialization failed!"
        exit 1
    fi
}

# Run main function
main "$@"