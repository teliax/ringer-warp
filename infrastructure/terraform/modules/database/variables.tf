variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "db_tier" {
  description = "Machine type for the database"
  type        = string
}

variable "vpc_name" {
  description = "VPC network name"
  type        = string
}