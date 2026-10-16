output "site_url" {
  description = "Địa chỉ mở app."
  value       = "https://${local.has_domain ? local.domain_name : module.cdn.distribution_domain_name}"
}

output "cloudfront_distribution_id" {
  description = "ID distribution."
  value       = module.cdn.distribution_id
}

output "cloudfront_domain_name" {
  description = "xxxx.cloudfront.net."
  value       = module.cdn.distribution_domain_name
}

output "api_origin_domain" {
  description = "Origin API mà CloudFront đang gọi."
  value       = local.api_origin_domain
}

output "web_acl_arn" {
  description = "WAF (null nếu tắt)."
  value       = one(module.waf[*].web_acl_arn)
}
