# Outputs for GKE module

output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.warp_cluster.name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.warp_cluster.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "Cluster CA certificate"
  value       = google_container_cluster.warp_cluster.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "workload_identity_sa" {
  description = "Workload Identity service account email"
  value       = google_service_account.warp_workload_sa.email
}

output "node_service_account" {
  description = "Node service account email"
  value       = google_service_account.warp_node_sa.email
}