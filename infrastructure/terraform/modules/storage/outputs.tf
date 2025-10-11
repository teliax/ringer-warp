# Outputs for NFS storage module

output "nfs_server_name" {
  value       = google_compute_instance.nfs_server.name
  description = "Name of the NFS server instance"
}

output "nfs_server_internal_ip" {
  value       = google_compute_address.nfs_server_ip.address
  description = "Internal IP address of the NFS server"
}

output "nfs_server_zone" {
  value       = google_compute_instance.nfs_server.zone
  description = "Zone where NFS server is deployed"
}

output "nfs_export_path" {
  value       = var.nfs_export_path
  description = "NFS export path for mounting"
}

output "nfs_server_endpoint" {
  value       = "${google_compute_address.nfs_server_ip.address}:${var.nfs_export_path}"
  description = "Full NFS server endpoint for mounting (server:path)"
}
