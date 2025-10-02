#!/bin/bash
# Verification script for golden image Terraform setup

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Golden Image Setup Verification${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓${NC} $description exists"
        return 0
    else
        echo -e "${RED}✗${NC} $description missing: $file"
        return 1
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local description=$2
    
    if [[ -d "$dir" ]]; then
        echo -e "${GREEN}✓${NC} $description exists"
        return 0
    else
        echo -e "${RED}✗${NC} $description missing: $dir"
        return 1
    fi
}

# Check golden image scripts
echo -e "${BLUE}Checking golden image scripts...${NC}"
GOLDEN_DIR="/home/daldworth/repos/ringer-warp/rtpengine/golden-image"
check_dir "$GOLDEN_DIR" "Golden image directory"
check_file "$GOLDEN_DIR/gcloud/create-golden-vm.sh" "Create golden VM script"
check_file "$GOLDEN_DIR/gcloud/create-golden-image.sh" "Create golden image script"
check_file "$GOLDEN_DIR/gcloud/deploy-rtpengine-vms.sh" "Deploy VMs script"
check_file "$GOLDEN_DIR/install-rtpengine-golden.sh" "RTPEngine installation script"
echo ""

# Check Terraform module updates
echo -e "${BLUE}Checking Terraform module updates...${NC}"
MODULE_DIR="/home/daldworth/repos/ringer-warp/warp/terraform/modules/compute"
check_file "$MODULE_DIR/main.tf" "Compute module main.tf"
check_file "$MODULE_DIR/main-golden.tf" "Golden image module variant"
check_file "$MODULE_DIR/variables.tf" "Module variables"
check_file "$MODULE_DIR/scripts/golden-instance-config.sh" "Golden instance config script"

# Check for golden image variables
if grep -q "use_golden_image" "$MODULE_DIR/variables.tf"; then
    echo -e "${GREEN}✓${NC} Golden image variables defined"
else
    echo -e "${RED}✗${NC} Golden image variables not found in variables.tf"
fi
echo ""

# Check Terraform environment configuration
echo -e "${BLUE}Checking Terraform environment configuration...${NC}"
ENV_DIR="/home/daldworth/repos/ringer-warp/warp/terraform/environments/dev"
check_file "$ENV_DIR/rtpengine-golden.tf" "Golden image deployment config"
check_file "$ENV_DIR/deploy-golden-rtpengine.sh" "Deployment orchestration script"
check_file "$ENV_DIR/GOLDEN_IMAGE_DEPLOYMENT.md" "Deployment documentation"

# Check if deployment script is executable
if [[ -x "$ENV_DIR/deploy-golden-rtpengine.sh" ]]; then
    echo -e "${GREEN}✓${NC} Deployment script is executable"
else
    echo -e "${RED}✗${NC} Deployment script is not executable"
fi
echo ""

# Check current Terraform state
echo -e "${BLUE}Checking Terraform state...${NC}"
cd "$ENV_DIR"
if [[ -f "terraform.tfstate" ]]; then
    echo -e "${GREEN}✓${NC} Terraform state file exists"
    
    # Check if compute module is in state
    if terraform state list 2>/dev/null | grep -q "module.compute"; then
        echo -e "${YELLOW}!${NC} Existing compute module found in state"
        echo "   You may need to migrate or recreate resources"
    fi
else
    echo -e "${YELLOW}!${NC} No Terraform state file found (expected for new deployments)"
fi
echo ""

# Check GCP configuration
echo -e "${BLUE}Checking GCP configuration...${NC}"
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [[ "$CURRENT_PROJECT" == "ringer-warp-v01" ]]; then
    echo -e "${GREEN}✓${NC} GCP project correctly set to ringer-warp-v01"
else
    echo -e "${RED}✗${NC} GCP project not set correctly (current: $CURRENT_PROJECT)"
fi

# Check for existing golden images
echo ""
echo -e "${BLUE}Checking for existing golden images...${NC}"
IMAGE_COUNT=$(gcloud compute images list --filter="family:rtpengine-golden" --format="value(name)" 2>/dev/null | wc -l || echo "0")
if [[ $IMAGE_COUNT -gt 0 ]]; then
    echo -e "${GREEN}✓${NC} Found $IMAGE_COUNT golden image(s)"
    gcloud compute images list --filter="family:rtpengine-golden" --format="table(name,diskSizeGb,creationTimestamp)" 2>/dev/null || true
else
    echo -e "${YELLOW}!${NC} No golden images found (need to create one)"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"

READY=true
if [[ ! -f "$ENV_DIR/deploy-golden-rtpengine.sh" ]]; then
    READY=false
fi

if [[ "$READY" == "true" ]]; then
    echo -e "${GREEN}✓ Golden image deployment is ready!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: cd $ENV_DIR"
    echo "2. Run: ./deploy-golden-rtpengine.sh"
    echo "3. Select option 1 for full deployment"
else
    echo -e "${RED}✗ Some components are missing${NC}"
    echo "Please check the errors above"
fi
echo ""