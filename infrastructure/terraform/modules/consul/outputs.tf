# Outputs for Consul module

output "consul_server_ips" {
  description = "Internal IP addresses of Consul servers"
  value       = google_compute_instance.consul_server[*].network_interface[0].network_ip
}

output "consul_ui_url" {
  description = "URL for Consul UI"
  value       = var.enable_consul_ui ? "http://${google_compute_forwarding_rule.consul.ip_address}:8500" : null
}

output "consul_dns_servers" {
  description = "DNS servers for Consul service discovery"
  value       = google_compute_instance.consul_server[*].network_interface[0].network_ip
}

output "consul_datacenter" {
  description = "Consul datacenter name"
  value       = var.consul_datacenter
}

output "consul_encrypt_key" {
  description = "Consul gossip encryption key"
  value       = random_id.consul_encrypt.b64_std
  sensitive   = true
}

output "consul_service_account" {
  description = "Service account email for Consul"
  value       = google_service_account.consul_sa.email
}

output "consul_lb_ip" {
  description = "Internal load balancer IP for Consul cluster"
  value       = google_compute_forwarding_rule.consul.ip_address
}