# RTPEngine deployment using golden image
# This configuration deploys 3 RTPEngine instances using the pre-built golden image

# Use the updated compute module with golden image support
module "compute_golden" {
  source = "../../modules/compute"
  
  # Use the main-golden.tf file from the module
  # Note: In production, you might want to version your modules
  
  # Basic configuration
  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment
  
  # Network configuration
  vpc_id              = module.network.vpc_id
  rtpengine_subnet_id = module.network.subnet_ids["rtpengine"]
  
  # Golden image configuration
  use_golden_image    = true
  golden_image_family = "rtpengine-golden"
  
  # Instance configuration
  rtpengine_instance_count = 3
  rtpengine_machine_type  = "e2-standard-4"  # 4 vCPUs, 16GB RAM
  rtpengine_disk_size     = 50               # 50GB disk
  
  # RTP port configuration
  # Each instance gets 3333 ports: 
  # Instance 1: 10000-13332
  # Instance 2: 13333-16665  
  # Instance 3: 16666-19999
  rtp_port_min = 10000
  rtp_port_max = 19999
  
  # Consul configuration
  consul_servers    = module.consul.consul_server_ips
  consul_datacenter = "gcp-${var.region}"
  
  # Redis configuration
  redis_host = module.database.redis_endpoint
  redis_port = 6379
  
  # Logging
  rtpengine_log_level = 6
}

# Firewall rules for RTPEngine instances
resource "google_compute_firewall" "rtpengine_rtp" {
  name    = "${var.project_name}-rtpengine-rtp-golden"
  network = module.network.vpc_id
  project = var.project_id
  
  description = "Allow RTP media traffic to RTPEngine instances"
  
  allow {
    protocol = "udp"
    ports    = ["10000-19999"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["rtpengine", "allow-rtpengine-ports"]
}

resource "google_compute_firewall" "rtpengine_control" {
  name    = "${var.project_name}-rtpengine-control-golden"
  network = module.network.vpc_id
  project = var.project_id
  
  description = "Allow control protocol traffic to RTPEngine instances"
  
  allow {
    protocol = "tcp"
    ports    = ["2223"]
  }
  
  allow {
    protocol = "udp"
    ports    = ["2223"]
  }
  
  # Only allow from internal network and load balancers
  source_ranges = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "35.191.0.0/16",   # Google Cloud Load Balancer IPs
    "130.211.0.0/22"   # Google Cloud Health Check IPs
  ]
  
  target_tags = ["rtpengine"]
}

# Health check for load balancer
resource "google_compute_health_check" "rtpengine_lb" {
  name                = "${var.project_name}-rtpengine-lb-health-golden"
  check_interval_sec  = 5
  timeout_sec         = 3
  healthy_threshold   = 2
  unhealthy_threshold = 2
  project             = var.project_id
  
  tcp_health_check {
    port = "2223"
  }
}

# Backend service for load balancing
resource "google_compute_backend_service" "rtpengine" {
  name                  = "${var.project_name}-rtpengine-backend-golden"
  protocol              = "TCP"
  port_name             = "rtpengine-control"
  timeout_sec           = 10
  project               = var.project_id
  health_checks         = [google_compute_health_check.rtpengine_lb.id]
  load_balancing_scheme = "EXTERNAL"
  
  dynamic "backend" {
    for_each = module.compute_golden.rtpengine_instance_groups
    content {
      group = backend.value.instances[0]
    }
  }
}

# Outputs
output "rtpengine_instances" {
  value       = module.compute_golden.rtpengine_instances
  description = "Details of deployed RTPEngine instances"
}

output "rtpengine_deployment_commands" {
  value = {
    check_health = "gcloud compute ssh ${module.compute_golden.rtpengine_instances[0].name} --zone=${module.compute_golden.rtpengine_instances[0].zone} --command='sudo systemctl status rtpengine'"
    
    ssh_commands = {
      for idx, instance in module.compute_golden.rtpengine_instances :
      instance.name => "gcloud compute ssh ${instance.name} --zone=${instance.zone} --project=${var.project_id}"
    }
    
    test_rtpengine = "rtpengine-ctl -ip ${module.compute_golden.rtpengine_instances[0].external_ip} -port 2223 list"
  }
  description = "Useful commands for managing RTPEngine instances"
}

# Create a marker file to indicate golden image deployment
resource "local_file" "golden_deployment_marker" {
  filename = "${path.module}/.golden-deployment"
  content  = jsonencode({
    deployed_at = timestamp()
    instances   = module.compute_golden.rtpengine_instances
    image_family = "rtpengine-golden"
  })
}