# Variables for networking module

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

variable "gke_subnet_cidr" {
  description = "CIDR range for GKE subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "gke_pods_cidr" {
  description = "CIDR range for GKE pods"
  type        = string
  default     = "10.1.0.0/16"
}

variable "gke_services_cidr" {
  description = "CIDR range for GKE services"
  type        = string
  default     = "10.2.0.0/16"
}

variable "rtpengine_subnet_cidr" {
  description = "CIDR range for RTPEngine subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "consul_subnet_cidr" {
  description = "CIDR range for Consul subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "sip_allowed_ips" {
  description = "List of IP ranges allowed for SIP traffic"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}