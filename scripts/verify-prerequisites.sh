#!/bin/bash
# WARP Prerequisites Verification Script
# Validates all requirements before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 WARP Deployment Prerequisites Verification${NC}"
echo "=============================================="
echo ""

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNINGS=0
CRITICAL_FAILURES=0

# Function to check status
check_status() {
    local check_name=$1
    local status=$2
    local is_critical=${3:-true}
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ $check_name${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}⚠️  $check_name${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${RED}❌ $check_name${NC}"
        if [ "$is_critical" = true ]; then
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
        fi
    fi
}

echo -e "${BLUE}1. Checking CLI Tools...${NC}"
echo "------------------------"

# Check required tools
TOOLS=(
    "gcloud:Google Cloud SDK"
    "kubectl:Kubernetes CLI"
    "terraform:Infrastructure as Code"
    "kustomize:Kubernetes customization"
    "jq:JSON processor"
)

for tool_info in "${TOOLS[@]}"; do
    IFS=':' read -r tool description <<< "$tool_info"
    if command -v $tool &> /dev/null; then
        version=$($tool --version 2>&1 | head -1)
        check_status "$description - $version" "pass"
    else
        check_status "$description - NOT INSTALLED" "fail"
    fi
done

# Optional tools
OPTIONAL_TOOLS=(
    "yq:YAML processor"
    "sipsak:SIP testing"
    "psql:PostgreSQL client"
)

for tool_info in "${OPTIONAL_TOOLS[@]}"; do
    IFS=':' read -r tool description <<< "$tool_info"
    if command -v $tool &> /dev/null; then
        check_status "$description - Installed" "pass"
    else
        check_status "$description - Not installed (optional)" "warn" false
    fi
done

echo ""
echo -e "${BLUE}2. Checking GCP Configuration...${NC}"
echo "---------------------------------"

# Check project configuration
EXPECTED_PROJECT="ringer-472421"
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ "$CURRENT_PROJECT" = "$EXPECTED_PROJECT" ]; then
    check_status "GCP Project: $CURRENT_PROJECT" "pass"
else
    check_status "GCP Project: Expected $EXPECTED_PROJECT, got $CURRENT_PROJECT" "fail"
fi

# Check default region
CURRENT_REGION=$(gcloud config get-value compute/region 2>/dev/null)
if [ "$CURRENT_REGION" = "us-central1" ]; then
    check_status "Default region: $CURRENT_REGION" "pass"
else
    check_status "Default region: $CURRENT_REGION (should be us-central1)" "warn" false
fi

# Check authentication
if gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    check_status "GCP Authentication: $ACTIVE_ACCOUNT" "pass"
else
    check_status "GCP Authentication: No active account" "fail"
fi

echo ""
echo -e "${BLUE}3. Checking Infrastructure Components...${NC}"
echo "----------------------------------------"

# Check GKE cluster
if gcloud container clusters describe warp-dev-kamailio-cluster --region=us-central1 &>/dev/null; then
    check_status "GKE Cluster: warp-dev-kamailio-cluster" "pass"
    
    # Try to get credentials
    if gcloud container clusters get-credentials warp-dev-kamailio-cluster --region=us-central1 &>/dev/null; then
        check_status "Kubectl configured for cluster" "pass"
    else
        check_status "Cannot configure kubectl for cluster" "fail"
    fi
else
    check_status "GKE Cluster: Not found" "fail"
fi

# Check Cloud SQL
if gcloud sql instances describe warp-dev-db &>/dev/null; then
    check_status "Cloud SQL: warp-dev-db" "pass"
else
    check_status "Cloud SQL: Not found" "fail"
fi

# Check Redis
if gcloud redis instances describe warp-dev-redis --region=us-central1 &>/dev/null; then
    check_status "Redis Instance: warp-dev-redis" "pass"
else
    check_status "Redis Instance: Not found" "warn" false
fi

echo ""
echo -e "${BLUE}4. Checking Secrets in Secret Manager...${NC}"
echo "----------------------------------------"

REQUIRED_SECRETS=(
    "warp-dev-db-password:Database password"
    "warp-dev-jasmin-admin:Jasmin admin password"
    "warp-dev-rabbitmq-password:RabbitMQ password"
)

for secret_info in "${REQUIRED_SECRETS[@]}"; do
    IFS=':' read -r secret description <<< "$secret_info"
    if gcloud secrets describe $secret &>/dev/null; then
        check_status "$description secret exists" "pass"
    else
        check_status "$description secret missing" "fail"
    fi
done

# Check optional secrets
OPTIONAL_SECRETS=(
    "warp-dev-sinch-credentials:Sinch SMPP credentials"
    "warp-dev-telique-api:Telique API credentials"
    "warp-dev-netsuite-config:NetSuite integration"
)

