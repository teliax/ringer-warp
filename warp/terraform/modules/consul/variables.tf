# Variables for Consul module

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "warp"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC network ID"
  type        = string
}

variable "consul_subnet_id" {
  description = "Subnet ID for Consul servers"
  type        = string
}

variable "consul_server_count" {
  description = "Number of Consul server instances"
  type        = number
  default     = 3
}

variable "consul_machine_type" {
  description = "Machine type for Consul servers"
  type        = string
  default     = "n2-standard-2"
}

variable "consul_disk_size" {
  description = "Disk size for Consul servers in GB"
  type        = number
  default     = 50
}

variable "consul_image" {
  description = "OS image for Consul servers"
  type        = string
  default     = "debian-cloud/debian-11"
}

variable "consul_version" {
  description = "Consul version to install"
  type        = string
  default     = "1.17.1"
}

variable "consul_datacenter" {
  description = "Consul datacenter name"
  type        = string
  default     = "gcp-us-central1"
}

variable "enable_consul_ui" {
  description = "Enable Consul UI"
  type        = bool
  default     = true
}

variable "create_dns_zone" {
  description = "Create a private DNS zone for Consul"
  type        = bool
  default     = true
}

variable "dns_domain" {
  description = "DNS domain for Consul service discovery"
  type        = string
  default     = "warp.internal"
}