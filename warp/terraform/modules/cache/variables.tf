variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "redis_name" {
  description = "Redis instance name"
  type        = string
}

variable "memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
}

variable "tier" {
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
}

variable "vpc_name" {
  description = "VPC network name"
  type        = string
}