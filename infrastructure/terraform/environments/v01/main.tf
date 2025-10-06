# WARP Platform v0.1 - Main Terraform Configuration
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "gcs" {
    bucket = "ringer-warp-v01-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {}
variable "region" {}
variable "cluster_name" {}
variable "vpc_name" {}
variable "db_instance" {}
variable "redis_name" {}
variable "gke_num_nodes" {}
variable "gke_min_nodes" {}
variable "gke_max_nodes" {}
variable "gke_machine_type" {}
variable "db_tier" {}
variable "redis_memory_size_gb" {}
variable "redis_tier" {}
variable "sip_allowed_ips" { type = list(string) }
variable "use_golden_image" {
  type = bool
  default = false
}
variable "golden_image_family" {
  type = string
  default = "rtpengine-golden"
}

# Use existing modules with clean naming
module "networking" {
  source = "../../modules/networking"
  
  project_id            = var.project_id
  project_name          = "warp"  # Using fixed name for v0.1
  region                = var.region
  gke_subnet_cidr       = "10.0.0.0/24"
  gke_pods_cidr         = "10.1.0.0/16"
  gke_services_cidr     = "10.2.0.0/16"
  rtpengine_subnet_cidr = "10.0.1.0/24"
  consul_subnet_cidr    = "10.0.2.0/24"
  sip_allowed_ips       = var.sip_allowed_ips
}

module "gke" {
  source = "../../modules/gke"
  
  project_id         = var.project_id
  project_name       = "warp"
  region             = var.region
  environment        = "prod"
  vpc_id             = module.networking.vpc_id
  gke_subnet_id      = module.networking.gke_subnet_id
  
  initial_node_count = var.gke_num_nodes
  min_node_count     = var.gke_min_nodes
  max_node_count     = var.gke_max_nodes
}

module "database" {
  source = "../../modules/database"
  
  project_id   = var.project_id
  region       = var.region
  instance_name = var.db_instance
  db_tier      = var.db_tier
  vpc_name     = module.networking.vpc_name
}

module "cache" {
  source = "../../modules/cache"
  
  project_id   = var.project_id
  region       = var.region
  redis_name   = var.redis_name
  memory_size_gb = var.redis_memory_size_gb
  tier         = var.redis_tier
  vpc_name     = module.networking.vpc_name
}

module "consul" {
  source = "../../modules/consul"
  
  project_id       = var.project_id
  region          = var.region
  environment     = "v01"
  vpc_id          = module.networking.vpc_id
  consul_subnet_id = module.networking.consul_subnet_id
}

module "compute" {
  source = "../../modules/compute"

  project_id           = var.project_id
  project_name         = "warp"
  region               = var.region
  environment          = "v01"
  vpc_id               = module.networking.vpc_id
  rtpengine_subnet_id  = module.networking.rtpengine_subnet_id
  consul_servers       = module.consul.consul_server_ips
  consul_datacenter    = "gcp-us-central1"
  redis_host           = module.cache.host
  redis_port           = module.cache.port
  use_golden_image     = var.use_golden_image
  golden_image_family  = var.golden_image_family
  rtpengine_instance_count = 3
  rtpengine_machine_type   = "n2-standard-4"
  rtp_port_min         = 10000
  rtp_port_max         = 60000
}

# Outputs
output "vpc_name" {
  value = module.networking.vpc_name
}

output "gke_cluster_name" {
  value = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  value     = module.gke.cluster_endpoint
  sensitive = true
}

output "database_instance" {
  value = module.database.instance_name
}

output "database_connection_name" {
  value = module.database.connection_name
}

output "redis_host" {
  value = module.cache.host
}

output "redis_port" {
  value = module.cache.port
}

output "consul_server_ips" {
  value = module.consul.consul_server_ips
}

output "consul_ui_url" {
  value = module.consul.consul_ui_url
}