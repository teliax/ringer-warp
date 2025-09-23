# Redis Cache Module for WARP Platform

resource "google_redis_instance" "main" {
  name           = var.redis_name
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  region         = var.region
  
  redis_version = "REDIS_6_X"
  display_name  = "${var.redis_name} Redis Instance"
  
  authorized_network = "projects/${var.project_id}/global/networks/${var.vpc_name}"
  
  redis_configs = {
    "maxmemory-policy" = "allkeys-lru"
  }
}