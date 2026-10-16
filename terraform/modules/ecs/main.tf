# ECS trên EC2 — Ke_Hoach_Ha_Tang.md Mục 4.4. Thuộc 20-runtime.
#
# Auto Scaling 2 tầng:
#   Tầng 1 (autoscaling.tf): Application Auto Scaling đổi desired_count theo CPU service.
#   Tầng 2 (file này):       Capacity Provider đổi số EC2 khi task PENDING vì hết chỗ/ENI.
#
# t4g.small có 3 ENI: 1 cho host, mỗi task awsvpc chiếm 1 => tối đa 2 task mỗi host.

data "aws_ssm_parameter" "ecs_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended/image_id"
}

# default_tags của provider không tự gắn vào EC2/EBS do ASG tạo; lấy ra để gắn tay,
# nhờ vậy instance mang CostTier=session và lộ ra ở bài kiểm tra Huong_dan Mục 8.3.
data "aws_default_tags" "current" {}

locals {
  name           = "${var.project_name}-backend"
  container_name = "backend"
  instance_tags  = merge(data.aws_default_tags.current.tags, { Name = "${var.project_name}-ecs-host" })
}

resource "aws_ecs_cluster" "main" {
  name = var.project_name

  # Container Insights tính phí theo metric; bật khi cần điều tra hiệu năng.
  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_launch_template" "ecs_host" {
  name_prefix   = "${var.project_name}-ecs-host-"
  image_id      = data.aws_ssm_parameter.ecs_ami.insecure_value
  instance_type = var.instance_type

  iam_instance_profile {
    name = var.instance_profile_name
  }

  vpc_security_group_ids = [var.host_security_group_id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  # ECS_AWSVPC_BLOCK_IMDS: task không đọc được credential của host qua IMDS.
  user_data = base64encode(<<-EOT
    #!/bin/bash
    cat >> /etc/ecs/ecs.config <<'EOF'
    ECS_CLUSTER=${aws_ecs_cluster.main.name}
    ECS_AWSVPC_BLOCK_IMDS=true
    ECS_CONTAINER_STOP_TIMEOUT=${var.stop_timeout}s
    ECS_ENABLE_TASK_IAM_ROLE=true
    EOF
  EOT
  )

  tag_specifications {
    resource_type = "instance"
    tags          = local.instance_tags
  }

  tag_specifications {
    resource_type = "volume"
    tags          = local.instance_tags
  }
}

resource "aws_autoscaling_group" "ecs_host" {
  name                = "${var.project_name}-ecs-host"
  vpc_zone_identifier = var.private_subnet_ids
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size

  # Bắt buộc khi Capacity Provider bật managed_termination_protection.
  protect_from_scale_in = true
  # Cho phép destroy ASG dù instance đang được bảo vệ scale-in.
  force_delete = true

  launch_template {
    id      = aws_launch_template.ecs_host.id
    version = aws_launch_template.ecs_host.latest_version
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }

  lifecycle {
    # Capacity Provider tự đổi desired_capacity.
    ignore_changes = [desired_capacity]
  }
}

resource "aws_ecs_capacity_provider" "ecs_host" {
  name = "${var.project_name}-ecs-host"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs_host.arn
    managed_termination_protection = "ENABLED"
    managed_draining               = "ENABLED"

    managed_scaling {
      status          = "ENABLED"
      target_capacity = 100
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = [aws_ecs_capacity_provider.ecs_host.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ecs_host.name
    weight            = 1
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_task_definition" "backend" {
  family                   = local.name
  requires_compatibilities = ["EC2"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name        = local.container_name
    image       = var.container_image
    essential   = true
    stopTimeout = var.stop_timeout

    portMappings = [{
      containerPort = var.backend_port
      protocol      = "tcp"
    }]

    environment = [for k in sort(keys(var.environment)) : { name = k, value = var.environment[k] }]
    secrets     = [for k in sort(keys(var.secrets)) : { name = k, valueFrom = var.secrets[k] }]

    # init process chuyển SIGTERM cho app (A12) và cần cho ECS Exec.
    linuxParameters = { initProcessEnabled = true }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.backend.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = local.container_name
      }
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = local.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.service_desired_count

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = var.health_check_grace_period
  enable_execute_command             = var.enable_execute_command
  force_delete                       = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ecs_host.name
    weight            = 1
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "instanceId"
  }

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.task_security_group_id]
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = local.container_name
    container_port   = var.backend_port
  }

  # Capacity provider phải gắn vào cluster trước khi service dùng nó.
  depends_on = [aws_ecs_cluster_capacity_providers.main]

  lifecycle {
    # Application Auto Scaling tự đổi desired_count.
    ignore_changes = [desired_count]
  }
}
