# Output của stack — đây là "giao diện" mà 20-runtime và 30-edge đọc qua
# data "terraform_remote_state". Giữ tên ổn định; muốn đổi tên phải sửa cả stack đọc nó.

# --------------------------------------------------------------------------
# Network
# --------------------------------------------------------------------------
output "vpc_id" {
  description = "ID của VPC."
  value       = module.network.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block của VPC."
  value       = module.network.vpc_cidr_block
}

output "availability_zones" {
  description = "2 AZ đang dùng."
  value       = module.network.availability_zones
}

output "public_subnet_ids" {
  description = "Map AZ -> public subnet ID (ALB)."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Map AZ -> private subnet ID (ECS host, RDS)."
  value       = module.network.private_subnet_ids
}

output "public_route_table_id" {
  description = "Route table của public subnet."
  value       = module.network.public_route_table_id
}

output "private_route_table_ids" {
  description = "Map AZ -> private route table ID. 20-runtime gắn route 0.0.0.0/0 -> NAT vào đây."
  value       = module.network.private_route_table_ids
}

output "internet_gateway_id" {
  description = "ID của Internet Gateway."
  value       = module.network.internet_gateway_id
}

output "default_security_group_id" {
  description = "SG mặc định đã khóa — không dùng."
  value       = module.network.default_security_group_id
}

# --------------------------------------------------------------------------
# Budgets
# --------------------------------------------------------------------------
output "budget_name" {
  description = "Tên budget tháng."
  value       = module.budgets.budget_name
}

# --------------------------------------------------------------------------
# Observability
# --------------------------------------------------------------------------
output "alerts_topic_arn" {
  description = "SNS topic cảnh báo. 20-runtime đặt làm alarm_actions của mọi CloudWatch Alarm."
  value       = module.observability.alerts_topic_arn
}

# --------------------------------------------------------------------------
# Security
# --------------------------------------------------------------------------
output "alb_security_group_id" {
  description = "SG gắn vào ALB."
  value       = module.security.alb_security_group_id
}

output "ecs_task_security_group_id" {
  description = "SG gắn vào ECS service (awsvpc)."
  value       = module.security.ecs_task_security_group_id
}

output "ecs_host_security_group_id" {
  description = "SG gắn vào launch template EC2."
  value       = module.security.ecs_host_security_group_id
}

output "rds_security_group_id" {
  description = "SG gắn vào RDS."
  value       = module.security.rds_security_group_id
}

output "ecs_instance_profile_name" {
  description = "Instance profile gắn vào launch template EC2."
  value       = module.security.ecs_instance_profile_name
}

output "task_execution_role_arn" {
  description = "execution_role_arn của task definition."
  value       = module.security.task_execution_role_arn
}

output "task_execution_role_name" {
  description = "20-runtime gắn thêm quyền đọc secret do RDS quản lý vào role này."
  value       = module.security.task_execution_role_name
}

output "task_role_arn" {
  description = "task_role_arn của task definition."
  value       = module.security.task_role_arn
}

# --------------------------------------------------------------------------
# Secrets
# --------------------------------------------------------------------------
output "app_secret_arns" {
  description = "Map tên secret -> ARN. 20-runtime inject vào task definition."
  value       = module.secrets.app_secret_arns
}

output "origin_verify_value" {
  description = "Giá trị header X-Origin-Verify. 30-edge đặt vào CloudFront, 20-runtime đặt vào ALB rule. Xem bằng: terraform output -raw origin_verify_value"
  value       = module.secrets.origin_verify_value
  sensitive   = true
}

# --------------------------------------------------------------------------
# S3 và CloudTrail
# --------------------------------------------------------------------------
output "frontend_bucket_id" {
  description = "Tên bucket Frontend (CodeBuild sync, CloudFront origin)."
  value       = module.s3.frontend_bucket_id
}

output "frontend_bucket_arn" {
  description = "ARN bucket Frontend."
  value       = module.s3.frontend_bucket_arn
}

output "frontend_bucket_regional_domain_name" {
  description = "Domain bucket Frontend, dùng làm origin CloudFront (OAC)."
  value       = module.s3.frontend_bucket_regional_domain_name
}

output "frontend_baseline_policy_json" {
  description = "Policy nền bucket Frontend. 30-edge dùng làm source_policy_documents rồi thêm quyền GetObject cho CloudFront distribution."
  value       = module.s3.frontend_baseline_policy_json
}

output "data_bucket_id" {
  description = "Tên bucket Data."
  value       = module.s3.data_bucket_id
}

output "data_bucket_arn" {
  description = "ARN bucket Data."
  value       = module.s3.data_bucket_arn
}

output "cloudtrail_arn" {
  description = "ARN trail CloudTrail."
  value       = module.s3.cloudtrail_arn
}

output "s3_gateway_endpoint_id" {
  description = "S3 Gateway Endpoint (null nếu tắt)."
  value       = module.network.s3_gateway_endpoint_id
}

output "alert_emails" {
  description = "Email nhận cảnh báo. 30-edge tạo SNS topic thứ hai ở us-east-1 cho Route 53 Health Check."
  value       = var.alert_emails
}

# --------------------------------------------------------------------------
# ECR
# --------------------------------------------------------------------------
output "ecr_repository_name" {
  description = "Repository backend. 20-runtime lấy image mới nhất ở đây khi không truyền container_image."
  value       = module.ecr.repository_name
}

output "ecr_repository_url" {
  description = "URL để docker push."
  value       = module.ecr.repository_url
}

# --------------------------------------------------------------------------
# DNS (null khi chưa có domain_name)
# --------------------------------------------------------------------------
output "domain_name" {
  description = "Tên miền gốc."
  value       = var.domain_name
}

output "dns_zone_id" {
  description = "Hosted zone. 20-runtime tạo origin.<domain>, 30-edge tạo <domain>."
  value       = one(module.dns[*].zone_id)
}

output "dns_name_servers" {
  description = "NS cần khai báo ở registrar."
  value       = one(module.dns[*].name_servers)
}

output "origin_fqdn" {
  description = "origin.<domain> — CloudFront gọi ALB qua tên này."
  value       = one(module.dns[*].origin_fqdn)
}

output "cloudfront_certificate_arn" {
  description = "Cert us-east-1 cho CloudFront."
  value       = one(module.dns[*].cloudfront_certificate_arn)
}

output "origin_certificate_arn" {
  description = "Cert regional cho listener HTTPS của ALB."
  value       = one(module.dns[*].origin_certificate_arn)
}

# --------------------------------------------------------------------------
# SES, CI/CD
# --------------------------------------------------------------------------
output "ses_dkim_records" {
  description = "Bản ghi DKIM (đã tự tạo nếu DNS ở Route 53)."
  value       = one(module.ses[*].dkim_records)
}

output "codeconnections_connection_arn" {
  description = "Connection GitHub — xác nhận trong Console sau lần apply đầu."
  value       = one(module.cicd[*].connection_arn)
}

output "codebuild_projects" {
  description = "Tên 2 project CodeBuild."
  value       = length(module.cicd) == 0 ? null : { frontend = module.cicd[0].frontend_project_name, backend = module.cicd[0].backend_project_name }
}