for secret_info in "${OPTIONAL_SECRETS[@]}"; do
    IFS=':' read -r secret description <<< "$secret_info"
    if gcloud secrets describe $secret &>/dev/null; then
        check_status "$description configured" "pass"
    else
        check_status "$description not configured (optional)" "warn" false
    fi
done

echo ""
echo -e "${BLUE}5. Checking Kubernetes Secrets...${NC}"
echo "---------------------------------"

# Check if kubectl is configured
if kubectl cluster-info &>/dev/null; then
    check_status "Kubectl cluster connection" "pass"
    
    # Check for secret files
    SECRETS_DIR="kubernetes/overlays/dev/secrets"
    if [ -d "$SECRETS_DIR" ]; then
        for secret_file in "postgres.env" "jasmin.env" "sinch.env" "rabbitmq.env"; do
            if [ -f "$SECRETS_DIR/$secret_file" ]; then
                if grep -q "CHANGE_ME" "$SECRETS_DIR/$secret_file"; then
                    check_status "$secret_file contains placeholder values" "fail"
                else
                    check_status "$secret_file configured" "pass"
                fi
            else
                if [ -f "$SECRETS_DIR/$secret_file.example" ]; then
                    check_status "$secret_file not created (example exists)" "fail"
                else
                    check_status "$secret_file and example missing" "fail"
                fi
            fi
        done
    else
        check_status "Secrets directory not found" "fail"
    fi
else
    check_status "Cannot connect to Kubernetes cluster" "warn" false
fi

echo ""
echo -e "${BLUE}6. Checking Terraform State...${NC}"
echo "------------------------------"

# Check terraform state bucket
if gsutil ls gs://warp-terraform-state-dev &>/dev/null; then
    check_status "Terraform state bucket exists" "pass"
else
    check_status "Terraform state bucket not found" "fail"
fi

# Check terraform outputs
if [ -d "warp/terraform/environments/dev" ]; then
    cd warp/terraform/environments/dev
    if terraform output &>/dev/null; then
        check_status "Terraform outputs accessible" "pass"
        
        # Check specific outputs
        RTPENGINE_IPS=$(terraform output -json rtpengine_ips 2>/dev/null || echo "")
        if [ -n "$RTPENGINE_IPS" ]; then
            check_status "RTPEngine IPs available" "pass"
        else
            check_status "RTPEngine IPs not found" "warn" false
        fi
    else
        check_status "Cannot access terraform outputs" "warn" false
    fi
    cd - > /dev/null
else
    check_status "Terraform directory not found" "fail"
fi

echo ""
echo -e "${BLUE}7. Checking Network Connectivity...${NC}"
echo "-----------------------------------"

# Check if we can reach GCP services
if curl -s -o /dev/null -w "%{http_code}" https://www.googleapis.com | grep -q "200\|204"; then
    check_status "GCP API connectivity" "pass"
else
    check_status "Cannot reach GCP APIs" "fail"
fi

# Check DNS resolution
if host api.ringer.tel &>/dev/null; then
    check_status "DNS configured for api.ringer.tel" "pass"
else
    check_status "DNS not configured for api.ringer.tel" "warn" false
fi

echo ""
echo -e "${BLUE}8. Checking File Structure...${NC}"
echo "-----------------------------"

# Check required directories and files
REQUIRED_FILES=(
    "deploy-warp-platform.sh:Master deployment script"
    "kubernetes/deploy.sh:Kubernetes deployment script"
    "warp/database/setup/00-master-setup.sh:Database setup script"
)

for file_info in "${REQUIRED_FILES[@]}"; do
    IFS=':' read -r file description <<< "$file_info"
    if [ -f "$file" ]; then
        if [ -x "$file" ]; then
            check_status "$description - executable" "pass"
        else
            check_status "$description - not executable" "warn" false
        fi
    else
        check_status "$description - missing" "fail"
    fi
done

echo ""
echo "=============================================="
echo -e "${BLUE}📊 Verification Summary${NC}"
echo "=============================================="
echo -e "Total checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Critical failures: ${RED}$CRITICAL_FAILURES${NC}"
echo ""

# Calculate readiness percentage
READINESS=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

if [ $CRITICAL_FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ System is ready for deployment! (${READINESS}% ready)${NC}"
    echo ""
    echo "You can proceed with: ./deploy-warp-platform.sh"
    exit 0
else
    echo -e "${RED}❌ System is NOT ready for deployment! (${READINESS}% ready)${NC}"
    echo ""
    echo "Please resolve the critical failures before proceeding."
    echo "Refer to docs/deployment-prerequisites.md for setup instructions."
    exit 1
fi