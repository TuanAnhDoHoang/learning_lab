# Test OFFLINE module ecs — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_ssm_parameter.ecs_ami
    values = { insecure_value = "ami-0123456789abcdef0" }
  }

  override_data {
    target = data.aws_default_tags.current
    values = { tags = { Project = "stem-digitizer", CostTier = "session" } }
  }

  override_resource {
    target = aws_launch_template.ecs_host
    values = { id = "lt-0123456789abcdef0", latest_version = 1 }
  }

  override_resource {
    target = aws_autoscaling_group.ecs_host
    values = { arn = "arn:aws:autoscaling:ap-southeast-1:123456789012:autoScalingGroup:00000000-0000-0000-0000-000000000000:autoScalingGroupName/stem-digitizer-ecs-host" }
  }

  override_resource {
    target = aws_ecs_cluster.main
    values = { id = "arn:aws:ecs:ap-southeast-1:123456789012:cluster/stem-digitizer" }
  }

  override_resource {
    target = aws_ecs_task_definition.backend
    values = { arn = "arn:aws:ecs:ap-southeast-1:123456789012:task-definition/stem-digitizer-backend:1" }
  }
}

variables {
  project_name            = "stem-digitizer"
  aws_region              = "ap-southeast-1"
  private_subnet_ids      = ["subnet-0aaaaaaaaaaaaaaaa", "subnet-0bbbbbbbbbbbbbbbb"]
  host_security_group_id  = "sg-0aaaaaaaaaaaaaaaa"
  task_security_group_id  = "sg-0bbbbbbbbbbbbbbbb"
  instance_profile_name   = "stem-digitizer-ecs-instance"
  task_execution_role_arn = "arn:aws:iam::123456789012:role/stem-digitizer-ecs-task-execution"
  task_role_arn           = "arn:aws:iam::123456789012:role/stem-digitizer-ecs-task"
  target_group_arn        = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/stem-digitizer-api/0123456789abcdef"
  container_image         = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend:3f2a9c1"
  environment             = { RUST_LOG = "info", DB_HOST = "db.example" }
  alarm_topic_arn         = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"
  secrets = {
    JWT_SECRET  = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-secret-AbCdEf"
    DB_PASSWORD = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:rds!db-abc-123456:password::"
  }
}

run "hosts_are_hardened_graviton" {
  command = apply

  assert {
    condition     = aws_launch_template.ecs_host.instance_type == "t4g.small"
    error_message = "Host phải là t4g.small (Graviton arm64)."
  }

  assert {
    condition     = aws_launch_template.ecs_host.metadata_options[0].http_tokens == "required"
    error_message = "Bắt buộc IMDSv2."
  }

  assert {
    condition     = aws_launch_template.ecs_host.block_device_mappings[0].ebs[0].encrypted == "true"
    error_message = "EBS phải mã hóa."
  }

  assert {
    condition     = strcontains(base64decode(aws_launch_template.ecs_host.user_data), "ECS_AWSVPC_BLOCK_IMDS=true")
    error_message = "Task awsvpc không được đọc IMDS của host."
  }

  assert {
    condition     = alltrue([for t in aws_launch_template.ecs_host.tag_specifications : t.tags["CostTier"] == "session"])
    error_message = "EC2 và EBS do ASG tạo phải mang tag CostTier=session (Huong_dan Mục 8.3)."
  }
}

run "two_tier_autoscaling" {
  command = apply

  assert {
    condition     = aws_autoscaling_group.ecs_host.min_size == 2 && aws_autoscaling_group.ecs_host.max_size == 6
    error_message = "ASG min 2 (1 host mỗi AZ), max 6."
  }

  assert {
    condition     = aws_autoscaling_group.ecs_host.protect_from_scale_in && aws_autoscaling_group.ecs_host.force_delete
    error_message = "ASG phải bảo vệ scale-in (managed termination protection) và cho phép destroy."
  }

  assert {
    condition     = aws_ecs_capacity_provider.ecs_host.auto_scaling_group_provider[0].managed_termination_protection == "ENABLED"
    error_message = "Capacity Provider phải bật managed termination protection."
  }

  assert {
    condition     = aws_ecs_capacity_provider.ecs_host.auto_scaling_group_provider[0].managed_scaling[0].status == "ENABLED"
    error_message = "Capacity Provider phải bật managed scaling (tầng 2)."
  }

  assert {
    condition     = aws_appautoscaling_policy.cpu.target_tracking_scaling_policy_configuration[0].target_value == 60
    error_message = "Tầng 1 giữ CPU service quanh 60%."
  }

  assert {
    condition     = aws_appautoscaling_target.backend.min_capacity == 2 && aws_appautoscaling_target.backend.max_capacity == 6
    error_message = "Số task từ 2 đến 6."
  }
}

run "service_deploys_safely" {
  command = apply

  assert {
    condition     = aws_ecs_service.backend.deployment_minimum_healthy_percent == 100 && aws_ecs_service.backend.deployment_maximum_percent == 200
    error_message = "Rolling update 100/200 (Mục 3.1)."
  }

  assert {
    condition     = aws_ecs_service.backend.deployment_circuit_breaker[0].enable && aws_ecs_service.backend.deployment_circuit_breaker[0].rollback
    error_message = "Phải bật Circuit Breaker + rollback."
  }

  assert {
    condition     = aws_ecs_task_definition.backend.network_mode == "awsvpc" && aws_ecs_task_definition.backend.runtime_platform[0].cpu_architecture == "ARM64"
    error_message = "Task awsvpc, arm64."
  }

  assert {
    condition     = jsondecode(aws_ecs_task_definition.backend.container_definitions)[0].stopTimeout == 120
    error_message = "stopTimeout 120 giây (A12)."
  }

  assert {
    condition = (
      length(jsondecode(aws_ecs_task_definition.backend.container_definitions)[0].secrets) == 2 &&
      !strcontains(jsonencode(jsondecode(aws_ecs_task_definition.backend.container_definitions)[0].environment), "secretsmanager")
    )
    error_message = "Secret phải đi qua khối secrets, không nằm trong environment."
  }

  assert {
    condition     = aws_cloudwatch_log_group.backend.retention_in_days == 14
    error_message = "Log giữ 14 ngày."
  }

  assert {
    condition     = toset(keys(aws_cloudwatch_metric_alarm.service)) == toset(["cpu", "memory"])
    error_message = "Có topic thì phải có alarm CPU và Memory của service."
  }
}

run "rejects_latest_tag" {
  command = plan

  variables {
    container_image = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend:latest"
  }

  expect_failures = [var.container_image]
}

run "rejects_untagged_image" {
  command = plan

  variables {
    container_image = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend"
  }

  expect_failures = [var.container_image]
}
