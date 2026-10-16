# IAM roles cho ECS trên EC2 — Ke_Hoach_Ha_Tang.md Mục 4.2. Chi phí: $0.
#
# Có 3 role, tách biệt theo nguyên tắc least privilege:
#   ecs_instance   — EC2 host: đăng ký vào ECS cluster, SSM Session Manager
#   task_execution — ECS agent dùng khi KHỞI ĐỘNG task: kéo image, ghi log, lấy secret
#   task           — code app dùng khi CHẠY: S3 Data, Bedrock, ECS Exec
#
# Role cho CodeBuild KHÔNG nằm ở đây: nó cần ARN của ECR repo, S3 frontend, CloudFront
# — sẽ viết cùng module cicd để quyền đi liền với resource.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_partition" "current" {}

locals {
  partition  = data.aws_partition.current.partition
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
}

# ---------------------------------------------------------------------------
# EC2 instance role
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_instance" {
  name               = "${var.project_name}-ecs-instance"
  description        = "EC2 host chay ECS agent va SSM"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  for_each = toset([
    "service-role/AmazonEC2ContainerServiceforEC2Role",
    "AmazonSSMManagedInstanceCore",
  ])

  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/${each.value}"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "${var.project_name}-ecs-instance"
  role = aws_iam_role.ecs_instance.name
}

# ---------------------------------------------------------------------------
# Trust policy dùng chung cho 2 role của ECS task.
# Điều kiện SourceAccount/SourceArn chống "confused deputy": chỉ ECS trong
# đúng account + region này được assume role, không phải ECS của account khác.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:${local.partition}:ecs:${local.region}:${local.account_id}:*"]
    }
  }
}

# ---------------------------------------------------------------------------
# Task execution role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "task_execution" {
  name               = "${var.project_name}-ecs-task-execution"
  description        = "ECS agent: keo image ECR, ghi log, inject secret luc khoi dong task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_secrets" {
  count = length(var.execution_secret_arns) > 0 ? 1 : 0

  statement {
    sid       = "ReadInjectedSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.execution_secret_arns
  }
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  count = length(var.execution_secret_arns) > 0 ? 1 : 0

  name   = "read-injected-secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_secrets[0].json
}

# ---------------------------------------------------------------------------
# Task role — quyền của code app. Mỗi nhóm quyền chỉ xuất hiện khi được bật.
# ---------------------------------------------------------------------------
locals {
  task_policy_enabled = (
    var.enable_ecs_exec ||
    var.data_bucket_arn != null ||
    length(var.bedrock_model_arns) > 0 ||
    length(var.ses_identity_arns) > 0
  )
}

resource "aws_iam_role" "task" {
  name               = "${var.project_name}-ecs-task"
  description        = "Quyen cua code backend khi chay"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task" {
  count = local.task_policy_enabled ? 1 : 0

  # ECS Exec: 4 action tối thiểu, AWS yêu cầu resource "*".
  dynamic "statement" {
    for_each = var.enable_ecs_exec ? [1] : []

    content {
      sid    = "EcsExec"
      effect = "Allow"
      actions = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel",
      ]
      resources = ["*"]
    }
  }

  # Chỉ đọc/ghi object, không liệt kê, không xóa, không đổi cấu hình bucket.
  dynamic "statement" {
    for_each = var.data_bucket_arn == null ? [] : [var.data_bucket_arn]

    content {
      sid       = "DataBucketObjects"
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:PutObject"]
      resources = ["${statement.value}/*"]
    }
  }

  dynamic "statement" {
    for_each = length(var.bedrock_model_arns) > 0 ? [1] : []

    content {
      sid       = "BedrockInvoke"
      effect    = "Allow"
      actions   = ["bedrock:InvokeModel"]
      resources = var.bedrock_model_arns
    }
  }

  # Email giao dịch (Ke_Hoach_Ha_Tang.md Mục 4.13) — chỉ khi A17 xác nhận app gửi email.
  # Gửi được từ đúng các identity đã verify, không phải mọi địa chỉ trong account.
  dynamic "statement" {
    for_each = length(var.ses_identity_arns) > 0 ? [1] : []

    content {
      sid       = "SesSendEmail"
      effect    = "Allow"
      actions   = ["ses:SendEmail", "ses:SendRawEmail"]
      resources = var.ses_identity_arns
    }
  }
}

resource "aws_iam_role_policy" "task" {
  count = local.task_policy_enabled ? 1 : 0

  name   = "app-permissions"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task[0].json
}
