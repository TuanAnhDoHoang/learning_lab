# Test OFFLINE module security — `terraform test`, không cần AWS, không tốn tiền.
# Chạy độc lập với module network: vpc_id là ID giả.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
    }
  }

  override_data {
    target = data.aws_region.current
    values = {
      region = "ap-southeast-1"
    }
  }

  override_data {
    target = data.aws_partition.current
    values = {
      partition = "aws"
    }
  }

  override_data {
    target = data.aws_ec2_managed_prefix_list.cloudfront
    values = {
      id = "pl-31a34658"
    }
  }

  # Mock không tự sinh JSON hợp lệ cho aws_iam_policy_document.
  override_data {
    target = data.aws_iam_policy_document.ec2_assume
    values = { json = "{}" }
  }

  override_data {
    target = data.aws_iam_policy_document.ecs_tasks_assume
    values = { json = "{}" }
  }

  override_data {
    target = data.aws_iam_policy_document.task_execution_secrets
    values = { json = "{}" }
  }

  override_data {
    target = data.aws_iam_policy_document.task
    values = { json = "{}" }
  }
}

variables {
  project_name = "stem-digitizer"
  vpc_id       = "vpc-0a1b2c3d4e5f60718"
}

# ---------------------------------------------------------------------------
# Security Groups
# ---------------------------------------------------------------------------
run "security_group_chain_matches_spec" {
  command = apply

  assert {
    condition = alltrue([
      aws_security_group.alb.vpc_id == var.vpc_id,
      aws_security_group.ecs_task.vpc_id == var.vpc_id,
      aws_security_group.ecs_host.vpc_id == var.vpc_id,
      aws_security_group.rds.vpc_id == var.vpc_id,
    ])
    error_message = "Cả 4 Security Group phải nằm trong đúng VPC được truyền vào."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.alb_from_cloudfront.prefix_list_id == "pl-31a34658" &&
      aws_vpc_security_group_ingress_rule.alb_from_cloudfront.from_port == 443 &&
      aws_vpc_security_group_ingress_rule.alb_from_cloudfront.cidr_ipv4 == null
    )
    error_message = "ALB chỉ được nhận 443 từ prefix list CloudFront, không mở theo CIDR."
  }

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.alb_bypass_test) == 0
    error_message = "Mặc định không được mở IP test nào vào ALB."
  }

  assert {
    condition = (
      aws_vpc_security_group_egress_rule.alb_to_ecs_task.referenced_security_group_id == aws_security_group.ecs_task.id &&
      aws_vpc_security_group_egress_rule.alb_to_ecs_task.from_port == 3000
    )
    error_message = "ALB chỉ được đi ra ECS task trên backend_port."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.ecs_task_from_alb.referenced_security_group_id == aws_security_group.alb.id &&
      aws_vpc_security_group_ingress_rule.ecs_task_from_alb.from_port == 3000 &&
      aws_vpc_security_group_ingress_rule.ecs_task_from_alb.to_port == 3000
    )
    error_message = "ECS task chỉ được nhận từ ALB trên backend_port."
  }

  assert {
    condition = (
      aws_vpc_security_group_egress_rule.ecs_task_to_rds.referenced_security_group_id == aws_security_group.rds.id &&
      aws_vpc_security_group_egress_rule.ecs_task_to_rds.from_port == 5432
    )
    error_message = "ECS task phải đi ra RDS trên cổng 5432."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.rds_from_ecs_task.referenced_security_group_id == aws_security_group.ecs_task.id &&
      aws_vpc_security_group_ingress_rule.rds_from_ecs_task.from_port == 5432 &&
      aws_vpc_security_group_ingress_rule.rds_from_ecs_task.to_port == 5432
    )
    error_message = "RDS chỉ được nhận 5432 từ ECS task."
  }

  assert {
    condition     = aws_vpc_security_group_egress_rule.ecs_host_https.from_port == 443 && aws_vpc_security_group_egress_rule.ecs_host_https.to_port == 443
    error_message = "ECS host chỉ được đi ra HTTPS."
  }
}

run "bypass_test_ip_can_be_opened" {
  command = apply

  variables {
    bypass_test_cidrs = ["203.0.113.10/32"]
  }

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.alb_bypass_test) == 1
    error_message = "Khai báo 1 IP test thì phải có đúng 1 rule tạm."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.alb_bypass_test["203.0.113.10/32"].from_port == 443
    error_message = "Rule test chỉ được mở cổng 443."
  }
}

run "rejects_bypass_open_to_internet" {
  command = plan

  variables {
    bypass_test_cidrs = ["0.0.0.0/0"]
  }

  expect_failures = [var.bypass_test_cidrs]
}

run "rejects_bypass_network_range" {
  command = plan

  variables {
    bypass_test_cidrs = ["203.0.113.0/24"]
  }

  expect_failures = [var.bypass_test_cidrs]
}

