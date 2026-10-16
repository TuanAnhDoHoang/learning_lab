# Test OFFLINE module cicd — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = data.aws_region.current
    values = { region = "ap-southeast-1" }
  }

  override_data {
    target = data.aws_iam_policy_document.codebuild_assume
    values = { json = "{}" }
  }

  override_data {
    target = data.aws_iam_policy_document.frontend
    values = { json = "{}" }
  }

  override_data {
    target = data.aws_iam_policy_document.backend
    values = { json = "{}" }
  }

  override_resource {
    target = aws_codeconnections_connection.github
    values = { arn = "arn:aws:codeconnections:ap-southeast-1:123456789012:connection/00000000-0000-0000-0000-000000000000" }
  }

  override_resource {
    target = aws_iam_role.frontend
    values = { arn = "arn:aws:iam::123456789012:role/stem-digitizer-codebuild-frontend" }
  }

  override_resource {
    target = aws_iam_role.backend
    values = { arn = "arn:aws:iam::123456789012:role/stem-digitizer-codebuild-backend" }
  }
}

variables {
  project_name         = "stem-digitizer"
  github_repo_url      = "https://github.com/example/learning-lab.git"
  ecr_repository_url   = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/stem-digitizer-backend"
  ecr_repository_arn   = "arn:aws:ecr:ap-southeast-1:123456789012:repository/stem-digitizer-backend"
  frontend_bucket_name = "stem-digitizer-frontend-123456789012-ap-southeast-1"
  frontend_bucket_arn  = "arn:aws:s3:::stem-digitizer-frontend-123456789012-ap-southeast-1"
  pass_role_arns = [
    "arn:aws:iam::123456789012:role/stem-digitizer-ecs-task-execution",
    "arn:aws:iam::123456789012:role/stem-digitizer-ecs-task",
  ]
}

run "builds_match_spec" {
  command = apply

  assert {
    condition     = aws_codebuild_project.backend.environment[0].type == "ARM_CONTAINER" && aws_codebuild_project.backend.environment[0].compute_type == "BUILD_GENERAL1_MEDIUM"
    error_message = "Backend build trên ARM native, cỡ MEDIUM (Mục 4.9)."
  }

  assert {
    condition     = one(aws_codebuild_project.backend.source[0].auth).type == "CODECONNECTIONS"
    error_message = "Kết nối GitHub qua CodeConnections, không dùng token cá nhân."
  }

  assert {
    condition     = strcontains(aws_codebuild_project.frontend.source[0].buildspec, "no-cache, no-store, must-revalidate")
    error_message = "index.html phải được upload với Cache-Control no-cache (nghiệm thu 2)."
  }

  assert {
    condition     = strcontains(aws_codebuild_project.backend.source[0].buildspec, "describe-images") && !strcontains(aws_codebuild_project.backend.source[0].buildspec, ":latest")
    error_message = "Backend tag theo git SHA, không đẩy lại tag đã có (IMMUTABLE), không dùng latest."
  }

  assert {
    condition     = length(aws_codebuild_webhook.this) == 0
    error_message = "Mặc định không tạo webhook — connection còn PENDING."
  }
}

run "webhooks_filter_by_folder" {
  command = plan

  variables {
    enable_webhooks = true
  }

  assert {
    condition     = length(aws_codebuild_webhook.this) == 2
    error_message = "Bật webhook thì mỗi project một webhook."
  }

  assert {
    condition     = flatten([for g in aws_codebuild_webhook.this["frontend"].filter_group : [for f in g.filter : f.pattern if f.type == "FILE_PATH"]]) == ["^app/"]
    error_message = "Webhook frontend chỉ chạy khi thư mục app/ đổi."
  }
}

run "rejects_small_rust_builder" {
  command = plan

  variables {
    backend_compute_type = "BUILD_GENERAL1_SMALL"
  }

  expect_failures = [var.backend_compute_type]
}

run "rejects_non_github_url" {
  command = plan

  variables {
    github_repo_url = "git@github.com:example/learning-lab.git"
  }

  expect_failures = [var.github_repo_url]
}
