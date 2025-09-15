# WARP Terraform Infrastructure

This directory contains the Infrastructure as Code (IaC) for the WARP platform using Terraform.

## Directory Structure

```
terraform/
├── modules/              # Reusable Terraform modules
│   ├── networking/       # VPC, subnets, firewall rules
│   ├── gke/              # Google Kubernetes Engine for Kamailio
│   ├── compute/          # GCP VMs for RTPEngine
│   ├── consul/           # Consul service discovery
│   ├── database/         # CockroachDB/PostgreSQL setup
│   └── monitoring/       # Monitoring and alerting
├── environments/         # Environment-specific configurations
│   ├── dev/              # Development environment
│   ├── staging/          # Staging environment
│   └── prod/             # Production environment
└── scripts/              # Helper scripts
```

## Prerequisites

1. **Google Cloud SDK**
   ```bash
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   ```

2. **Terraform**
   ```bash
   brew install terraform  # macOS
   # or
   wget https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip
   unzip terraform_1.5.7_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **GCP Project Setup**
   ```bash
   # Set your project ID
   export PROJECT_ID="your-project-id"
   gcloud config set project $PROJECT_ID

   # Enable required APIs
   gcloud services enable compute.googleapis.com
   gcloud services enable container.googleapis.com
   gcloud services enable redis.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable monitoring.googleapis.com
   gcloud services enable logging.googleapis.com
   ```

4. **Service Account for Terraform**
   ```bash
   # Create service account
   gcloud iam service-accounts create terraform \
     --display-name="Terraform Service Account"

   # Grant necessary roles
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:terraform@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/editor"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:terraform@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/resourcemanager.projectIamAdmin"

   # Create and download key
   gcloud iam service-accounts keys create terraform-key.json \
     --iam-account=terraform@$PROJECT_ID.iam.gserviceaccount.com

   # Set environment variable
   export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/terraform-key.json"
   ```

## Deployment

### Development Environment

1. **Initialize Terraform**
   ```bash
   cd environments/dev

   # Create state bucket
   gsutil mb gs://warp-terraform-state-dev
   gsutil versioning set on gs://warp-terraform-state-dev

   # Initialize Terraform
   terraform init
   ```

2. **Configure Variables**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. **Plan Deployment**
   ```bash
   terraform plan -out=tfplan
   ```

4. **Apply Configuration**
   ```bash
   terraform apply tfplan
   ```

5. **Configure kubectl**
   ```bash
   gcloud container clusters get-credentials warp-dev-kamailio-cluster \
     --region us-central1
   ```

### Production Environment

For production, additional steps are required:

1. **Network Security**
   - Restrict `sip_allowed_ips` to known carrier networks
   - Configure `master_authorized_networks` for GKE access
   - Enable Private Google Access

2. **High Availability**
   - Deploy across multiple zones
   - Increase instance counts
   - Configure regional resources

3. **Backup Strategy**
   - Enable automated backups
   - Configure backup retention policies
   - Test restore procedures

## Module Usage

### Networking Module
```hcl
module "networking" {
  source = "../../modules/networking"

  project_id    = var.project_id
  region        = var.region
  project_name  = "warp-prod"

  # Custom CIDR ranges
  gke_subnet_cidr       = "10.0.0.0/22"
  rtpengine_subnet_cidr = "10.0.4.0/22"
}
```

### GKE Module
```hcl
module "gke" {
  source = "../../modules/gke"

  project_id         = var.project_id
  vpc_id             = module.networking.vpc_id
  gke_subnet_id      = module.networking.gke_subnet_id

  # Production settings
  min_node_count     = 5
  max_node_count     = 20
  machine_type       = "n2-standard-8"
  use_preemptible    = false
}
```

### RTPEngine Module
```hcl
module "compute" {
  source = "../../modules/compute"

  rtpengine_instance_count = 10
  rtpengine_machine_type   = "n2-standard-8"

  # Performance tuning
  rtp_port_min = 10000
  rtp_port_max = 60000
}
```

## Operations

### Scaling RTPEngine
```bash
# Update instance count
terraform apply -var="rtpengine_instance_count=5"
```

### Updating Consul
```bash
# Rolling update of Consul servers
terraform apply -target=module.consul -var="consul_version=1.17.2"
```

### Destroying Resources
```bash
# Destroy specific module
terraform destroy -target=module.compute

# Destroy entire environment
terraform destroy
```

## Monitoring

### View Terraform State
```bash
terraform show
terraform state list
```

### Import Existing Resources
```bash
terraform import module.networking.google_compute_network.warp_vpc projects/$PROJECT_ID/global/networks/warp-vpc
```

## Troubleshooting

### Common Issues

1. **API Not Enabled**
   ```bash
   Error: googleapi: Error 403: Service Usage API has not been used
   Solution: gcloud services enable serviceusage.googleapis.com
   ```

2. **Insufficient Permissions**
   ```bash
   Error: googleapi: Error 403: Required 'compute.instances.create' permission
   Solution: Add missing IAM role to service account
   ```

3. **Resource Quotas**
   ```bash
   Error: Quota 'CPUS' exceeded
   Solution: Request quota increase in GCP Console
   ```

### State Management

```bash
# Backup state
terraform state pull > terraform.tfstate.backup

# Lock state
terraform force-unlock <lock-id>

# Move resources
terraform state mv module.old module.new
```

## Security Best Practices

1. **State File Security**
   - Always use remote state (GCS)
   - Enable state file encryption
   - Restrict bucket access

2. **Secrets Management**
   - Use Google Secret Manager
   - Never commit secrets to git
   - Rotate credentials regularly

3. **Network Security**
   - Use private subnets where possible
   - Implement firewall rules
   - Enable VPC Flow Logs

4. **IAM**
   - Use service accounts with minimal permissions
   - Enable Workload Identity for GKE
   - Audit IAM policies regularly

## Cost Optimization

1. **Development Environment**
   - Use preemptible instances
   - Smaller machine types
   - Destroy when not in use

2. **Production Environment**
   - Use committed use discounts
   - Right-size instances
   - Enable autoscaling

3. **Monitoring Costs**
   ```bash
   # View cost estimate
   terraform plan | grep "monthly cost"

   # Use GCP pricing calculator
   https://cloud.google.com/products/calculator
   ```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Terraform Plan
on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: hashicorp/setup-terraform@v2

      - name: Terraform Init
        run: terraform init
        working-directory: terraform/environments/dev

      - name: Terraform Plan
        run: terraform plan
        working-directory: terraform/environments/dev
```

## Support

For issues or questions:
1. Check the [PRD](../docs/PRD.md)
2. Review module documentation
3. Contact the platform team