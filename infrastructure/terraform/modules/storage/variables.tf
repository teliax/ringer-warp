# Variables for NFS storage module

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCP zone for NFS server"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod, etc.)"
  type        = string
  default     = "prod"
}

variable "vpc_id" {
  description = "VPC network ID"
  type        = string
}

variable "gke_subnet_id" {
  description = "GKE subnet ID where NFS server will be deployed"
  type        = string
}

variable "gke_subnet_cidr" {
  description = "GKE subnet CIDR block"
  type        = string
  default     = "10.0.0.0/24"
}

variable "gke_pod_cidr" {
  description = "GKE pod CIDR block for NFS firewall rules"
  type        = string
  default     = "10.1.0.0/16"
}

variable "nfs_machine_type" {
  description = "Machine type for NFS server"
  type        = string
  default     = "e2-small"  # 2 vCPU, 2GB RAM (~$13/month)
}

variable "nfs_server_image" {
  description = "OS image for NFS server"
  type        = string
  default     = "debian-cloud/debian-12"
}

variable "nfs_disk_size_gb" {
  description = "Size of NFS data disk in GB"
  type        = number
  default     = 10
}

variable "nfs_export_path" {
  description = "Path to export via NFS"
  type        = string
  default     = "/exports/jasmin"
}
