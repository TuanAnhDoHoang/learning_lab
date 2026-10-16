output "alb_dns_name" {
  description = "DNS của ALB — origin của CloudFront (30-edge) khi chưa có origin.<domain>."
  value       = module.alb.dns_name
}

output "alb_listener_protocol" {
  description = "HTTPS khi có alb_certificate_arn, HTTP (cổng 443) khi chưa có tên miền."
  value       = module.alb.listener_protocol
}

output "nat_gateway_id" {
  description = "ID của Regional NAT Gateway."
  value       = module.nat.nat_gateway_id
}

output "rds_address" {
  description = "Hostname RDS."
  value       = module.database.address
}

output "rds_identifier" {
  description = "DB instance identifier."
  value       = module.database.identifier
}

output "rds_master_secret_arn" {
  description = "Secret {username,password} do RDS quản lý."
  value       = module.database.master_user_secret_arn
}

output "rds_final_snapshot_identifier" {
  description = "Tên snapshot sẽ được tạo khi destroy."
  value       = module.database.final_snapshot_identifier
}

output "ecs_cluster_name" {
  description = "Tên ECS cluster."
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Tên ECS service."
  value       = module.ecs.service_name
}

output "ecs_task_definition_family" {
  description = "Family task definition — dùng cho run-task chạy migration (A4)."
  value       = module.ecs.task_definition_family
}

output "ecs_container_name" {
  description = "Tên container trong task."
  value       = module.ecs.container_name
}

output "ecs_log_group_name" {
  description = "Log group của backend."
  value       = module.ecs.log_group_name
}

output "private_subnet_ids" {
  description = "Private subnet — tham số mạng cho run-task."
  value       = local.private_subnet_ids
}

output "ecs_task_security_group_id" {
  description = "SG của task — tham số mạng cho run-task."
  value       = local.foundation.ecs_task_security_group_id
}

output "container_image" {
  description = "Image backend đang chạy."
  value       = local.container_image
}

output "origin_fqdn" {
  description = "origin.<domain> trỏ vào ALB (null khi chưa có tên miền)."
  value       = one(aws_route53_record.origin[*].fqdn)
}
