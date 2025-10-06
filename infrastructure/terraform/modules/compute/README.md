# Compute Module - WARP Platform

## Overview

This Terraform module manages Compute Engine resources for the WARP platform, including VM instances for components that require kernel-level access or cannot be containerized.

## Current Deployments

### RTPEngine VMs

As of December 2024, RTPEngine is deployed using a golden image approach:

| Instance | Zone | Type | Status |
|----------|------|------|--------|
| rtpengine-prod-1 | us-central1-a | e2-standard-4 | ✅ Active |
| rtpengine-prod-2 | us-central1-b | e2-standard-4 | ✅ Active |
| rtpengine-prod-3 | us-central1-c | e2-standard-4 | ✅ Active |

**Golden Image**: `rtpengine-golden-image-v1-20241209`
- Built from source (RTPEngine mr13.4.1)
- Ubuntu 22.04 LTS base
- All dependencies pre-installed
- Optimized system settings

## Module Structure

```
compute/
├── main.tf           # VM instance definitions
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── README.md         # This file
└── scripts/
    └── rtpengine-startup.sh  # VM startup script
```

## Usage

### Basic Usage

```hcl
module "compute" {
  source = "../../modules/compute"
  
  project_id    = var.project_id
  region        = var.region
  network_name  = module.networking.network_name
  
  # RTPEngine configuration
  rtpengine_count        = 3
  rtpengine_machine_type = "e2-standard-4"
  rtpengine_image        = "rtpengine-golden-image-v1-20241209"
}
```

### Golden Image Deployment

For RTPEngine, we use golden images instead of startup scripts:

```hcl
# RTPEngine instances using golden image
resource "google_compute_instance" "rtpengine" {
  count = var.rtpengine_count
  
  name         = "rtpengine-prod-${count.index + 1}"
  machine_type = var.rtpengine_machine_type
  zone         = data.google_compute_zones.available.names[count.index]
  
  boot_disk {
    initialize_params {
      image = "projects/${var.project_id}/global/images/${var.rtpengine_image}"
      size  = 100
      type  = "pd-ssd"
    }
  }
  
  network_interface {
    network    = var.network_name
    subnetwork = var.subnetwork_name
    
    # Static internal IP for consistent configuration
    network_ip = cidrhost(var.subnet_cidr, 10 + count.index)
  }
  
  metadata = {
    startup-script = file("${path.module}/scripts/rtpengine-startup.sh")
  }
  
  tags = ["rtpengine", "allow-health-check"]
  
  service_account {
    scopes = ["cloud-platform"]
  }
}
```

## Golden Image Management

### Creating New Golden Image

1. **Create base VM**:
```bash
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image
./gcloud/create-golden-vm.sh
```

2. **Create image from VM**:
```bash
./gcloud/create-golden-image.sh
```

3. **Update Terraform**:
```hcl
variable "rtpengine_image" {
  default = "rtpengine-golden-image-v2-YYYYMMDD"
}
```

### Rolling Updates

To update RTPEngine instances:

1. Create new golden image with updates
2. Update the image variable in terraform
3. Apply changes with instance replacement:

```bash
terraform plan -target=module.compute.google_compute_instance.rtpengine
terraform apply -target=module.compute.google_compute_instance.rtpengine
```

## Variables

| Name | Description | Type | Default |
|------|-------------|------|---------|
| project_id | GCP project ID | string | - |
| region | GCP region | string | us-central1 |
| network_name | VPC network name | string | - |
| rtpengine_count | Number of RTPEngine instances | number | 3 |
| rtpengine_machine_type | Machine type for RTPEngine | string | e2-standard-4 |
| rtpengine_image | Golden image for RTPEngine | string | - |
| rtpengine_disk_size | Boot disk size in GB | number | 100 |

## Outputs

| Name | Description |
|------|-------------|
| rtpengine_instances | List of RTPEngine instance details |
| rtpengine_internal_ips | Internal IPs of RTPEngine instances |
| rtpengine_zones | Zones where RTPEngine instances are deployed |

## Firewall Rules

The module creates the following firewall rules:

```hcl
# RTP media ports
resource "google_compute_firewall" "rtpengine_rtp" {
  name    = "allow-rtpengine-rtp"
  network = var.network_name
  
  allow {
    protocol = "udp"
    ports    = ["30000-40000"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["rtpengine"]
}

# Control protocol from Kamailio
resource "google_compute_firewall" "rtpengine_ng" {
  name    = "allow-rtpengine-ng"
  network = var.network_name
  
  allow {
    protocol = "tcp"
    ports    = ["22222"]
  }
  
  source_tags = ["kamailio"]
  target_tags = ["rtpengine"]
}
```

## Health Checks

Health check configuration for load balancing:

```hcl
resource "google_compute_health_check" "rtpengine" {
  name = "rtpengine-health-check"
  
  tcp_health_check {
    port = "22222"
  }
  
  check_interval_sec  = 10
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3
}
```

## Monitoring

RTPEngine instances export metrics to Prometheus:

- **Metrics endpoint**: http://INSTANCE_IP:8080/metrics
- **Key metrics**:
  - rtpengine_sessions_created_total
  - rtpengine_sessions_active
  - rtpengine_packets_sent/received
  - rtpengine_cpu_usage

## Maintenance

### Viewing Instances

```bash
# List all RTPEngine instances
gcloud compute instances list --filter="name:rtpengine-prod"

# SSH to instance
gcloud compute ssh rtpengine-prod-1 --zone=us-central1-a
```

### Service Management

```bash
# Check service status
sudo systemctl status rtpengine

# View logs
sudo journalctl -u rtpengine -f

# Restart service
sudo systemctl restart rtpengine
```

### Updating Configuration

1. Update `/etc/rtpengine/rtpengine.conf` on instance
2. Reload service: `sudo systemctl reload rtpengine`

## Future Improvements

1. **Managed Instance Groups**
   - Auto-scaling based on load
   - Automatic health checks
   - Rolling updates

2. **Terraform Automation**
   - Image building in Terraform
   - Automated testing
   - Blue/green deployments

3. **Enhanced Monitoring**
   - Custom dashboards
   - SLO tracking
   - Automated remediation

## Related Documentation

- [RTPEngine Deployment Guide](/docs/rtpengine-deployment.md)
- [Golden Image Scripts](/rtpengine/golden-image/README.md)
- [Platform Deployment Guide](/docs/DEPLOYMENT.md)

---

Last Updated: December 9, 2024