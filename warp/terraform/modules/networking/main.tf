# Network module for WARP infrastructure
# Creates VPC, subnets, and firewall rules

resource "google_compute_network" "warp_vpc" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnet for GKE cluster (Kamailio control plane)
resource "google_compute_subnetwork" "gke_subnet" {
  name          = "${var.project_name}-gke-subnet"
  ip_cidr_range = var.gke_subnet_cidr
  region        = var.region
  network       = google_compute_network.warp_vpc.id
  project       = var.project_id

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = var.gke_pods_cidr
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = var.gke_services_cidr
  }

  private_ip_google_access = true
}

# Subnet for RTPEngine VMs
resource "google_compute_subnetwork" "rtpengine_subnet" {
  name                     = "${var.project_name}-rtpengine-subnet"
  ip_cidr_range            = var.rtpengine_subnet_cidr
  region                   = var.region
  network                  = google_compute_network.warp_vpc.id
  project                  = var.project_id
  private_ip_google_access = true
}

# Subnet for Consul cluster
resource "google_compute_subnetwork" "consul_subnet" {
  name                     = "${var.project_name}-consul-subnet"
  ip_cidr_range            = var.consul_subnet_cidr
  region                   = var.region
  network                  = google_compute_network.warp_vpc.id
  project                  = var.project_id
  private_ip_google_access = true
}

# Cloud NAT for outbound internet access
resource "google_compute_router" "warp_router" {
  name    = "${var.project_name}-router"
  region  = var.region
  network = google_compute_network.warp_vpc.id
  project = var.project_id
}

resource "google_compute_router_nat" "warp_nat" {
  name                               = "${var.project_name}-nat"
  router                             = google_compute_router.warp_router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  project                            = var.project_id

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall rule for SIP signaling
resource "google_compute_firewall" "allow_sip" {
  name    = "${var.project_name}-allow-sip"
  network = google_compute_network.warp_vpc.name
  project = var.project_id

  allow {
    protocol = "udp"
    ports    = ["5060", "5061"]
  }

  allow {
    protocol = "tcp"
    ports    = ["5060", "5061"]
  }

  source_ranges = var.sip_allowed_ips
  target_tags   = ["kamailio", "sip-proxy"]
}

# Firewall rule for RTP media
resource "google_compute_firewall" "allow_rtp" {
  name    = "${var.project_name}-allow-rtp"
  network = google_compute_network.warp_vpc.name
  project = var.project_id

  allow {
    protocol = "udp"
    ports    = ["10000-60000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["rtpengine"]
}

# Firewall rule for RTPEngine control protocol
resource "google_compute_firewall" "allow_rtpengine_control" {
  name    = "${var.project_name}-allow-rtpengine-control"
  network = google_compute_network.warp_vpc.name
  project = var.project_id

  allow {
    protocol = "udp"
    ports    = ["2223"]
  }

  allow {
    protocol = "tcp"
    ports    = ["2223"]
  }

  source_ranges = [
    var.gke_subnet_cidr,
    var.gke_pods_cidr
  ]
  target_tags = ["rtpengine"]
}

# Firewall rule for Consul
resource "google_compute_firewall" "allow_consul" {
  name    = "${var.project_name}-allow-consul"
  network = google_compute_network.warp_vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["8300", "8301", "8302", "8500", "8600"]
  }

  allow {
    protocol = "udp"
    ports    = ["8301", "8302", "8600"]
  }

  source_ranges = [
    var.gke_subnet_cidr,
    var.rtpengine_subnet_cidr,
    var.consul_subnet_cidr
  ]
  target_tags = ["consul"]
}

# Internal firewall rule for inter-service communication
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_name}-allow-internal"
  network = google_compute_network.warp_vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.gke_subnet_cidr,
    var.rtpengine_subnet_cidr,
    var.consul_subnet_cidr,
    var.gke_pods_cidr,
    var.gke_services_cidr
  ]
}