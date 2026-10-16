# 10-foundation — stack thường trực. File này CHỈ gọi và nối các module trong
# terraform/modules/. Logic của từng phần nằm trong module, test độc lập tại đó.
#
# Nối dây giữa các module:
#   network.vpc_id  ->  security.vpc_id
#   var.alert_emails -> budgets (email trực tiếp) và observability (SNS)
#
#   secrets.execution_secret_arns -> security.execution_secret_arns
#   s3.data_bucket_arn             -> security.data_bucket_arn
#
#   ses.identity_arn               -> security.ses_identity_arns
#   ecr, s3.frontend_bucket, security roles -> cicd
#
# Module có điều kiện (count): dns khi có domain_name, ses khi enable_ses,
# cicd khi có github_repo_url.

module "network" {
  source = "../modules/network"

  project_name         = var.project_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_flow_logs     = var.enable_flow_logs

  enable_s3_gateway_endpoint = var.enable_s3_gateway_endpoint
}

# Budgets gửi email TRỰC TIẾP, không đi qua SNS: đây là lưới an toàn cuối cùng,
# không được phụ thuộc vào việc subscription SNS đã được xác nhận hay chưa.
module "budgets" {
  source = "../modules/budgets"

  project_name            = var.project_name
  monthly_budget_usd      = var.monthly_budget_usd
  actual_alert_thresholds = var.budget_alert_thresholds
  alert_emails            = var.alert_emails
}

# Kênh cảnh báo vận hành — CloudWatch Alarms của 20-runtime gửi vào topic này.
module "observability" {
  source = "../modules/observability"

  project_name = var.project_name
  alert_emails = var.alert_emails
}

# Vỏ secret của app + giá trị X-Origin-Verify. Giá trị secret của app đặt sau bằng
# `aws secretsmanager put-secret-value` (README của module).
module "secrets" {
  source = "../modules/secrets"

  project_name     = var.project_name
  app_secret_names = var.app_secret_names
}

# 3 bucket (Frontend, Data, log CloudTrail) và 1 trail multi-region.
module "s3" {
  source = "../modules/s3"

  project_name              = var.project_name
  force_destroy             = var.s3_force_destroy
  data_cors_allowed_origins = var.data_cors_allowed_origins
}

module "security" {
  source = "../modules/security"

  project_name = var.project_name
  vpc_id       = module.network.vpc_id

  backend_port      = var.backend_port
  bypass_test_cidrs = var.bypass_test_cidrs

  bedrock_model_arns = var.bedrock_model_arns
  ses_identity_arns  = concat(var.ses_identity_arns, module.ses[*].identity_arn)
  enable_ecs_exec    = var.enable_ecs_exec

  execution_secret_arns = module.secrets.execution_secret_arns
  data_bucket_arn       = module.s3.data_bucket_arn
}

module "ecr" {
  source = "../modules/ecr"

  project_name = var.project_name
  force_delete = var.ecr_force_delete
}

module "dns" {
  source = "../modules/dns"
  count  = var.domain_name == null ? 0 : 1

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name        = var.project_name
  domain_name         = var.domain_name
  existing_zone_id    = var.existing_zone_id
  wait_for_validation = var.dns_wait_for_validation
}

module "ses" {
  source = "../modules/ses"
  count  = var.enable_ses ? 1 : 0

  domain_name         = var.domain_name
  create_dkim_records = true
  zone_id             = module.dns[0].zone_id
}

module "cicd" {
  source = "../modules/cicd"
  count  = var.github_repo_url == null ? 0 : 1

  project_name       = var.project_name
  github_repo_url    = var.github_repo_url
  branch             = var.github_branch
  frontend_dir       = var.frontend_dir
  backend_dir        = var.backend_dir
  backend_dockerfile = var.backend_dockerfile
  frontend_build_env = var.frontend_build_env
  enable_webhooks    = var.enable_cicd_webhooks

  ecr_repository_url   = module.ecr.repository_url
  ecr_repository_arn   = module.ecr.repository_arn
  frontend_bucket_name = module.s3.frontend_bucket_id
  frontend_bucket_arn  = module.s3.frontend_bucket_arn
  pass_role_arns       = [module.security.task_execution_role_arn, module.security.task_role_arn]
}
