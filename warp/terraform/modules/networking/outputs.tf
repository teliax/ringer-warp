# Outputs for networking module

output "vpc_id" {
  description = "VPC network ID"
  value       = google_compute_network.warp_vpc.id
}

output "vpc_name" {
  description = "VPC network name"
  value       = google_compute_network.warp_vpc.name
}

output "gke_subnet_id" {
  description = "GKE subnet ID"
  value       = google_compute_subnetwork.gke_subnet.id
}

output "gke_subnet_name" {
  description = "GKE subnet name"
  value       = google_compute_subnetwork.gke_subnet.name
}

output "rtpengine_subnet_id" {
  description = "RTPEngine subnet ID"
  value       = google_compute_subnetwork.rtpengine_subnet.id
}

output "rtpengine_subnet_name" {
  description = "RTPEngine subnet name"
  value       = google_compute_subnetwork.rtpengine_subnet.name
}

output "consul_subnet_id" {
  description = "Consul subnet ID"
  value       = google_compute_subnetwork.consul_subnet.id
}

output "consul_subnet_name" {
  description = "Consul subnet name"
  value       = google_compute_subnetwork.consul_subnet.name
}