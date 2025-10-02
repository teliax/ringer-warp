#!/bin/bash
# Deployment script for RTPEngine using golden image approach
# This script orchestrates the entire golden image creation and deployment process

set -e

# Configuration
PROJECT_ID="ringer-warp-v01"
REGION="us-central1"
GOLDEN_IMAGE_DIR="/home/daldworth/repos/ringer-warp/rtpengine/golden-image"
TERRAFORM_DIR="/home/daldworth/repos/ringer-warp/warp/terraform/environments/dev"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}RTPEngine Golden Image Deployment${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}Error: gcloud CLI not found${NC}"
        exit 1
    fi
    
    # Check terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}Error: Terraform not found${NC}"
        exit 1
    fi
    
    # Check project
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [[ "$CURRENT_PROJECT" != "$PROJECT_ID" ]]; then
        echo -e "${YELLOW}Setting project to $PROJECT_ID...${NC}"
        gcloud config set project "$PROJECT_ID"
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Function to show deployment menu
show_menu() {
    echo ""
    echo -e "${BLUE}Deployment Options:${NC}"
    echo "1. Full deployment (create golden image + deploy VMs)"
    echo "2. Create golden image only"
    echo "3. Deploy VMs from existing golden image"
    echo "4. Update existing deployment to use golden image"
    echo "5. Check deployment status"
    echo "6. Exit"
    echo ""
    read -p "Select option (1-6): " option
    echo ""
}

# Function to create golden image
create_golden_image() {
    echo -e "${YELLOW}Creating golden image...${NC}"
    
    # Step 1: Delete old VMs
    echo -e "${BLUE}Step 1: Cleaning up old VMs...${NC}"
    if [[ -f "$GOLDEN_IMAGE_DIR/gcloud/delete-old-vms.sh" ]]; then
        cd "$GOLDEN_IMAGE_DIR"
        bash gcloud/delete-old-vms.sh
    fi
    
    # Step 2: Create golden VM
    echo -e "${BLUE}Step 2: Creating golden VM...${NC}"
    if [[ -f "$GOLDEN_IMAGE_DIR/gcloud/create-golden-vm.sh" ]]; then
        bash gcloud/create-golden-vm.sh
    else
        echo -e "${RED}Error: create-golden-vm.sh not found${NC}"
        return 1
    fi
    
    # Step 3: Install RTPEngine on golden VM
    echo -e "${BLUE}Step 3: Installing RTPEngine on golden VM...${NC}"
    echo "Waiting for VM to be ready..."
    sleep 30
    
    # Copy installation script to golden VM
    gcloud compute scp "$GOLDEN_IMAGE_DIR/install-rtpengine-golden.sh" \
        warp-rtpengine-golden:~/install-rtpengine-golden.sh \
        --zone="${REGION}-a" \
        --project="$PROJECT_ID"
    
    # Run installation
    echo "Running installation script..."
    gcloud compute ssh warp-rtpengine-golden \
        --zone="${REGION}-a" \
        --project="$PROJECT_ID" \
        --command="chmod +x install-rtpengine-golden.sh && sudo ./install-rtpengine-golden.sh"
    
    # Step 4: Create golden image
    echo -e "${BLUE}Step 4: Creating golden image from VM...${NC}"
    if [[ -f "$GOLDEN_IMAGE_DIR/gcloud/create-golden-image.sh" ]]; then
        bash gcloud/create-golden-image.sh
    else
        echo -e "${RED}Error: create-golden-image.sh not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Golden image created successfully${NC}"
}

# Function to deploy VMs using Terraform
deploy_with_terraform() {
    echo -e "${YELLOW}Deploying RTPEngine VMs with Terraform...${NC}"
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    echo -e "${BLUE}Initializing Terraform...${NC}"
    terraform init
    
    # Create plan
    echo -e "${BLUE}Creating Terraform plan...${NC}"
    terraform plan -out=tfplan \
        -var="use_golden_image=true" \
        -var="rtpengine_instance_count=3" \
        -target=module.compute_golden
    
    # Show plan summary
    echo ""
    echo -e "${YELLOW}Terraform will create the following resources:${NC}"
    terraform show -no-color tfplan | grep -E "will be created|will be updated" || true
    echo ""
    
    read -p "Do you want to apply this plan? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        return
    fi
    
    # Apply plan
    echo -e "${BLUE}Applying Terraform configuration...${NC}"
    terraform apply tfplan
    
    echo -e "${GREEN}✓ Terraform deployment complete${NC}"
}

