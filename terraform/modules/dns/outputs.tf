output "domain_name" {
  description = "Tên miền gốc."
  value       = var.domain_name
}

output "zone_id" {
  description = "Hosted zone ID."
  value       = local.zone_id
}

output "name_servers" {
  description = "NS cần khai báo ở registrar (rỗng nếu dùng zone có sẵn)."
  value       = try(aws_route53_zone.main[0].name_servers, [])
}

output "origin_fqdn" {
  description = "Tên origin.<domain> mà CloudFront gọi tới ALB."
  value       = local.origin_fqdn
}

# Khi chờ xác thực, xuất ARN từ resource validation để nơi dùng chỉ chạy sau khi cert ISSUED.
output "cloudfront_certificate_arn" {
  description = "Cert us-east-1 cho CloudFront."
  value       = var.wait_for_validation ? aws_acm_certificate_validation.cloudfront[0].certificate_arn : aws_acm_certificate.cloudfront.arn
}

output "origin_certificate_arn" {
  description = "Cert regional cho listener HTTPS của ALB."
  value       = var.wait_for_validation ? aws_acm_certificate_validation.origin[0].certificate_arn : aws_acm_certificate.origin.arn
}
