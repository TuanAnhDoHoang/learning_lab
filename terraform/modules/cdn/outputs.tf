output "distribution_id" {
  description = "ID distribution (create-invalidation)."
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_domain_name" {
  description = "xxxx.cloudfront.net — địa chỉ demo khi chưa có tên miền."
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_arn" {
  description = "ARN distribution."
  value       = aws_cloudfront_distribution.main.arn
}
