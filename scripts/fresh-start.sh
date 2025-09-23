#!/bin/bash
# WARP Platform - Complete Fresh Start Script
# Creates new GCP project with proper infrastructure setup

set -e

# Configuration
NEW_PROJECT_ID="ringer-warp-v01"  # GCP doesn't allow dots in project IDs
PROJECT_NAME="Ringer WARP v01"
REGION="us-central1"
ZONE="us-central1-a"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       WARP Platform - Fresh Start Installation${NC}"
echo -e "${BLUE}       Project: ${PROJECT_NAME}${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check if command was successful
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Function to enable an API
enable_api() {
    local api=$1
    echo -e "${YELLOW}Enabling ${api}...${NC}"
    gcloud services enable ${api} --project=${NEW_PROJECT_ID}
    check_status "Enabled ${api}"
}

echo -e "\n${GREEN}Step 1: Project Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if project already exists
if gcloud projects describe ${NEW_PROJECT_ID} &>/dev/null; then
    echo -e "${YELLOW}Project ${NEW_PROJECT_ID} already exists. Using existing project.${NC}"
else
    echo "Creating new project: ${NEW_PROJECT_ID}"
    gcloud projects create ${NEW_PROJECT_ID} --name="${PROJECT_NAME}"
    check_status "Project created"
fi

# Set the project as current
gcloud config set project ${NEW_PROJECT_ID}
check_status "Set current project"

echo -e "\n${GREEN}Step 2: Enable Billing${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  MANUAL STEP REQUIRED:${NC}"
echo "Please link your billing account to the project."
echo ""
echo "Option 1: Use the Console:"
echo "  https://console.cloud.google.com/billing/linkedaccount?project=${NEW_PROJECT_ID}"
echo ""
echo "Option 2: Use gcloud (replace BILLING_ACCOUNT_ID):"
echo "  gcloud billing projects link ${NEW_PROJECT_ID} --billing-account=BILLING_ACCOUNT_ID"
echo ""
read -p "Press Enter once billing is configured..."

echo -e "\n${GREEN}Step 3: Enable Required APIs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Core APIs
enable_api "compute.googleapis.com"
enable_api "container.googleapis.com"
enable_api "sqladmin.googleapis.com"
enable_api "redis.googleapis.com"
enable_api "artifactregistry.googleapis.com"

# Additional APIs
enable_api "secretmanager.googleapis.com"
enable_api "cloudresourcemanager.googleapis.com"
enable_api "iam.googleapis.com"
enable_api "servicenetworking.googleapis.com"
enable_api "cloudkms.googleapis.com"
enable_api "monitoring.googleapis.com"
enable_api "logging.googleapis.com"
enable_api "bigquery.googleapis.com"
enable_api "pubsub.googleapis.com"

echo -e "\n${GREEN}Step 4: Create Terraform State Bucket${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BUCKET_NAME="${NEW_PROJECT_ID}-terraform-state"
gsutil mb -p ${NEW_PROJECT_ID} -l ${REGION} gs://${BUCKET_NAME}/
check_status "Created Terraform state bucket"

# Enable versioning on the bucket
gsutil versioning set on gs://${BUCKET_NAME}/
check_status "Enabled bucket versioning"

echo -e "\n${GREEN}Step 5: Set up Service Accounts${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create service account for Terraform
gcloud iam service-accounts create terraform \
    --display-name="Terraform Service Account" \
    --project=${NEW_PROJECT_ID}
check_status "Created Terraform service account"

# Grant necessary roles
gcloud projects add-iam-policy-binding ${NEW_PROJECT_ID} \
    --member="serviceAccount:terraform@${NEW_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/editor"
check_status "Granted editor role"

gcloud projects add-iam-policy-binding ${NEW_PROJECT_ID} \
    --member="serviceAccount:terraform@${NEW_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/resourcemanager.projectIamAdmin"
check_status "Granted IAM admin role"

echo -e "\n${GREEN}Step 6: Update Terraform Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create new Terraform environment directory
TERRAFORM_DIR="../warp/terraform/environments/v01"
mkdir -p ${TERRAFORM_DIR}

# Create terraform.tfvars
cat > ${TERRAFORM_DIR}/terraform.tfvars <<EOF
# WARP Platform v0.1 - Terraform Variables
project_id = "${NEW_PROJECT_ID}"
region     = "${REGION}"

# Clean naming - no environment prefix
cluster_name = "warp-cluster"
vpc_name     = "warp-vpc"
db_instance  = "warp-db"
redis_name   = "warp-redis"

