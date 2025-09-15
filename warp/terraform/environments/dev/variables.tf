# Variables for WARP Development Environment

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "sip_allowed_ips" {
  description = "IP ranges allowed for SIP traffic"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Open for dev/testing
}

variable "master_authorized_networks" {
  description = "Networks authorized to access GKE master"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks (dev only)"
    }
  ]
}