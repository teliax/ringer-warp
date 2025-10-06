# Compute module for RTPEngine VMs with Consul integration and Golden Image support

# Static IP addresses for RTPEngine instances
resource "google_compute_address" "rtpengine_ips" {
  count        = var.rtpengine_instance_count
  name         = "${var.project_name}-rtpengine-ip-${count.index + 1}"
  address_type = "EXTERNAL"
  region       = var.region
  project      = var.project_id
}

# Data source for golden image (only if using golden image)
data "google_compute_image" "rtpengine_golden" {
  count   = var.use_golden_image ? 1 : 0
  family  = var.golden_image_family
  project = var.project_id
}

# Instance template for RTPEngine VMs (only used for non-golden image deployments)
resource "google_compute_instance_template" "rtpengine" {
  count        = var.use_golden_image ? 0 : 1
  name_prefix  = "${var.project_name}-rtpengine-"
  machine_type = var.rtpengine_machine_type
  region       = var.region
  project      = var.project_id

  tags = ["rtpengine", "consul-client"]

  disk {
    source_image = var.rtpengine_image
    auto_delete  = true
    boot         = true
    disk_size_gb = var.rtpengine_disk_size
    disk_type    = "pd-ssd"
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.rtpengine_subnet_id
  }

  service_account {
    email  = google_service_account.rtpengine_sa.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = templatefile("${path.module}/scripts/rtpengine-startup.sh", {
    consul_servers     = join(",", var.consul_servers)
    datacenter         = var.consul_datacenter
    rtp_port_min       = var.rtp_port_min
    rtp_port_max       = var.rtp_port_max
    redis_host         = var.redis_host
    redis_port         = var.redis_port
    project_id         = var.project_id
    log_level          = var.rtpengine_log_level
    instance_index     = "0"  # Will be set dynamically by instance group
    external_ip        = "0.0.0.0"  # Will be set dynamically
    internal_ip        = "0.0.0.0"  # Will be set dynamically
  })

  metadata = {
    enable-oslogin = "TRUE"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                  = true
    enable_integrity_monitoring = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RTPEngine instances
resource "google_compute_instance" "rtpengine" {
  count        = var.rtpengine_instance_count
  name         = "${var.project_name}-rtpengine-${count.index + 1}"
  machine_type = var.rtpengine_machine_type
  zone         = data.google_compute_zones.available.names[count.index % length(data.google_compute_zones.available.names)]
  project      = var.project_id

  tags = ["rtpengine", "consul-client", "allow-ssh", "allow-rtpengine-ports"]

  boot_disk {
    initialize_params {
      # Use golden image if specified, otherwise use standard image
      image = var.use_golden_image ? data.google_compute_image.rtpengine_golden[0].self_link : var.rtpengine_image
      size  = var.rtpengine_disk_size
      type  = "pd-ssd"
    }
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.rtpengine_subnet_id

    access_config {
      nat_ip = google_compute_address.rtpengine_ips[count.index].address
    }
  }

  service_account {
    email  = google_service_account.rtpengine_sa.email
    scopes = ["cloud-platform"]
  }

  # Use different startup scripts for golden vs standard images
  metadata_startup_script = var.use_golden_image ? templatefile("${path.module}/scripts/golden-instance-config.sh", {
    instance_num       = count.index + 1
    instance_name      = "${var.project_name}-rtpengine-${count.index + 1}"
    internal_ip        = "WILL_BE_AUTO_ASSIGNED"  # GCP assigns IP from subnet automatically
    external_ip        = google_compute_address.rtpengine_ips[count.index].address
    consul_servers     = join(",", var.consul_servers)
    datacenter         = var.consul_datacenter
    redis_host         = var.redis_host
    redis_port         = var.redis_port
    rtp_port_min       = var.rtp_port_min + (count.index * 3333)
    rtp_port_max       = var.rtp_port_min + ((count.index + 1) * 3333) - 1
  }) : templatefile("${path.module}/scripts/rtpengine-startup.sh", {
    consul_servers     = join(",", var.consul_servers)
    datacenter         = var.consul_datacenter
    instance_index     = count.index + 1
    external_ip        = google_compute_address.rtpengine_ips[count.index].address
    rtp_port_min       = var.rtp_port_min
    rtp_port_max       = var.rtp_port_max
    redis_host         = var.redis_host
    redis_port         = var.redis_port
    project_id         = var.project_id
    log_level          = var.rtpengine_log_level
  })

  metadata = {
    enable-oslogin     = "TRUE"
    consul-service     = "rtpengine"
    serial-port-enable = "TRUE"
    deployment-type    = var.use_golden_image ? "golden-image" : "standard"
  }

  labels = {
    environment = var.environment
    service     = "rtpengine"
    index       = count.index + 1
    deployment  = var.use_golden_image ? "golden-image" : "standard"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                  = true
    enable_integrity_monitoring = true
  }

  allow_stopping_for_update = true
}

# Service account for RTPEngine instances
resource "google_service_account" "rtpengine_sa" {
  account_id   = "${var.project_name}-rtpengine-sa"
  display_name = "RTPEngine Service Account"
  project      = var.project_id
}

# IAM roles for RTPEngine service account
resource "google_project_iam_member" "rtpengine_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent",
    "roles/secretmanager.secretAccessor"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.rtpengine_sa.email}"
}

# Health check for RTPEngine instances
resource "google_compute_health_check" "rtpengine" {
  name                = "${var.project_name}-rtpengine-health"
  check_interval_sec  = 10
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3
  project             = var.project_id

  tcp_health_check {
    port = "2223"
  }
}

# Instance group for RTPEngine (unmanaged)
resource "google_compute_instance_group" "rtpengine" {
  count     = length(data.google_compute_zones.available.names)
  name      = "${var.project_name}-rtpengine-ig-${data.google_compute_zones.available.names[count.index]}"
  zone      = data.google_compute_zones.available.names[count.index]
  project   = var.project_id

  instances = [
    for idx, instance in google_compute_instance.rtpengine :
    instance.self_link if instance.zone == data.google_compute_zones.available.names[count.index]
  ]

  named_port {
    name = "rtpengine-control"
    port = 2223
  }
}

# Data source for available zones
data "google_compute_zones" "available" {
  region  = var.region
  project = var.project_id
}

# Outputs
output "rtpengine_instances" {
  value = [
    for idx, instance in google_compute_instance.rtpengine : {
      name         = instance.name
      zone         = instance.zone
      internal_ip  = instance.network_interface[0].network_ip
      external_ip  = google_compute_address.rtpengine_ips[idx].address
      machine_type = instance.machine_type
      deployment   = var.use_golden_image ? "golden-image" : "standard"
    }
  ]
  description = "Details of RTPEngine instances"
}

output "rtpengine_instance_groups" {
  value = {
    for ig in google_compute_instance_group.rtpengine :
    ig.name => {
      zone      = ig.zone
      instances = ig.instances
    }
  }
  description = "RTPEngine instance groups by zone"
}

output "service_account_email" {
  value       = google_service_account.rtpengine_sa.email
  description = "Email of the RTPEngine service account"
}