# Function to update existing deployment
update_deployment() {
    echo -e "${YELLOW}Updating existing deployment to use golden image...${NC}"
    
    cd "$TERRAFORM_DIR"
    
    # Check current state
    echo -e "${BLUE}Checking current deployment...${NC}"
    terraform state list | grep "module.compute.google_compute_instance.rtpengine" || true
    
    # Create backup
    echo -e "${BLUE}Creating state backup...${NC}"
    cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d-%H%M%S)
    
    # Update configuration
    echo -e "${BLUE}Updating Terraform configuration...${NC}"
    
    # Modify the compute module in main.tf to use golden image
    cat > update-compute-module.tf <<'EOF'
# Temporary file to update compute module configuration
# This will be merged with main.tf

# Updated compute module with golden image support
module "compute" {
  source = "../../modules/compute"

  project_id               = var.project_id
  project_name             = local.project_name
  region                   = var.region
  environment              = local.environment
  vpc_id                   = module.networking.vpc_id
  rtpengine_subnet_id      = module.networking.rtpengine_subnet_id
  rtpengine_instance_count = 3
  rtpengine_machine_type   = "e2-standard-4"
  rtpengine_disk_size      = 50
  rtpengine_log_level      = 6
  rtp_port_min             = 10000
  rtp_port_max             = 19999
  consul_servers           = module.consul.consul_server_ips
  consul_datacenter        = module.consul.consul_datacenter
  redis_host               = google_redis_instance.cache.host
  redis_port               = google_redis_instance.cache.port
  
  # Enable golden image
  use_golden_image    = true
  golden_image_family = "rtpengine-golden"
}
EOF
    
    echo -e "${YELLOW}Please manually update main.tf with the golden image configuration${NC}"
    echo "Add these parameters to the compute module:"
    echo "  use_golden_image    = true"
    echo "  golden_image_family = \"rtpengine-golden\""
    echo ""
    read -p "Press enter when ready to continue..."
    
    # Plan the update
    terraform plan -out=tfplan-update
    
    # Apply if confirmed
    read -p "Apply the update? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        terraform apply tfplan-update
    fi
}

# Function to check deployment status
check_status() {
    echo -e "${YELLOW}Checking deployment status...${NC}"
    
    # Check golden images
    echo -e "${BLUE}Golden Images:${NC}"
    gcloud compute images list \
        --project="$PROJECT_ID" \
        --filter="family:rtpengine-golden" \
        --format="table(name,diskSizeGb,creationTimestamp)"
    
    echo ""
    
    # Check RTPEngine VMs
    echo -e "${BLUE}RTPEngine VMs:${NC}"
    gcloud compute instances list \
        --project="$PROJECT_ID" \
        --filter="name:warp-rtpengine-*" \
        --format="table(name,status,zone,networkInterfaces[0].accessConfigs[0].natIP:label=EXTERNAL_IP,networkInterfaces[0].networkIP:label=INTERNAL_IP)"
    
    echo ""
    
    # Check Terraform state
    if [[ -f "$TERRAFORM_DIR/terraform.tfstate" ]]; then
        echo -e "${BLUE}Terraform Resources:${NC}"
        cd "$TERRAFORM_DIR"
        terraform state list | grep -E "rtpengine|compute" || echo "No RTPEngine resources in state"
    fi
    
    echo ""
    
    # Health check
    if [[ -f "$GOLDEN_IMAGE_DIR/gcloud/check-rtpengine-health.sh" ]]; then
        echo -e "${BLUE}Running health check...${NC}"
        bash "$GOLDEN_IMAGE_DIR/gcloud/check-rtpengine-health.sh"
    fi
}

# Main execution
check_prerequisites

while true; do
    show_menu
    
    case $option in
        1)
            # Full deployment
            create_golden_image
            if [[ $? -eq 0 ]]; then
                deploy_with_terraform
            fi
            ;;
        2)
            # Create golden image only
            create_golden_image
            ;;
        3)
            # Deploy VMs only
            deploy_with_terraform
            ;;
        4)
            # Update existing deployment
            update_deployment
            ;;
        5)
            # Check status
            check_status
            ;;
        6)
            echo -e "${YELLOW}Exiting...${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press enter to continue..."
done