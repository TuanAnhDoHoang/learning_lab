output "web_acl_arn" {
  description = "Gắn vào web_acl_id của CloudFront."
  value       = aws_wafv2_web_acl.main.arn
}
