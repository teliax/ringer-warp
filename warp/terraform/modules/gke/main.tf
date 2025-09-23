# GKE module for Kamailio control plane

resource "google_container_cluster" "kamailio_cluster" {
  name     = "${var.project_name}-kamailio-cluster"
  location = var.region
  project  = var.project_id

  # Use a separate node pool for better control
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = var.vpc_id
  subnetwork = var.gke_subnet_id

  # IP allocation for pods and services
  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  # Enable Workload Identity for secure service account access
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Network policy
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # Add-ons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  # Cluster autoscaling - disabled for initial creation
  # cluster_autoscaling {
  #   enabled = true
  #   resource_limits {
  #     resource_type = "cpu"
  #     minimum       = 4
  #     maximum       = 100
  #   }
  #   resource_limits {
  #     resource_type = "memory"
  #     minimum       = 16
  #     maximum       = 400
  #   }
  # }

  # Maintenance window
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }

  # Security
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus {
      enabled = true
    }
  }
}

# Node pool for Kamailio workloads
resource "google_container_node_pool" "kamailio_nodes" {
  name       = "${var.project_name}-kamailio-pool"
  location   = var.region
  cluster    = google_container_cluster.kamailio_cluster.name
  project    = var.project_id
  node_count = var.initial_node_count

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    preemptible  = var.use_preemptible
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = "pd-ssd"

    tags = ["kamailio", "sip-proxy", "gke-node"]

    labels = {
      environment = var.environment
      workload    = "kamailio"
    }

    # Service account for nodes
    service_account = google_service_account.kamailio_node_sa.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }
}

# Service account for Kamailio nodes
resource "google_service_account" "kamailio_node_sa" {
  account_id   = "${var.project_name}-kamailio-node-sa"
  display_name = "Kamailio Node Service Account"
  project      = var.project_id
}

# IAM bindings for node service account
resource "google_project_iam_member" "kamailio_node_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/storage.objectViewer"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.kamailio_node_sa.email}"
}

# Workload Identity service account for Kamailio pods
resource "google_service_account" "kamailio_workload_sa" {
  account_id   = "${var.project_name}-kamailio-workload"
  display_name = "Kamailio Workload Identity SA"
  project      = var.project_id
}

# IAM binding for Workload Identity
resource "google_service_account_iam_binding" "kamailio_workload_identity" {
  service_account_id = google_service_account.kamailio_workload_sa.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[kamailio/kamailio-sa]"
  ]
  
  depends_on = [google_container_cluster.kamailio_cluster]
}

# IAM roles for workload service account
resource "google_project_iam_member" "kamailio_workload_sa_roles" {
  for_each = toset([
    "roles/cloudtrace.agent",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter",
    "roles/secretmanager.secretAccessor"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.kamailio_workload_sa.email}"
}