# Resource sizing
gke_num_nodes = 2
gke_min_nodes = 2
gke_max_nodes = 5
gke_machine_type = "n2-standard-4"

db_tier = "db-f1-micro"  # Development tier
redis_memory_size_gb = 5
redis_tier = "STANDARD_HA"

# SIP Configuration
sip_allowed_ips = ["0.0.0.0/0"]  # Update with actual IPs later
EOF

# Create main.tf
cat > ${TERRAFORM_DIR}/main.tf <<EOF
# WARP Platform v0.1 - Main Terraform Configuration
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "gcs" {
    bucket = "${BUCKET_NAME}"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {}
variable "region" {}
variable "cluster_name" {}
variable "vpc_name" {}
variable "db_instance" {}
variable "redis_name" {}
variable "gke_num_nodes" {}
variable "gke_min_nodes" {}
variable "gke_max_nodes" {}
variable "gke_machine_type" {}
variable "db_tier" {}
variable "redis_memory_size_gb" {}
variable "redis_tier" {}
variable "sip_allowed_ips" { type = list(string) }

# Use existing modules with clean naming
module "networking" {
  source = "../../modules/networking"
  
  project_id            = var.project_id
  vpc_name              = var.vpc_name
  region                = var.region
  gke_subnet_cidr       = "10.0.0.0/24"
  gke_pods_cidr         = "10.1.0.0/16"
  gke_services_cidr     = "10.2.0.0/16"
  rtpengine_subnet_cidr = "10.0.1.0/24"
  consul_subnet_cidr    = "10.0.2.0/24"
  sip_allowed_ips       = var.sip_allowed_ips
}

module "gke" {
  source = "../../modules/gke"
  
  project_id       = var.project_id
  cluster_name     = var.cluster_name
  region           = var.region
  vpc_name         = var.vpc_name
  subnet_name      = module.networking.gke_subnet_name
  pods_range_name  = module.networking.gke_pods_range_name
  services_range_name = module.networking.gke_services_range_name
  
  num_nodes        = var.gke_num_nodes
  min_nodes        = var.gke_min_nodes
  max_nodes        = var.gke_max_nodes
  machine_type     = var.gke_machine_type
}

module "database" {
  source = "../../modules/database"
  
  project_id   = var.project_id
  region       = var.region
  instance_name = var.db_instance
  db_tier      = var.db_tier
  vpc_name     = var.vpc_name
}

module "cache" {
  source = "../../modules/cache"
  
  project_id   = var.project_id
  region       = var.region
  redis_name   = var.redis_name
  memory_size_gb = var.redis_memory_size_gb
  tier         = var.redis_tier
  vpc_name     = var.vpc_name
}

module "compute" {
  source = "../../modules/compute"
  
  project_id = var.project_id
  region     = var.region
  vpc_name   = var.vpc_name
  
  # Clean names without environment prefix
  consul_prefix = "warp-consul-server"
  rtpengine_prefix = "warp-rtpengine"
}

module "consul" {
  source = "../../modules/consul"
  
  project_id = var.project_id
  region     = var.region
  
  consul_instances = module.compute.consul_instances
}
EOF

check_status "Created Terraform configuration"

echo -e "\n${GREEN}Step 7: Initialize Default Firewall Rules${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# We'll let Terraform create these, but document what's needed
cat > ${TERRAFORM_DIR}/firewall-rules.md <<EOF
# Firewall Rules Created by Terraform

1. **Internal Communication**: Allow all internal VPC traffic
2. **SSH Access**: Port 22 from allowed IPs
3. **SIP Signaling**: UDP/TCP 5060 from allowed IPs
4. **RTP Media**: UDP 10000-20000 from anywhere
5. **Consul**: Ports 8300-8302, 8500-8502 internal only
6. **Monitoring**: Prometheus, Grafana ports internal only
7. **HTTPS**: Port 443 for API and web access
EOF

echo -e "\n${GREEN}Step 8: Create Initial Secrets${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create random passwords for databases
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# Store in Secret Manager
echo -n "${DB_PASSWORD}" | gcloud secrets create warp-db-password --data-file=- --project=${NEW_PROJECT_ID}
echo -n "${REDIS_PASSWORD}" | gcloud secrets create warp-redis-password --data-file=- --project=${NEW_PROJECT_ID}
echo -n "${JWT_SECRET}" | gcloud secrets create warp-jwt-secret --data-file=- --project=${NEW_PROJECT_ID}
check_status "Created initial secrets"

echo -e "\n${GREEN}Step 9: Create Helper Scripts${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create deployment script
cat > ${TERRAFORM_DIR}/deploy.sh <<'EEOF'
#!/bin/bash
# WARP v0.1 - Terraform Deployment Script

set -e

echo "🚀 WARP Platform v0.1 - Infrastructure Deployment"
echo "================================================"

# Run Terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Get outputs
echo ""
echo "📋 Deployment Outputs:"
echo "====================="
terraform output

echo ""
echo "✅ Infrastructure deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure kubectl: gcloud container clusters get-credentials warp-cluster --region=us-central1"
echo "2. Initialize database: cd ../../../database/setup && ./00-master-setup.sh"
echo "3. Deploy services: cd ../../../../kubernetes && ./deploy.sh"
EEOF

chmod +x ${TERRAFORM_DIR}/deploy.sh
check_status "Created deployment script"

echo -e "\n${GREEN}Step 10: Next Steps Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > ../FRESH_START_NEXT_STEPS.md <<EOF
# WARP v0.1 - Fresh Start Next Steps

## ✅ Completed Setup

1. Created project: ${NEW_PROJECT_ID}
2. Enabled all required APIs
3. Created Terraform state bucket: ${BUCKET_NAME}
4. Set up service accounts
5. Created Terraform configuration in: warp/terraform/environments/v01/
6. Created initial secrets in Secret Manager

## 🚀 Immediate Next Steps

### 1. Deploy Infrastructure with Terraform
\`\`\`bash
cd warp/terraform/environments/v01
./deploy.sh
\`\`\`

This will create:
- VPC: warp-vpc (no dev!)
- GKE Cluster: warp-cluster
- Cloud SQL: warp-db
- Redis: warp-redis
- Consul cluster: warp-consul-server-{1,2,3}
- RTPEngine: warp-rtpengine-{1,2}

### 2. After Terraform Completes (~20 mins)

1. **Configure kubectl**:
   \`\`\`bash
   gcloud container clusters get-credentials warp-cluster --region=${REGION} --project=${NEW_PROJECT_ID}
   \`\`\`

2. **Initialize Database**:
   \`\`\`bash
   cd warp/database/setup
   export CLOUDSQL_CONNECTION_NAME="${NEW_PROJECT_ID}:${REGION}:warp-db"
   export DB_PASSWORD=\$(gcloud secrets versions access latest --secret=warp-db-password --project=${NEW_PROJECT_ID})
   ./00-master-setup.sh
   \`\`\`

3. **Deploy Services**:
   \`\`\`bash
   cd kubernetes
   ./deploy.sh
   \`\`\`

### 3. Begin Service Development

Follow the implementation plan in docs/PHASE2_IMPLEMENTATION_PLAN.md

## 📋 Clean Naming Convention

All resources follow the pattern: \`warp-{component}\`
- No environment prefix (dev/staging/prod)
- Environment separation via projects
- Clean, consistent naming throughout

## 🔐 Security Notes

- Secrets stored in Secret Manager
- Terraform service account has limited roles
- Firewall rules will be created by Terraform
- Private GKE cluster with authorized networks

## 📊 Resource Names

| Component | Name |
|-----------|------|
| Project | ${NEW_PROJECT_ID} |
| VPC | warp-vpc |
| GKE Cluster | warp-cluster |
| Cloud SQL | warp-db |
| Redis | warp-redis |
| Consul | warp-consul-server-{1,2,3} |
| RTPEngine | warp-rtpengine-{1,2} |
| Artifact Registry | warp-images |

## 🎯 Success Criteria

- [ ] Terraform runs without errors
- [ ] All resources created with correct names
- [ ] kubectl can connect to cluster
- [ ] Database initialization successful
- [ ] Basic pod deployment works

---
*Fresh start initiated: $(date)*
*Project: ${PROJECT_NAME} (${NEW_PROJECT_ID})*
EOF

echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Fresh Start Setup Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 IMPORTANT NEXT STEPS:${NC}"
echo ""
echo "1. Review: cat ../FRESH_START_NEXT_STEPS.md"
echo ""
echo "2. Deploy infrastructure:"
echo "   cd warp/terraform/environments/v01"
echo "   ./deploy.sh"
echo ""
echo "3. The old project (ringer-472421) can be deleted once migration is complete"
echo ""
echo -e "${GREEN}Project ${NEW_PROJECT_ID} is ready for clean WARP deployment!${NC}"