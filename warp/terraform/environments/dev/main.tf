# Main Terraform configuration for WARP - Development Environment

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

  # Backend configuration for state storage
  backend "gcs" {
    bucket = "warp-terraform-state-dev"
    prefix = "terraform/state"
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Local variables
locals {
  environment = "dev"
  project_name = "warp-${local.environment}"
}

# Network module
module "networking" {
  source = "../../modules/networking"

  project_id               = var.project_id
  project_name             = local.project_name
  region                   = var.region
  gke_subnet_cidr          = "10.0.0.0/24"
  gke_pods_cidr            = "10.1.0.0/16"
  gke_services_cidr        = "10.2.0.0/16"
  rtpengine_subnet_cidr    = "10.0.1.0/24"
  consul_subnet_cidr       = "10.0.2.0/24"
  sip_allowed_ips          = var.sip_allowed_ips
}

# Consul module for service discovery
module "consul" {
  source = "../../modules/consul"

  project_id           = var.project_id
  project_name         = local.project_name
  region               = var.region
  environment          = local.environment
  vpc_id               = module.networking.vpc_id
  consul_subnet_id     = module.networking.consul_subnet_id
  consul_server_count  = 3
  consul_machine_type  = "n2-standard-2"
  consul_disk_size     = 50
  consul_version       = "1.17.1"
  consul_datacenter    = "gcp-${var.region}"
  enable_consul_ui     = true
  create_dns_zone      = true
  dns_domain           = "${local.environment}.warp.internal"
}

# GKE cluster for Kamailio
module "gke" {
  source = "../../modules/gke"

  project_id                 = var.project_id
  project_name               = local.project_name
  region                     = var.region
  environment                = local.environment
  vpc_id                     = module.networking.vpc_id
  gke_subnet_id              = module.networking.gke_subnet_id
  initial_node_count         = 2
  min_node_count             = 2
  max_node_count             = 5
  machine_type               = "n2-standard-4"
  disk_size_gb               = 100
  use_preemptible            = true  # Cost savings for dev
  master_authorized_networks = var.master_authorized_networks
}

# Redis instance for caching and state
resource "google_redis_instance" "cache" {
  name           = "${local.project_name}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 5
  region         = var.region
  redis_version  = "REDIS_7_0"

  authorized_network = module.networking.vpc_id

  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = "ONE_HOUR"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
      }
    }
  }
}

# RTPEngine instances
module "compute" {
  source = "../../modules/compute"

  project_id               = var.project_id
  project_name             = local.project_name
  region                   = var.region
  environment              = local.environment
  vpc_id                   = module.networking.vpc_id
  rtpengine_subnet_id      = module.networking.rtpengine_subnet_id
  rtpengine_instance_count = 2  # Reduced for dev
  rtpengine_machine_type   = "n2-standard-2"  # Smaller for dev
  rtpengine_disk_size      = 50
  rtpengine_log_level      = 7  # Debug logging for dev
  rtp_port_min             = 10000
  rtp_port_max             = 20000  # Reduced range for dev
  consul_servers           = module.consul.consul_server_ips
  consul_datacenter        = module.consul.consul_datacenter
  redis_host               = google_redis_instance.cache.host
  redis_port               = google_redis_instance.cache.port
}

# Service networking for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${local.project_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = module.networking.vpc_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = module.networking.vpc_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Cloud SQL for CockroachDB (using PostgreSQL in dev for simplicity)
resource "google_sql_database_instance" "main" {
  name             = "${local.project_name}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = "db-f1-micro"  # Small instance for dev

    ip_configuration {
      ipv4_enabled    = false
      private_network = module.networking.vpc_id
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 3
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = false  # Allow deletion in dev
}

resource "google_sql_database" "warp" {
  name     = "warp"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "warp" {
  name     = "warp"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store database password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${local.project_name}-db-password"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# GCS buckets for backups and recordings
resource "google_storage_bucket" "backups" {
  name     = "${var.project_id}-${local.project_name}-backups"
  location = var.region

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  versioning {
    enabled = true
  }
}

resource "google_storage_bucket" "recordings" {
  name     = "${var.project_id}-${local.project_name}-recordings"
  location = var.region

  lifecycle_rule {
    condition {
      age = 7  # Short retention for dev
    }
    action {
      type = "Delete"
    }
  }
}

# Google Artifact Registry for container images
resource "google_artifact_registry_repository" "warp_images" {
  location      = var.region
  repository_id = "${local.project_name}-images"
  description   = "Docker repository for WARP container images"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }
}

# Grant GKE service account access to Artifact Registry
resource "google_artifact_registry_repository_iam_member" "gke_pull" {
  location   = google_artifact_registry_repository.warp_images.location
  repository = google_artifact_registry_repository.warp_images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${module.gke.node_service_account}"
}

# Monitoring workspace
resource "google_monitoring_dashboard" "warp" {
  dashboard_json = file("${path.module}/dashboards/main.json")
}

# Outputs
output "gke_cluster_name" {
  value = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  value     = module.gke.cluster_endpoint
  sensitive = true
}

output "consul_ui_url" {
  value = module.consul.consul_ui_url
}

output "rtpengine_ips" {
  value = module.compute.rtpengine_external_ips
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "database_connection" {
  value     = "postgresql://warp:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}/warp"
  sensitive = true
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.warp_images.repository_id}"
}

output "next_steps" {
  value = <<-EOT
    Development environment deployed successfully!

    Next steps:
    1. Configure kubectl:
       gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${var.region} --project ${var.project_id}

    2. Configure Docker for Artifact Registry:
       gcloud auth configure-docker ${var.region}-docker.pkg.dev

    3. Access Consul UI:
       ${module.consul.consul_ui_url}

    4. Build and push container images:
       docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.warp_images.repository_id}/kamailio:latest .
       docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.warp_images.repository_id}/kamailio:latest

    5. Deploy Kamailio to GKE:
       kubectl apply -k ../../../kubernetes/overlays/dev/

    6. Test SIP connectivity:
       RTPEngine IPs: ${join(", ", module.compute.rtpengine_external_ips)}
  EOT
}