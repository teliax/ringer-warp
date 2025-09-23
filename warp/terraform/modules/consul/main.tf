# Consul module for service discovery and configuration management

# Consul server instances
resource "google_compute_instance" "consul_server" {
  count        = var.consul_server_count
  name         = "${var.project_name}-consul-server-${count.index + 1}"
  machine_type = var.consul_machine_type
  zone         = data.google_compute_zones.available.names[count.index % length(data.google_compute_zones.available.names)]
  project      = var.project_id

  tags = ["consul", "consul-server"]

  boot_disk {
    initialize_params {
      image = var.consul_image
      size  = var.consul_disk_size
      type  = "pd-ssd"
    }
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.consul_subnet_id

    access_config {
      // Ephemeral public IP
    }
  }

  service_account {
    email  = google_service_account.consul_sa.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = templatefile("${path.module}/scripts/consul-server-startup.sh", {
    consul_version     = var.consul_version
    datacenter         = var.consul_datacenter
    server_count       = var.consul_server_count
    instance_index     = count.index + 1
    encrypt_key        = random_id.consul_encrypt.b64_std
    project_id         = var.project_id
    PROJECT_ID         = var.project_id
    consul_ui          = var.enable_consul_ui
  })

  metadata = {
    enable-oslogin = "TRUE"
    consul-role    = "server"
  }

  labels = {
    environment = var.environment
    service     = "consul"
    role        = "server"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                  = true
    enable_integrity_monitoring = true
  }

  allow_stopping_for_update = true
}

# Generate encryption key for Consul gossip
resource "random_id" "consul_encrypt" {
  byte_length = 32
}

# Service account for Consul
resource "google_service_account" "consul_sa" {
  account_id   = "${var.project_name}-consul-sa"
  display_name = "Consul Service Account"
  project      = var.project_id
}

# IAM roles for Consul service account
resource "google_project_iam_member" "consul_sa_roles" {
  for_each = toset([
    "roles/compute.viewer",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.consul_sa.email}"
}

# Internal load balancer for Consul servers
resource "google_compute_region_backend_service" "consul_backend" {
  name                  = "${var.project_name}-consul-backend"
  region                = var.region
  protocol              = "TCP"
  load_balancing_scheme = "INTERNAL"
  project               = var.project_id

  health_checks = [google_compute_health_check.consul.id]

  dynamic "backend" {
    for_each = { for idx, ig in google_compute_instance_group.consul_server : idx => ig if idx < var.consul_server_count }
    content {
      group = backend.value.self_link
    }
  }
}

# Health check for Consul
resource "google_compute_health_check" "consul" {
  name                = "${var.project_name}-consul-health"
  check_interval_sec  = 5
  timeout_sec         = 3
  healthy_threshold   = 2
  unhealthy_threshold = 2
  project             = var.project_id

  tcp_health_check {
    port = "8500"
  }
}

# Instance groups for Consul servers
resource "google_compute_instance_group" "consul_server" {
  count   = length(data.google_compute_zones.available.names)
  name    = "${var.project_name}-consul-ig-${data.google_compute_zones.available.names[count.index]}"
  zone    = data.google_compute_zones.available.names[count.index]
  project = var.project_id

  instances = [
    for idx, instance in google_compute_instance.consul_server :
    instance.self_link if instance.zone == data.google_compute_zones.available.names[count.index]
  ]

  named_port {
    name = "consul-ui"
    port = 8500
  }

  named_port {
    name = "consul-rpc"
    port = 8300
  }

  named_port {
    name = "consul-serf"
    port = 8301
  }

  named_port {
    name = "consul-dns"
    port = 8600
  }
}

# Forwarding rule for internal load balancer
resource "google_compute_forwarding_rule" "consul" {
  name                  = "${var.project_name}-consul-forwarding"
  region                = var.region
  load_balancing_scheme = "INTERNAL"
  backend_service       = google_compute_region_backend_service.consul_backend.id
  all_ports             = true
  network               = var.vpc_id
  subnetwork            = var.consul_subnet_id
  project               = var.project_id
}

# DNS zone for Consul service discovery
resource "google_dns_managed_zone" "consul" {
  count       = var.create_dns_zone ? 1 : 0
  name        = "${var.project_name}-consul-zone"
  dns_name    = "consul.${var.dns_domain}."
  description = "DNS zone for Consul service discovery"
  project     = var.project_id

  visibility = "private"

  private_visibility_config {
    networks {
      network_url = var.vpc_id
    }
  }
}

# DNS record for Consul cluster
resource "google_dns_record_set" "consul_cluster" {
  count        = var.create_dns_zone ? 1 : 0
  name         = "consul-cluster.${google_dns_managed_zone.consul[0].dns_name}"
  managed_zone = google_dns_managed_zone.consul[0].name
  type         = "A"
  ttl          = 300
  project      = var.project_id

  rrdatas = google_compute_instance.consul_server[*].network_interface[0].network_ip
}

# Secret for Consul encryption key
resource "google_secret_manager_secret" "consul_encrypt_key" {
  secret_id = "${var.project_name}-consul-encrypt-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "consul_encrypt_key" {
  secret      = google_secret_manager_secret.consul_encrypt_key.id
  secret_data = random_id.consul_encrypt.b64_std
}

# Data source for available zones
data "google_compute_zones" "available" {
  region  = var.region
  project = var.project_id
}