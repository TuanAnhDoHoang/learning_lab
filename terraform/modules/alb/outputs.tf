output "dns_name" {
  description = "DNS của ALB. Origin của CloudFront khi chưa có origin.<domain>."
  value       = aws_lb.main.dns_name
}

output "zone_id" {
  description = "Hosted zone ID của ALB (cho bản ghi alias origin.<domain>)."
  value       = aws_lb.main.zone_id
}

output "arn_suffix" {
  description = "Dùng làm dimension của CloudWatch metric."
  value       = aws_lb.main.arn_suffix
}

output "target_group_arn" {
  description = "Target group của ECS service."
  value       = aws_lb_target_group.api.arn
}

output "listener_protocol" {
  description = "HTTPS khi có chứng chỉ, HTTP khi chưa có tên miền."
  value       = aws_lb_listener.main.protocol
}

output "listener_rule_arn" {
  description = "ECS service phụ thuộc rule này để target group đã gắn vào ALB trước khi tạo service."
  value       = aws_lb_listener_rule.origin_verify.arn
}
