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

# Reference existing static NAT IPs (created manually for vendor whitelisting)
data "google_compute_address" "nat_ip_1" {
  name    = "warp-nat-ip-1"
  region  = var.region
  project = var.project_id
}

data "google_compute_address" "nat_ip_2" {
  name    = "warp-nat-ip-2"
  region  = var.region
  project = var.project_id
}

data "google_compute_address" "nat_ip_3" {
  name    = "warp-nat-ip-3"
  region  = var.region
  project = var.project_id
}

# SMPP-specific NAT IP whitelisted by Sinch for SMPP vendor binds
# IP: 34.58.165.135 - CRITICAL: Required for outbound SMPP connections to Sinch
data "google_compute_address" "nat_outbound_ip" {
  name    = "warp-nat-outbound-ip"
  region  = var.region
  project = var.project_id
}

# Cloud NAT for GKE - uses ONLY the Sinch-whitelisted IP (34.58.165.135)
# This NAT covers ALL traffic from the GKE subnet (nodes + pods)
# Required for: SMPP Gateway → Sinch, API Gateway → external vendors, cert-manager → Let's Encrypt
resource "google_compute_router_nat" "warp_nat_gke" {
  name                               = "${var.project_name}-nat-gke"
  router                             = google_compute_router.warp_router.name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [
    data.google_compute_address.nat_outbound_ip.self_link,  # 34.58.165.135 - Sinch whitelisted
  ]
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  enable_endpoint_independent_mapping = false
  project                            = var.project_id

  # GKE subnet - ALL IP ranges (primary for nodes + secondary for pods)
  # CRITICAL: Must include ALL_IP_RANGES to NAT both node and pod traffic
  # Previous config only NAT'd secondary range, breaking pod egress
  subnetwork {
    name                    = google_compute_subnetwork.gke_subnet.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ALL"
  }
}

# Cloud NAT for VMs only (RTPEngine, Consul) - uses the 3 standard NAT IPs
# GKE pods use warp_nat_gke with the Sinch-whitelisted IP
resource "google_compute_router_nat" "warp_nat_general" {
  name                               = "${var.project_name}-nat-general"
  router                             = google_compute_router.warp_router.name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [
    data.google_compute_address.nat_ip_1.self_link,
    data.google_compute_address.nat_ip_2.self_link,
    data.google_compute_address.nat_ip_3.self_link,
  ]
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  project                            = var.project_id

  # RTPEngine subnet
  subnetwork {
    name                     = google_compute_subnetwork.rtpengine_subnet.id
    source_ip_ranges_to_nat  = ["ALL_IP_RANGES"]
  }

  # Consul subnet
  subnetwork {
    name                     = google_compute_subnetwork.consul_subnet.id
    source_ip_ranges_to_nat  = ["ALL_IP_RANGES"]
  }

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
  description = "Allow Kamailio to RTPEngine control ports (22222=NG, 2223=CLI)"

  allow {
    protocol = "udp"
    ports    = ["2223", "22222"]
  }

  allow {
    protocol = "tcp"
    ports    = ["2223", "22222"]
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