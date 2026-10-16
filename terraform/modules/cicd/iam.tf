# Mỗi project CodeBuild một role riêng: frontend không đụng được ECR/ECS, backend không
# ghi được S3 Frontend.

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

locals {
  common_statements = {
    logs = {
      actions = ["logs:CreateLogStream", "logs:PutLogEvents"]
    }
    connection = {
      actions   = ["codeconnections:UseConnection", "codeconnections:GetConnectionToken", "codestar-connections:UseConnection", "codestar-connections:GetConnectionToken"]
      resources = [aws_codeconnections_connection.github.arn]
    }
  }
}

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
resource "aws_iam_role" "frontend" {
  name               = "${var.project_name}-codebuild-frontend"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "frontend" {
  statement {
    sid       = "Logs"
    actions   = local.common_statements.logs.actions
    resources = ["${aws_cloudwatch_log_group.build["frontend"].arn}:*"]
  }

  statement {
    sid       = "GitHubConnection"
    actions   = local.common_statements.connection.actions
    resources = local.common_statements.connection.resources
  }

  statement {
    sid       = "ListFrontendBucket"
    actions   = ["s3:ListBucket"]
    resources = [var.frontend_bucket_arn]
  }

  statement {
    sid       = "SyncFrontendObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.frontend_bucket_arn}/*"]
  }

  # ListDistributions không giới hạn được theo resource.
  statement {
    sid       = "FindDistribution"
    actions   = ["cloudfront:ListDistributions"]
    resources = ["*"]
  }

  statement {
    sid       = "Invalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = ["arn:aws:cloudfront::${local.account_id}:distribution/*"]
  }
}

resource "aws_iam_role_policy" "frontend" {
  name   = "build-and-sync"
  role   = aws_iam_role.frontend.id
  policy = data.aws_iam_policy_document.frontend.json
}

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
resource "aws_iam_role" "backend" {
  name               = "${var.project_name}-codebuild-backend"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "backend" {
  statement {
    sid       = "Logs"
    actions   = local.common_statements.logs.actions
    resources = ["${aws_cloudwatch_log_group.build["backend"].arn}:*"]
  }

  statement {
    sid       = "GitHubConnection"
    actions   = local.common_statements.connection.actions
    resources = local.common_statements.connection.resources
  }

  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [var.ecr_repository_arn]
  }

  # Describe/Register task definition không giới hạn được theo resource.
  statement {
    sid       = "TaskDefinitions"
    actions   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }

  statement {
    sid       = "DeployService"
    actions   = ["ecs:DescribeServices", "ecs:UpdateService"]
    resources = ["arn:aws:ecs:${local.region}:${local.account_id}:service/${local.cluster_name}/${local.service_name}"]
  }

  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = var.pass_role_arns

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "backend" {
  name   = "build-push-deploy"
  role   = aws_iam_role.backend.id
  policy = data.aws_iam_policy_document.backend.json
}
