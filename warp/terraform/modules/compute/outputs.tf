# Outputs for Compute module

output "rtpengine_instances" {
  description = "List of RTPEngine instance details"
  value = [
    for idx, instance in google_compute_instance.rtpengine : {
      name        = instance.name
      zone        = instance.zone
      internal_ip = instance.network_interface[0].network_ip
      external_ip = instance.network_interface[0].access_config[0].nat_ip
      self_link   = instance.self_link
    }
  ]
}

output "rtpengine_external_ips" {
  description = "List of external IP addresses for RTPEngine instances"
  value       = google_compute_address.rtpengine_ips[*].address
}

output "rtpengine_service_account" {
  description = "Service account email for RTPEngine instances"
  value       = google_service_account.rtpengine_sa.email
}

output "rtpengine_instance_groups" {
  description = "Instance group self links"
  value       = google_compute_instance_group.rtpengine[*].self_link
}