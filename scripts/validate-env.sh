#!/bin/bash

# WARP Platform Environment Validation Script
# Validates that all required environment variables are set and services are reachable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "WARP Platform Environment Validation"
echo "================================================"

# Load environment file if specified
if [ -n "$1" ]; then
    if [ -f "$1" ]; then
        echo "Loading environment from: $1"
        source "$1"
    else
        echo -e "${RED}Error: Environment file $1 not found${NC}"
        exit 1
    fi
elif [ -f ".env" ]; then
    echo "Loading environment from: .env"
    source .env
elif [ -f ".env.development" ]; then
    echo "Loading environment from: .env.development"
    source .env.development
fi

# Define required environment variables by category
echo -e "\n${YELLOW}Checking required environment variables...${NC}\n"

# Core GCP
gcp_vars=(
    "GCP_PROJECT_ID"
    "GCP_REGION"
)

# Databases
db_vars=(
    "POSTGRES_HOST"
    "POSTGRES_USER"
    "POSTGRES_DB"
    "REDIS_HOST"
    "BIGQUERY_PROJECT_ID"
    "BIGQUERY_DATASET"
)

# Services (will be created by k8s)
service_vars=(
    "KAMAILIO_SERVICE_HOST"
    "JASMIN_HOST"
    "HOMER_HOST"
)

# External integrations (must be configured before deployment)
external_vars=(
    "SINCH_APP_KEY"
    "TELIQUE_API_KEY"
    "AUTH0_DOMAIN"
)

# Function to check variable group
check_vars() {
    local group_name=$1
    shift
    local vars=("$@")
    local missing=()
    local found=0

    echo "Checking $group_name:"
    
    for var in "${vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing+=($var)
            echo -e "  ${RED}✗${NC} $var is not set"
        else
            found=$((found + 1))
            # Don't print values for sensitive data
            if [[ $var == *"PASSWORD"* ]] || [[ $var == *"KEY"* ]] || [[ $var == *"SECRET"* ]]; then
                echo -e "  ${GREEN}✓${NC} $var is set (hidden)"
            else
                echo -e "  ${GREEN}✓${NC} $var = ${!var}"
            fi
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "  ${YELLOW}Warning: ${#missing[@]} variables not set in $group_name${NC}"
    else
        echo -e "  ${GREEN}All $group_name variables are set!${NC}"
    fi
    
    echo ""
}

# Check each group
check_vars "GCP Configuration" "${gcp_vars[@]}"
check_vars "Database Configuration" "${db_vars[@]}"
check_vars "Service Configuration (to be created by k8s)" "${service_vars[@]}"
check_vars "External Integrations" "${external_vars[@]}"

# Test connections (only if hosts are set)
echo -e "${YELLOW}Testing service connections...${NC}\n"

# Test PostgreSQL connection (if configured)
if [ -n "$POSTGRES_HOST" ] && [ "$POSTGRES_HOST" != "" ]; then
    echo "Testing PostgreSQL connection..."
    if command -v psql &> /dev/null; then
        PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p ${POSTGRES_PORT:-5432} -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}✓${NC} PostgreSQL connection successful"
        else
            echo -e "  ${RED}✗${NC} PostgreSQL connection failed (may not be deployed yet)"
        fi
    else
        echo -e "  ${YELLOW}!${NC} psql client not installed, skipping PostgreSQL test"
    fi
else
    echo -e "  ${YELLOW}!${NC} PostgreSQL host not configured yet"
fi

# Test Redis connection (if configured)
if [ -n "$REDIS_HOST" ] && [ "$REDIS_HOST" != "" ]; then
    echo "Testing Redis connection..."
    if command -v redis-cli &> /dev/null; then
        if [ -n "$REDIS_PASSWORD" ]; then
            redis-cli -h $REDIS_HOST -p ${REDIS_PORT:-6379} -a $REDIS_PASSWORD ping > /dev/null 2>&1
        else
            redis-cli -h $REDIS_HOST -p ${REDIS_PORT:-6379} ping > /dev/null 2>&1
        fi
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}✓${NC} Redis connection successful"
        else
            echo -e "  ${RED}✗${NC} Redis connection failed (may not be deployed yet)"
        fi
    else
        echo -e "  ${YELLOW}!${NC} redis-cli not installed, skipping Redis test"
    fi
else
    echo -e "  ${YELLOW}!${NC} Redis host not configured yet"
fi

# Check if GCP is configured
echo -e "\n${YELLOW}Checking GCP configuration...${NC}\n"
if command -v gcloud &> /dev/null; then
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ -n "$CURRENT_PROJECT" ]; then
        echo -e "  ${GREEN}✓${NC} GCP CLI configured with project: $CURRENT_PROJECT"
        if [ "$CURRENT_PROJECT" != "$GCP_PROJECT_ID" ]; then
            echo -e "  ${YELLOW}!${NC} Warning: Current project ($CURRENT_PROJECT) doesn't match GCP_PROJECT_ID ($GCP_PROJECT_ID)"
        fi
    else
        echo -e "  ${RED}✗${NC} GCP CLI not configured. Run: gcloud auth login && gcloud config set project $GCP_PROJECT_ID"
    fi
else
    echo -e "  ${RED}✗${NC} gcloud CLI not installed"
fi

# Check if kubectl is configured
echo -e "\n${YELLOW}Checking Kubernetes configuration...${NC}\n"
if command -v kubectl &> /dev/null; then
    kubectl cluster-info > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        CONTEXT=$(kubectl config current-context)
        echo -e "  ${GREEN}✓${NC} kubectl configured with context: $CONTEXT"
    else
        echo -e "  ${YELLOW}!${NC} kubectl not connected to a cluster (will be configured later)"
    fi
else
    echo -e "  ${RED}✗${NC} kubectl not installed"
fi

# Summary
echo ""
echo "================================================"
echo "Environment Validation Summary"
echo "================================================"

# Note about services to be created
echo -e "\n${YELLOW}Note:${NC} The following services will be created by the Kubernetes deployment:"
echo "  • Kamailio (SIP server) - Multiple pods"
echo "  • RTPEngine (Media server) - VMs"
echo "  • Jasmin (SMS gateway)"
echo "  • Homer (SIP capture)"
echo "  • RabbitMQ (for Jasmin)"
echo "  • Monitoring stack (Prometheus/Grafana)"

echo -e "\n${YELLOW}Note:${NC} CockroachDB is NOT used in this architecture."
echo "  Cloud SQL PostgreSQL provides high availability with regional replication."

echo -e "\n${GREEN}Next Steps:${NC}"
echo "  1. Fill in missing environment variables in your .env file"
echo "  2. Configure external service credentials (Sinch, Telique, Auth0)"
echo "  3. Run the Kubernetes deployment to create services"
echo "  4. Re-run this script to validate connections"

exit 0
