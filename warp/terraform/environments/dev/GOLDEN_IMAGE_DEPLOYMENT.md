# RTPEngine Golden Image Deployment with Terraform

This document provides comprehensive instructions for deploying RTPEngine VMs using the golden image approach integrated with Terraform infrastructure.

## Overview

The golden image deployment strategy provides:
- **Faster deployment**: Pre-installed and configured RTPEngine
- **Consistency**: All instances start from the same base configuration
- **Reduced startup time**: No need to install packages during VM startup
- **Version control**: Golden images can be versioned and rolled back
- **Cost efficiency**: Reduced compute time during deployment

## Architecture

```
┌─────────────────────────┐
│   Golden VM Creation    │
│  (warp-rtpengine-golden)│
└────────┬────────────────┘
         │
    Install & Configure
         │
         ▼
┌─────────────────────────┐
│    Golden Image         │
│ (rtpengine-golden-image)│
└────────┬────────────────┘
         │
    Terraform Deploy
         │
    ┌────┴────┬────────┐
    ▼         ▼        ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ RTPEngine│ │ RTPEngine│ │ RTPEngine│
│ VM 1     │ │ VM 2     │ │ VM 3     │
│ Zone: a  │ │ Zone: b  │ │ Zone: c  │
└─────────┘ └─────────┘ └─────────┘
```

## Prerequisites

1. **GCP Project**: ringer-warp-v01 with appropriate permissions
2. **Tools**:
   - gcloud CLI authenticated and configured
   - Terraform >= 1.5.0
   - Bash shell
3. **Network**: VPC and subnets already created by Terraform
4. **Dependencies**: Redis and Consul instances running

## Directory Structure

```
ringer-warp/
├── rtpengine/golden-image/          # Golden image scripts
│   ├── gcloud/                      # GCP-specific scripts
│   │   ├── create-golden-vm.sh
│   │   ├── create-golden-image.sh
│   │   ├── deploy-rtpengine-vms.sh
│   │   └── delete-old-vms.sh
│   └── install-rtpengine-golden.sh  # RTPEngine installation
│
└── warp/terraform/
    ├── modules/compute/             # Compute module
    │   ├── main.tf                  # Updated with golden image support
    │   ├── variables.tf             # Added golden image variables
    │   └── scripts/
    │       └── golden-instance-config.sh
    └── environments/dev/
        ├── rtpengine-golden.tf      # Golden image deployment config
        └── deploy-golden-rtpengine.sh  # Orchestration script
```

## Deployment Process

### Option 1: Full Automated Deployment

Use the orchestration script for a complete deployment:

```bash
cd /home/daldworth/repos/ringer-warp/warp/terraform/environments/dev
./deploy-golden-rtpengine.sh
```

Select option 1 for full deployment, which will:
1. Create golden VM
2. Install RTPEngine
3. Create golden image
4. Deploy 3 production VMs using Terraform

### Option 2: Step-by-Step Manual Deployment

#### Step 1: Create Golden VM

```bash
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image
./gcloud/create-golden-vm.sh
```

#### Step 2: Install RTPEngine on Golden VM

```bash
# SSH into golden VM
gcloud compute ssh warp-rtpengine-golden --zone=us-central1-a --project=ringer-warp-v01

# Run installation script
sudo ./install-rtpengine-golden.sh
```

#### Step 3: Create Golden Image

```bash
./gcloud/create-golden-image.sh
```

#### Step 4: Deploy with Terraform

```bash
cd /home/daldworth/repos/ringer-warp/warp/terraform/environments/dev

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="use_golden_image=true" -var="rtpengine_instance_count=3"

# Apply deployment
terraform apply -var="use_golden_image=true" -var="rtpengine_instance_count=3"
```

## Terraform Configuration

### Module Updates

The compute module has been updated to support golden images:

```hcl
module "compute" {
  source = "../../modules/compute"
  
  # ... other configuration ...
  
  # Enable golden image deployment
  use_golden_image    = true
  golden_image_family = "rtpengine-golden"
}
```

### Key Variables

- `use_golden_image`: Boolean to enable golden image deployment
- `golden_image_family`: Image family name (default: "rtpengine-golden")
- `rtpengine_instance_count`: Number of instances to deploy (default: 3)

### Instance Configuration

