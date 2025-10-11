# GKE module for Kamailio control plane

resource "google_container_cluster" "warp_cluster" {
  name     = "${var.project_name}-cluster"
  location = var.region
  project  = var.project_id

  # Allow cluster deletion
  deletion_protection = false

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

  # Private cluster configuration (required for Cloud NAT with static IP)
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # Keep public endpoint for kubectl access
    master_ipv4_cidr_block  = "192.168.100.0/28"  # Private range, /28 = 16 IPs for master
  }

  # Enable Workload Identity for secure service account access
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Network policy - disabled for private cluster (has built-in isolation)
  # network_policy {
  #   enabled  = true
  #   provider = "CALICO"
  # }

  # Add-ons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    # network_policy_config {
    #   disabled = false
    # }
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

  # Commented out - causing Terraform validation error with private clusters
  # Use gcloud to manage authorized networks post-creation if needed
  # master_authorized_networks_config {
  #   dynamic "cidr_blocks" {
  #     for_each = var.master_authorized_networks
  #     content {
  #       cidr_block   = cidr_blocks.value.cidr_block
  #       display_name = cidr_blocks.value.display_name
  #     }
  #   }
  # }

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

# Node pool for WARP workloads
resource "google_container_node_pool" "warp_nodes" {
  name       = "${var.project_name}-node-pool"
  location   = var.region
  cluster    = google_container_cluster.warp_cluster.name
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

    tags = ["warp-platform", "gke-node"]

    labels = {
      environment = var.environment
      workload    = "warp-platform"
    }

    # Service account for nodes
    service_account = google_service_account.warp_node_sa.email
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

# Service account for WARP nodes
resource "google_service_account" "warp_node_sa" {
  account_id   = "${var.project_name}-node-sa"
  display_name = "WARP Platform Node Service Account"
  project      = var.project_id
}

# IAM bindings for node service account
resource "google_project_iam_member" "warp_node_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/storage.objectViewer"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.warp_node_sa.email}"
}

# Workload Identity service account for WARP pods
resource "google_service_account" "warp_workload_sa" {
  account_id   = "${var.project_name}-workload"
  display_name = "WARP Platform Workload Identity SA"
  project      = var.project_id
}

# IAM binding for Workload Identity
resource "google_service_account_iam_binding" "warp_workload_identity" {
  service_account_id = google_service_account.warp_workload_sa.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[warp-core/warp-sa]",
    "serviceAccount:${var.project_id}.svc.id.goog[messaging/smpp-gateway-sa]"
  ]
  
  depends_on = [google_container_cluster.warp_cluster]
}

# IAM roles for workload service account
resource "google_project_iam_member" "warp_workload_sa_roles" {
  for_each = toset([
    "roles/cloudtrace.agent",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter",
    "roles/secretmanager.secretAccessor"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.warp_workload_sa.email}"
}