# Cloud SQL Database Module for WARP Platform

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_database_instance" "main" {
  name             = var.instance_name
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = var.db_tier

    ip_configuration {
      ipv4_enabled    = true
      private_network = "projects/${var.project_id}/global/networks/${var.vpc_name}"
      
      authorized_networks {
        name  = "all" # Update for production
        value = "0.0.0.0/0"
      }
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "warp_db" {
  name     = "warp"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "warp_user" {
  name     = "warp"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}