Each instance gets:
- **Unique port range**: 
  - Instance 1: 10000-13332
  - Instance 2: 13333-16665
  - Instance 3: 16666-19999
- **Zone distribution**: Spread across us-central1-a, b, and c
- **Static external IP**: Pre-allocated for consistency

## Verification

### 1. Check Deployment Status

```bash
# Using the deployment script
./deploy-golden-rtpengine.sh
# Select option 5

# Or manually
gcloud compute instances list --filter="name:warp-rtpengine-*"
```

### 2. Verify RTPEngine Service

```bash
# SSH into an instance
gcloud compute ssh warp-rtpengine-1 --zone=us-central1-a

# Check service status
sudo systemctl status rtpengine

# Check logs
sudo journalctl -u rtpengine -n 100
```

### 3. Test Control Protocol

```bash
# From another VM or locally with rtpengine-ctl
rtpengine-ctl -ip <EXTERNAL_IP> -port 2223 list
```

### 4. Check Consul Registration

```bash
# From Consul UI or CLI
consul members
consul catalog services
```

## Updating the Deployment

### Update Golden Image

1. Create new golden VM
2. Make necessary changes
3. Create new golden image
4. Update Terraform to use new image

### Rolling Updates

```bash
# Update instances one by one
terraform apply -target=module.compute.google_compute_instance.rtpengine[0]
terraform apply -target=module.compute.google_compute_instance.rtpengine[1]
terraform apply -target=module.compute.google_compute_instance.rtpengine[2]
```

## Rollback Procedure

### Using Previous Golden Image

```bash
# List available images
gcloud compute images list --filter="family:rtpengine-golden"

# Update Terraform to use specific image
terraform apply -var="rtpengine_image=rtpengine-golden-image-20240115-120000"
```

### Terraform State Rollback

```bash
# Restore from backup
cp terraform.tfstate.backup.<timestamp> terraform.tfstate
terraform refresh
```

## Monitoring and Health Checks

### Terraform Outputs

After deployment, Terraform provides useful outputs:

```bash
terraform output rtpengine_instances
terraform output rtpengine_deployment_commands
```

### Health Check Script

```bash
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image/gcloud
./check-rtpengine-health.sh
```

## Troubleshooting

### Common Issues

1. **Golden image not found**
   - Verify image family: `gcloud compute images list --filter="family:rtpengine-golden"`
   - Check project ID in scripts

2. **Terraform state conflicts**
   - Run `terraform refresh`
   - Check for manual changes outside Terraform

3. **RTPEngine not starting**
   - Check startup script logs: `/var/log/rtpengine-deploy.log`
   - Verify network configuration

4. **Port conflicts**
   - Ensure port ranges don't overlap
   - Check firewall rules

### Debug Commands

```bash
# Check instance metadata
gcloud compute instances describe warp-rtpengine-1 --zone=us-central1-a

# View startup script output
gcloud compute instances get-serial-port-output warp-rtpengine-1 --zone=us-central1-a

# Check Terraform state
terraform state show module.compute.google_compute_instance.rtpengine[0]
```

## Best Practices

1. **Version Control**: Tag golden images with version numbers
2. **Testing**: Always test golden images in dev before production
3. **Documentation**: Document changes made to golden images
4. **Backup**: Keep previous golden images for rollback
5. **Automation**: Use CI/CD for golden image creation

## Security Considerations

1. **Service Account**: Limited permissions for RTPEngine VMs
2. **Firewall Rules**: Restricted to necessary ports
3. **SSH Access**: OS Login enabled for audit trail
4. **Shielded VMs**: Secure boot, vTPM, and integrity monitoring

## Cost Optimization

1. **Preemptible VMs**: Consider for dev/test environments
2. **Right-sizing**: Monitor CPU/memory usage and adjust
3. **Committed Use**: For production workloads
4. **Image Cleanup**: Delete old unused golden images

## Next Steps

1. Set up monitoring dashboards
2. Configure alerting for health checks
3. Implement automated golden image updates
4. Create runbooks for common operations
5. Set up backup and disaster recovery

## Support

For issues or questions:
1. Check logs in `/var/log/rtpengine-*`
2. Review Terraform state and outputs
3. Consult RTPEngine documentation
4. Contact the infrastructure team

---

Last Updated: January 2024
Maintained by: Infrastructure Team