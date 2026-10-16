output "app_secret_arns" {
  description = "Map tên secret (không kèm tiền tố project) -> ARN. 20-runtime dùng để inject vào task definition."
  value       = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
}

output "execution_secret_arns" {
  description = "Danh sách ARN, truyền vào modules/security để execution role được đọc đúng các secret này."
  value       = [for k in sort(keys(aws_secretsmanager_secret.app)) : aws_secretsmanager_secret.app[k].arn]
}

output "origin_verify_value" {
  description = "Giá trị header X-Origin-Verify. 30-edge đặt vào CloudFront, 20-runtime đặt vào ALB listener rule."
  value       = random_password.origin_verify.result
  sensitive   = true
}
