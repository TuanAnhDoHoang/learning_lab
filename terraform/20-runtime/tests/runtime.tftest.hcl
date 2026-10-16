# Test OFFLINE TÍCH HỢP cho 20-runtime — `terraform test`, không cần AWS, không tốn tiền.
#
# Test chi tiết từng phần nằm ở terraform/modules/{nat,database,alb,ecs}/tests/. File này
# kiểm tra dây nối: output của 10-foundation đi đúng chỗ, secret được inject đúng cách.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = module.ecs.data.aws_ssm_parameter.ecs_ami
    values = { insecure_value = "ami-0123456789abcdef0" }
  }

  override_data {
    target = module.ecs.data.aws_default_tags.current
    values = { tags = { Project = "stem-digitizer", CostTier = "session" } }
  }

  override_resource {
    target = module.database.aws_db_instance.main
    values = {
      address = "stem-digitizer-db.abc.ap-southeast-1.rds.amazonaws.com"
      port    = 5432
      db_name = "stem_digitizer"
      master_user_secret = [{
        secret_arn    = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:rds!db-abc-123456"
        secret_status = "active"
        kms_key_id    = ""
      }]
    }
  }

  override_resource {
    target = module.alb.aws_lb.main
    values = {
      arn        = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:loadbalancer/app/stem-digitizer-alb/0123456789abcdef"
      arn_suffix = "app/stem-digitizer-alb/0123456789abcdef"
    }
  }

  override_resource {
    target = module.alb.aws_lb_target_group.api
    values = {
      arn        = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/stem-digitizer-api/0123456789abcdef"
      arn_suffix = "targetgroup/stem-digitizer-api/0123456789abcdef"
    }
  }

  override_resource {
    target = module.alb.aws_lb_listener.main
    values = { arn = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:listener/app/stem-digitizer-alb/0123456789abcdef/0123456789abcdef" }
  }

  override_resource {
    target = module.ecs.aws_launch_template.ecs_host
    values = { id = "lt-0123456789abcdef0", latest_version = 1 }
  }

  override_resource {
    target = module.ecs.aws_autoscaling_group.ecs_host
    values = { arn = "arn:aws:autoscaling:ap-southeast-1:123456789012:autoScalingGroup:00000000-0000-0000-0000-000000000000:autoScalingGroupName/stem-digitizer-ecs-host" }
  }

  override_resource {
    target = module.ecs.aws_ecs_cluster.main
    values = { id = "arn:aws:ecs:ap-southeast-1:123456789012:cluster/stem-digitizer" }
  }

  override_resource {
    target = module.ecs.aws_ecs_task_definition.backend
    values = { arn = "arn:aws:ecs:ap-southeast-1:123456789012:task-definition/stem-digitizer-backend:1" }
  }
}

