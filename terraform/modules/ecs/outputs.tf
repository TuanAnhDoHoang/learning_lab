output "cluster_name" {
  description = "Tên ECS cluster."
  value       = aws_ecs_cluster.main.name
}

output "service_name" {
  description = "Tên ECS service."
  value       = aws_ecs_service.backend.name
}

output "task_definition_family" {
  description = "Family của task definition (dùng cho run-task chạy migration, A4)."
  value       = aws_ecs_task_definition.backend.family
}

output "container_name" {
  description = "Tên container trong task definition."
  value       = local.container_name
}

output "log_group_name" {
  description = "CloudWatch log group của backend."
  value       = aws_cloudwatch_log_group.backend.name
}

output "autoscaling_group_name" {
  description = "ASG của EC2 host."
  value       = aws_autoscaling_group.ecs_host.name
}
