# --------------------------------------------------------------------------
# Security Groups — dùng bởi stack 20-runtime
# --------------------------------------------------------------------------
output "alb_security_group_id" {
  description = "Gắn vào ALB."
  value       = aws_security_group.alb.id
}

output "ecs_task_security_group_id" {
  description = "Gắn vào network_configuration của ECS service (awsvpc)."
  value       = aws_security_group.ecs_task.id
}

output "ecs_host_security_group_id" {
  description = "Gắn vào launch template của EC2 chạy ECS."
  value       = aws_security_group.ecs_host.id
}

output "rds_security_group_id" {
  description = "Gắn vào RDS instance."
  value       = aws_security_group.rds.id
}

output "cloudfront_prefix_list_id" {
  description = "ID managed prefix list CloudFront origin-facing đang dùng cho alb_sg."
  value       = data.aws_ec2_managed_prefix_list.cloudfront.id
}

# --------------------------------------------------------------------------
# IAM — dùng bởi stack 20-runtime
# --------------------------------------------------------------------------
output "ecs_instance_profile_name" {
  description = "Gắn vào launch template của EC2 chạy ECS."
  value       = aws_iam_instance_profile.ecs_instance.name
}

output "ecs_instance_role_name" {
  description = "Role của EC2 host."
  value       = aws_iam_role.ecs_instance.name
}

output "task_execution_role_arn" {
  description = "execution_role_arn của ECS task definition."
  value       = aws_iam_role.task_execution.arn
}

output "task_execution_role_name" {
  description = "20-runtime gắn thêm inline policy đọc secret do RDS quản lý vào role này."
  value       = aws_iam_role.task_execution.name
}

output "task_role_arn" {
  description = "task_role_arn của ECS task definition."
  value       = aws_iam_role.task.arn
}

output "task_role_name" {
  description = "Tên task role."
  value       = aws_iam_role.task.name
}

# Hai output dưới đây đọc từ chính policy document (không phải input truyền vào),
# để stack ghép kiểm tra được quyền thực sự đã được cấp.
output "granted_secret_arns" {
  description = "ARN các secret mà execution role được đọc, đúng như trong policy."
  value       = flatten([for d in data.aws_iam_policy_document.task_execution_secrets : [for s in d.statement : tolist(s.resources)]])
}

output "granted_data_bucket_object_arns" {
  description = "Resource mà task role được Get/Put object (dạng <arn bucket>/*), rỗng nếu chưa cấp quyền S3."
  value = flatten([
    for d in data.aws_iam_policy_document.task : [
      for s in d.statement : tolist(s.resources) if s.sid == "DataBucketObjects"
    ]
  ])
}