# Giả lập output của 10-foundation (đúng tên trong 10-foundation/outputs.tf).
override_data {
  target = data.terraform_remote_state.foundation
  values = {
    outputs = {
      vpc_id                     = "vpc-0a1b2c3d4e5f60718"
      public_subnet_ids          = { "ap-southeast-1b" = "subnet-0pubbbbbbbbbbbbbb", "ap-southeast-1a" = "subnet-0pubaaaaaaaaaaaaa" }
      private_subnet_ids         = { "ap-southeast-1b" = "subnet-0prvbbbbbbbbbbbbb", "ap-southeast-1a" = "subnet-0prvaaaaaaaaaaaaa" }
      private_route_table_ids    = { "ap-southeast-1a" = "rtb-0aaaaaaaaaaaaaaaa", "ap-southeast-1b" = "rtb-0bbbbbbbbbbbbbbbb" }
      alerts_topic_arn           = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"
      alb_security_group_id      = "sg-0a1b0000000000001"
      ecs_task_security_group_id = "sg-0a1b0000000000002"
      ecs_host_security_group_id = "sg-0a1b0000000000003"
      rds_security_group_id      = "sg-0a1b0000000000004"
      ecs_instance_profile_name  = "stem-digitizer-ecs-instance"
      task_execution_role_arn    = "arn:aws:iam::123456789012:role/stem-digitizer-ecs-task-execution"
      task_execution_role_name   = "stem-digitizer-ecs-task-execution"
      task_role_arn              = "arn:aws:iam::123456789012:role/stem-digitizer-ecs-task"
      app_secret_arns            = { "jwt-secret" = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-secret-AbCdEf" }
      origin_verify_value        = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
      ecr_repository_name        = "stem-digitizer-backend"
      dns_zone_id                = null
      origin_fqdn                = null
      origin_certificate_arn     = null
    }
  }
}

# terraform test tự nạp terraform.tfvars của stack; ghim lại giá trị mặc định
# để test không phụ thuộc cấu hình thật (biến ở đây ưu tiên hơn tfvars).
variables {
  container_image   = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend:3f2a9c1"
  app_secret_env    = { JWT_SECRET = "jwt-secret" }
  extra_environment = {}
  db_env_names = {
    host     = "DB_HOST"
    port     = "DB_PORT"
    name     = "DB_NAME"
    username = "DB_USERNAME"
    password = "DB_PASSWORD"
  }
}

run "wires_foundation_outputs" {
  command = apply

  assert {
    condition     = data.terraform_remote_state.foundation.config.bucket == "stem-digitizer-tfstate-123456789012-ap-southeast-1"
    error_message = "Remote state phải đọc đúng bucket do 00-bootstrap tạo."
  }

  assert {
    condition     = local.private_subnet_ids == ["subnet-0prvaaaaaaaaaaaaa", "subnet-0prvbbbbbbbbbbbbb"]
    error_message = "Subnet phải lấy từ foundation và sắp theo AZ."
  }

  assert {
    condition     = length(module.nat.nat_gateway_id) > 0
    error_message = "Phải có NAT cho route private."
  }

  assert {
    condition     = aws_iam_role_policy.read_rds_secret.role == "stem-digitizer-ecs-task-execution"
    error_message = "Quyền đọc secret RDS phải gắn vào task execution role của foundation."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.read_rds_secret.policy).Statement[0].Resource == "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:rds!db-abc-123456"
    error_message = "Chỉ được đọc đúng secret RDS, không wildcard."
  }
}

run "injects_secrets_not_plain_env" {
  command = apply

  assert {
    condition     = local.container_secrets["JWT_SECRET"] == "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-secret-AbCdEf"
    error_message = "JWT_SECRET phải trỏ tới secret jwt-secret của foundation."
  }

  assert {
    condition = (
      local.container_secrets["DB_USERNAME"] == "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:rds!db-abc-123456:username::" &&
      local.container_secrets["DB_PASSWORD"] == "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:rds!db-abc-123456:password::"
    )
    error_message = "username/password DB phải inject từng khóa JSON của secret RDS (A3)."
  }

  assert {
    condition     = local.container_environment["DB_HOST"] == "stem-digitizer-db.abc.ap-southeast-1.rds.amazonaws.com" && local.container_environment["DB_PORT"] == "5432"
    error_message = "Host/port DB đi qua biến môi trường thường."
  }

  assert {
    condition     = !contains(keys(local.container_environment), "DB_PASSWORD") && !contains(keys(local.container_environment), "JWT_SECRET")
    error_message = "Secret không được nằm trong environment."
  }
}

run "custom_env_names" {
  command = plan

  variables {
    app_secret_env = { APP_JWT_KEY = "jwt-secret" }
    db_env_names = {
      host     = "PGHOST"
      port     = "PGPORT"
      name     = "PGDATABASE"
      username = "PGUSER"
      password = "PGPASSWORD"
    }
  }

  assert {
    condition     = contains(keys(local.container_secrets), "APP_JWT_KEY") && contains(keys(local.container_secrets), "PGPASSWORD")
    error_message = "Tên biến môi trường phải đổi được qua biến Terraform."
  }
}

run "uses_latest_ecr_image_when_not_pinned" {
  command   = plan
  state_key = "ecr"

  variables {
    container_image = null
  }

  override_data {
    target = data.aws_ecr_image.latest[0]
    values = { image_uri = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend:abc123def456" }
  }

  assert {
    condition     = local.container_image == "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend:abc123def456"
    error_message = "Không truyền image thì dùng image mới nhất trên ECR."
  }
}

run "no_domain_means_http_and_no_origin_record" {
  command = plan

  assert {
    condition     = local.alb_certificate_arn == null && length(aws_route53_record.origin) == 0
    error_message = "Foundation chưa có tên miền: không cert, không bản ghi origin."
  }
}
