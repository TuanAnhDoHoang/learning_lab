# 30-edge — CloudFront + WAF + Health Check. Đọc output của 10-foundation; KHÔNG đọc state
# của 20-runtime (có tên miền thì gọi ALB qua origin.<domain>, nên dựng lại 20-runtime
# không ảnh hưởng stack này).
#
# Chưa có tên miền: CloudFront dùng *.cloudfront.net và gọi thẳng DNS của ALB qua biến
# api_origin_domain => mỗi lần dựng lại 20-runtime (ALB mới, DNS mới) phải apply lại stack này.

data "aws_caller_identity" "current" {}

data "terraform_remote_state" "foundation" {
  backend = "s3"

  config = {
    bucket = "${var.project_name}-tfstate-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
    key    = "10-foundation/terraform.tfstate"
    region = var.aws_region
  }
}

locals {
  foundation  = data.terraform_remote_state.foundation.outputs
  domain_name = try(local.foundation.domain_name, null)
  has_domain  = local.domain_name != null

  api_origin_domain = local.has_domain ? local.foundation.origin_fqdn : var.api_origin_domain
}

module "waf" {
  source = "../modules/waf"
  count  = var.enable_waf ? 1 : 0

  providers = {
    aws = aws.us_east_1
  }

  project_name = var.project_name
}

module "cdn" {
  source = "../modules/cdn"

  project_name                         = var.project_name
  frontend_bucket_id                   = local.foundation.frontend_bucket_id
  frontend_bucket_arn                  = local.foundation.frontend_bucket_arn
  frontend_bucket_regional_domain_name = local.foundation.frontend_bucket_regional_domain_name
  frontend_baseline_policy_json        = local.foundation.frontend_baseline_policy_json

  api_origin_domain   = local.api_origin_domain
  api_origin_https    = local.has_domain
  origin_verify_value = local.foundation.origin_verify_value
  origin_read_timeout = var.origin_read_timeout
  web_acl_arn         = one(module.waf[*].web_acl_arn)

  domain_name        = local.domain_name
  certificate_arn    = try(local.foundation.cloudfront_certificate_arn, null)
  create_dns_records = local.has_domain
  zone_id            = try(local.foundation.dns_zone_id, null)
}

module "healthcheck" {
  source = "../modules/healthcheck"
  count  = local.has_domain && var.enable_health_check ? 1 : 0

  providers = {
    aws = aws.us_east_1
  }

  project_name = var.project_name
  domain_name  = local.domain_name
  alert_emails = local.foundation.alert_emails

  depends_on = [module.cdn]
}