run "rejects_invalid_vpc_id" {
  command = plan

  variables {
    vpc_id = "khong-phai-vpc"
  }

  expect_failures = [var.vpc_id]
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------
run "iam_defaults_are_least_privilege" {
  command = apply

  assert {
    condition = toset([for a in aws_iam_role_policy_attachment.ecs_instance : a.policy_arn]) == toset([
      "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
      "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    ])
    error_message = "EC2 host chỉ được có đúng 2 managed policy: ECS agent và SSM."
  }

  assert {
    condition     = aws_iam_instance_profile.ecs_instance.role == aws_iam_role.ecs_instance.name
    error_message = "Instance profile phải trỏ đúng role của EC2 host."
  }

  assert {
    condition     = aws_iam_role_policy_attachment.task_execution.policy_arn == "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    error_message = "Execution role phải có AmazonECSTaskExecutionRolePolicy."
  }

  assert {
    condition     = length(aws_iam_role_policy.task_execution_secrets) == 0
    error_message = "Không truyền secret nào thì execution role không được có quyền đọc secret."
  }

  assert {
    condition = alltrue([
      for s in data.aws_iam_policy_document.ecs_tasks_assume.statement :
      contains(flatten([for c in s.condition : c.variable]), "aws:SourceAccount") &&
      contains(flatten([for c in s.condition : c.variable]), "aws:SourceArn")
    ])
    error_message = "Trust policy của ECS task phải có điều kiện SourceAccount và SourceArn (chống confused deputy)."
  }

  assert {
    condition = flatten([
      for s in data.aws_iam_policy_document.ecs_tasks_assume.statement : [
        for c in s.condition : c.values if c.variable == "aws:SourceArn"
      ]
    ]) == ["arn:aws:ecs:ap-southeast-1:123456789012:*"]
    error_message = "SourceArn phải giới hạn trong đúng account và region."
  }

  # Mặc định chỉ bật ECS Exec => chỉ có statement EcsExec, không S3, không Bedrock.
  assert {
    condition     = [for s in data.aws_iam_policy_document.task[0].statement : s.sid] == ["EcsExec"]
    error_message = "Mặc định task role chỉ được có quyền ECS Exec."
  }
}

run "task_role_grants_only_what_is_passed" {
  command = apply

  variables {
    execution_secret_arns = ["arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-AbCdEf"]
    data_bucket_arn       = "arn:aws:s3:::stem-digitizer-data-123456789012"
    bedrock_model_arns    = ["arn:aws:bedrock:ap-southeast-1:123456789012:inference-profile/apac.amazon.nova-lite-v1:0"]
  }

  assert {
    condition     = length(aws_iam_role_policy.task_execution_secrets) == 1
    error_message = "Có secret thì execution role phải có policy đọc secret."
  }

  assert {
    condition = one(data.aws_iam_policy_document.task_execution_secrets[0].statement).resources == toset([
      "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-AbCdEf",
    ])
    error_message = "Execution role chỉ được đọc đúng các secret được truyền vào."
  }

  assert {
    condition = toset([for s in data.aws_iam_policy_document.task[0].statement : s.sid]) == toset([
      "EcsExec", "DataBucketObjects", "BedrockInvoke",
    ])
    error_message = "Task role phải có đủ 3 nhóm quyền khi truyền đủ input."
  }

  assert {
    condition = one([
      for s in data.aws_iam_policy_document.task[0].statement : s.resources if s.sid == "DataBucketObjects"
    ]) == toset(["arn:aws:s3:::stem-digitizer-data-123456789012/*"])
    error_message = "Quyền S3 chỉ áp dụng cho object trong đúng bucket Data."
  }

  assert {
    condition = one([
      for s in data.aws_iam_policy_document.task[0].statement : s.actions if s.sid == "DataBucketObjects"
    ]) == toset(["s3:GetObject", "s3:PutObject"])
    error_message = "Quyền S3 chỉ được Get và Put object — không List, không Delete."
  }
}

run "ses_permission_only_for_given_identity" {
  command = apply

  variables {
    ses_identity_arns = ["arn:aws:ses:ap-southeast-1:123456789012:identity/example.com"]
  }

  assert {
    condition = toset([for s in data.aws_iam_policy_document.task[0].statement : s.sid]) == toset([
      "EcsExec", "SesSendEmail",
    ])
    error_message = "Truyền identity SES thì task role phải có thêm quyền gửi email."
  }

  assert {
    condition = one([
      for s in data.aws_iam_policy_document.task[0].statement : s.resources if s.sid == "SesSendEmail"
    ]) == toset(["arn:aws:ses:ap-southeast-1:123456789012:identity/example.com"])
    error_message = "Quyền SES chỉ áp dụng cho đúng identity được truyền vào."
  }
}

run "rejects_wildcard_ses_identity" {
  command = plan

  variables {
    ses_identity_arns = ["arn:aws:ses:ap-southeast-1:123456789012:identity/*"]
  }

  expect_failures = [var.ses_identity_arns]
}

run "no_task_policy_when_everything_disabled" {
  command = apply

  variables {
    enable_ecs_exec = false
  }

  assert {
    condition     = length(aws_iam_role_policy.task) == 0
    error_message = "Không bật quyền nào thì task role không được có inline policy."
  }
}

run "rejects_wildcard_bedrock_arn" {
  command = plan

  variables {
    bedrock_model_arns = ["arn:aws:bedrock:ap-southeast-1::foundation-model/*"]
  }

  expect_failures = [var.bedrock_model_arns]
}

run "rejects_account_wide_secret_wildcard" {
  command = plan

  variables {
    execution_secret_arns = ["*"]
  }

  expect_failures = [var.execution_secret_arns]
}
