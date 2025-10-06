# Variables for Compute module (RTPEngine)

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

variable "rtpengine_subnet_id" {
  description = "Subnet ID for RTPEngine instances"
  type        = string
}

variable "rtpengine_instance_count" {
  description = "Number of RTPEngine instances to create"
  type        = number
  default     = 3
}

variable "rtpengine_machine_type" {
  description = "Machine type for RTPEngine instances"
  type        = string
  default     = "n2-standard-4"
}

variable "rtpengine_disk_size" {
  description = "Disk size for RTPEngine instances in GB"
  type        = number
  default     = 100
}

variable "rtpengine_image" {
  description = "OS image for RTPEngine instances"
  type        = string
  default     = "debian-cloud/debian-11"
}

variable "rtpengine_log_level" {
  description = "Log level for RTPEngine (1-7)"
  type        = number
  default     = 6
}

variable "rtp_port_min" {
  description = "Minimum RTP port"
  type        = number
  default     = 10000
}

variable "rtp_port_max" {
  description = "Maximum RTP port"
  type        = number
  default     = 60000
}

variable "consul_servers" {
  description = "List of Consul server addresses"
  type        = list(string)
}

variable "consul_datacenter" {
  description = "Consul datacenter name"
  type        = string
  default     = "gcp-us-central1"
}

variable "redis_host" {
  description = "Redis host for RTPEngine state"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "use_golden_image" {
  description = "Whether to use golden image for RTPEngine deployment"
  type        = bool
  default     = false
}

variable "golden_image_family" {
  description = "Golden image family name for RTPEngine"
  type        = string
  default     = "rtpengine-golden"
}