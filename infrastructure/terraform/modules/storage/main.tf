# Storage module for NFS server providing shared storage for Jasmin configs

# Service account for NFS server
resource "google_service_account" "nfs_server_sa" {
  account_id   = "${var.project_name}-nfs-server-sa"
  display_name = "NFS Server Service Account"
  project      = var.project_id
}

# IAM roles for NFS server service account
resource "google_project_iam_member" "nfs_server_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.nfs_server_sa.email}"
}

# Static internal IP for NFS server
resource "google_compute_address" "nfs_server_ip" {
  name         = "${var.project_name}-nfs-server-ip"
  address_type = "INTERNAL"
  subnetwork   = var.gke_subnet_id
  region       = var.region
  project      = var.project_id
  purpose      = "GCE_ENDPOINT"
}

# NFS server VM instance
resource "google_compute_instance" "nfs_server" {
  name         = "${var.project_name}-nfs-server"
  machine_type = var.nfs_machine_type
  zone         = var.zone
  project      = var.project_id

  tags = ["nfs-server", "allow-nfs-from-gke"]

  boot_disk {
    initialize_params {
      image = var.nfs_server_image
      size  = 10  # 10GB for OS
      type  = "pd-standard"
    }
  }

  # Separate data disk for NFS exports
  attached_disk {
    source      = google_compute_disk.nfs_data.id
    device_name = "nfs-data"
    mode        = "READ_WRITE"
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.gke_subnet_id
    network_ip = google_compute_address.nfs_server_ip.address
  }

  service_account {
    email  = google_service_account.nfs_server_sa.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = templatefile("${path.module}/scripts/nfs-server-startup.sh", {
    export_path = var.nfs_export_path
    gke_pod_cidr = var.gke_pod_cidr
  })

  metadata = {
    enable-oslogin     = "TRUE"
    serial-port-enable = "TRUE"
  }

  labels = {
    environment = var.environment
    service     = "nfs-server"
    purpose     = "jasmin-storage"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                  = true
    enable_integrity_monitoring = true
  }

  allow_stopping_for_update = true
}

# Persistent disk for NFS data
resource "google_compute_disk" "nfs_data" {
  name    = "${var.project_name}-nfs-data"
  type    = "pd-standard"
  zone    = var.zone
  size    = var.nfs_disk_size_gb
  project = var.project_id

  labels = {
    environment = var.environment
    service     = "nfs-server"
    purpose     = "jasmin-storage"
  }
}

# Firewall rule to allow NFS traffic from GKE pods
resource "google_compute_firewall" "allow_nfs_from_gke" {
  name    = "${var.project_name}-allow-nfs-from-gke"
  network = var.vpc_id
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["2049", "111", "20048"]  # NFS, portmapper, mountd
  }

  allow {
    protocol = "udp"
    ports    = ["2049", "111", "20048"]
  }

  source_ranges = [var.gke_pod_cidr, var.gke_subnet_cidr]
  target_tags   = ["nfs-server"]

  description = "Allow NFS traffic from GKE pods to NFS server"
}
