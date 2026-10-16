# 20-runtime — stack TÍNH PHÍ THEO GIỜ (~7–8 USD/ngày). Destroy sau mỗi buổi demo.
# File này chỉ đọc output của 10-foundation và nối các module trong terraform/modules/.
#
# Nối dây:
#   foundation.private_route_table_ids  -> nat
#   foundation.rds_security_group_id    -> database
#   foundation.origin_verify_value      -> alb (listener rule)
#   database.master_user_secret_arn     -> ecs (secrets) + quyền đọc của task_execution role
#   alb.target_group_arn                -> ecs (service)

data "aws_caller_identity" "current" {}

# Tên bucket state suy ra theo quy ước của 00-bootstrap, không cần thêm biến.
data "terraform_remote_state" "foundation" {
  backend = "s3"

  config = {
    bucket = "${var.project_name}-tfstate-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
    key    = "10-foundation/terraform.tfstate"
    region = var.aws_region
  }
}

# Không truyền container_image => dùng image đẩy lên ECR gần nhất (CodeBuild tag git SHA).
# Nhờ vậy dựng lại 20-runtime luôn chạy bản mới nhất mà CI đã build.
data "aws_ecr_image" "latest" {
  count = var.container_image == null ? 1 : 0

  repository_name = data.terraform_remote_state.foundation.outputs.ecr_repository_name
  most_recent     = true
}

locals {
  foundation = data.terraform_remote_state.foundation.outputs

  container_image = var.container_image != null ? var.container_image : data.aws_ecr_image.latest[0].image_uri

  # Có tên miền ở 10-foundation => ALB dùng HTTPS với cert origin.<domain>.
  # try(): state foundation cũ chưa có các output DNS.
  dns_zone_id         = try(local.foundation.dns_zone_id, null)
  has_domain          = local.dns_zone_id != null
  alb_certificate_arn = var.alb_certificate_arn != null ? var.alb_certificate_arn : try(local.foundation.origin_certificate_arn, null)

  # Output dạng map AZ -> ID; module cần list theo thứ tự AZ ổn định.
  public_subnet_ids  = [for az in sort(keys(local.foundation.public_subnet_ids)) : local.foundation.public_subnet_ids[az]]
  private_subnet_ids = [for az in sort(keys(local.foundation.private_subnet_ids)) : local.foundation.private_subnet_ids[az]]

  rds_secret_arn = module.database.master_user_secret_arn

  # Secret RDS là JSON {username,password}; ECS inject từng khóa (A3).
  container_secrets = merge(
    { for env, name in var.app_secret_env : env => local.foundation.app_secret_arns[name] },
    {
      (var.db_env_names.username) = "${local.rds_secret_arn}:username::"
      (var.db_env_names.password) = "${local.rds_secret_arn}:password::"
    },
  )

  container_environment = merge(
    {
      (var.db_env_names.host) = module.database.address
      (var.db_env_names.port) = tostring(module.database.port)
      (var.db_env_names.name) = module.database.db_name
      RUST_LOG                = var.rust_log
    },
    var.extra_environment,
  )
}

check "app_secrets_exist_in_foundation" {
  assert {
    condition     = alltrue([for name in values(var.app_secret_env) : contains(keys(local.foundation.app_secret_arns), name)])
    error_message = "app_secret_env trỏ tới secret không có trong app_secret_names của 10-foundation."
  }
}

module "nat" {
  source = "../modules/nat"

  project_name            = var.project_name
  vpc_id                  = local.foundation.vpc_id
  private_route_table_ids = local.foundation.private_route_table_ids
  alarm_topic_arn         = local.foundation.alerts_topic_arn
}

module "database" {
  source = "../modules/database"

  project_name          = var.project_name
  private_subnet_ids    = local.private_subnet_ids
  security_group_id     = local.foundation.rds_security_group_id
  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  multi_az              = var.rds_multi_az
  backup_retention_days = var.rds_backup_retention_days
  db_name               = var.db_name
  restore_snapshot_id   = var.rds_restore_snapshot_id
  deletion_protection   = var.rds_deletion_protection
  alarm_topic_arn       = local.foundation.alerts_topic_arn
}

module "alb" {
  source = "../modules/alb"

  project_name        = var.project_name
  vpc_id              = local.foundation.vpc_id
  public_subnet_ids   = local.public_subnet_ids
  security_group_id   = local.foundation.alb_security_group_id
  backend_port        = var.backend_port
  health_check_path   = var.health_check_path
  origin_verify_value = local.foundation.origin_verify_value
  certificate_arn     = local.alb_certificate_arn
  alarm_topic_arn     = local.foundation.alerts_topic_arn
}

# ARN secret RDS đổi mỗi lần dựng lại nên quyền đọc gắn ở đây, không ở 10-foundation.
resource "aws_iam_role_policy" "read_rds_secret" {
  name = "read-rds-master-secret"
  role = local.foundation.task_execution_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadRdsMasterSecret"
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = local.rds_secret_arn
    }]
  })
}

module "ecs" {
  source = "../modules/ecs"

  project_name            = var.project_name
  aws_region              = var.aws_region
  private_subnet_ids      = local.private_subnet_ids
  host_security_group_id  = local.foundation.ecs_host_security_group_id
  task_security_group_id  = local.foundation.ecs_task_security_group_id
  instance_profile_name   = local.foundation.ecs_instance_profile_name
  task_execution_role_arn = local.foundation.task_execution_role_arn
  task_role_arn           = local.foundation.task_role_arn
  target_group_arn        = module.alb.target_group_arn

  container_image        = local.container_image
  backend_port           = var.backend_port
  environment            = local.container_environment
  secrets                = local.container_secrets
  task_cpu               = var.task_cpu
  task_memory            = var.task_memory
  enable_execute_command = var.enable_execute_command

  asg_min_size          = var.asg_min_size
  asg_max_size          = var.asg_max_size
  service_desired_count = var.service_desired_count
  service_min_count     = var.service_min_count
  service_max_count     = var.service_max_count
  alarm_topic_arn       = local.foundation.alerts_topic_arn

  # Task cần: route ra Internet (kéo image, đọc secret), quyền đọc secret RDS,
  # và target group đã gắn vào listener.
  depends_on = [module.nat, aws_iam_role_policy.read_rds_secret, module.alb]
}

# origin.<domain> -> ALB. Nằm ở đây (không ở 10-foundation) vì trỏ vào ALB của phiên này;
# hosted zone ở 10-foundation nên destroy 20-runtime không làm hỏng 30-edge.
resource "aws_route53_record" "origin" {
  count = local.has_domain ? 1 : 0

  zone_id = local.dns_zone_id
  name    = local.foundation.origin_fqdn
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}
