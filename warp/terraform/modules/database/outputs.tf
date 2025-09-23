output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "private_ip" {
  value = google_sql_database_instance.main.private_ip_address
}

output "public_ip" {
  value = google_sql_database_instance.main.public_ip_address
}

output "database_name" {
  value = google_sql_database.warp_db.name
}

output "database_user" {
  value = google_sql_user.warp_user.name
}

output "database_password" {
  value     = google_sql_user.warp_user.password
  sensitive = true
}