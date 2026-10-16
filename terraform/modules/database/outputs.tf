output "address" {
  description = "Hostname của RDS (không kèm cổng)."
  value       = aws_db_instance.main.address
}

output "port" {
  description = "Cổng PostgreSQL."
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Tên database."
  value       = aws_db_instance.main.db_name
}

output "identifier" {
  description = "DB instance identifier."
  value       = aws_db_instance.main.identifier
}

output "master_user_secret_arn" {
  description = "ARN secret JSON {username,password} do RDS quản lý. Đổi mỗi lần dựng lại."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "final_snapshot_identifier" {
  description = "Tên snapshot RDS sẽ tạo khi destroy."
  value       = aws_db_instance.main.final_snapshot_identifier
}
