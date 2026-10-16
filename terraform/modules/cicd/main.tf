# CI/CD — Ke_Hoach_Ha_Tang.md Mục 4.9. Chi phí: CodeBuild tính theo phút build.
#
#   GitHub (push main) --CodeConnections--> CodeBuild frontend -> S3 + invalidation CloudFront
#                                       \-> CodeBuild backend  -> ECR (tag git SHA) -> ECS
#
# Buildspec viết ở đây (không nằm trong repo app), vì không được sửa code app.
# Tên cluster/service ECS và distribution CloudFront tra theo quy ước lúc build, nên
# module không phụ thuộc 20-runtime hay 30-edge; stack nào chưa dựng thì bước đó tự bỏ qua.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  region       = data.aws_region.current.region
  cluster_name = var.project_name
  service_name = "${var.project_name}-backend"
}

# Sau apply, trạng thái là PENDING: phải vào Console > Developer Tools > Connections bấm
# "Update pending connection" để cấp quyền GitHub. Terraform không làm được bước này.
resource "aws_codeconnections_connection" "github" {
  name          = "${var.project_name}-github"
  provider_type = "GitHub"
}

resource "aws_cloudwatch_log_group" "build" {
  for_each = toset(["frontend", "backend"])

  name              = "/codebuild/${var.project_name}-${each.key}"
  retention_in_days = var.log_retention_days
}

# ---------------------------------------------------------------------------
# Frontend: npm ci -> npm run build -> S3 -> invalidation
# ---------------------------------------------------------------------------
resource "aws_codebuild_project" "frontend" {
  name          = "${var.project_name}-frontend"
  description   = "Build React/Vite va dong bo len S3 Frontend"
  service_role  = aws_iam_role.frontend.arn
  build_timeout = 20

  source {
    type      = "GITHUB"
    location  = var.github_repo_url
    buildspec = local.frontend_buildspec

    auth {
      type     = "CODECONNECTIONS"
      resource = aws_codeconnections_connection.github.arn
    }
  }

  source_version = var.branch

  environment {
    type         = "LINUX_CONTAINER"
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/amazonlinux-x86_64-standard:5.0"

    environment_variable {
      name  = "FRONTEND_DIR"
      value = var.frontend_dir
    }

    environment_variable {
      name  = "FRONTEND_BUCKET"
      value = var.frontend_bucket_name
    }

    environment_variable {
      name  = "DISTRIBUTION_COMMENT"
      value = var.project_name
    }

    dynamic "environment_variable" {
      for_each = var.frontend_build_env
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  cache {
    type  = "LOCAL"
    modes = ["LOCAL_CUSTOM_CACHE"]
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.build["frontend"].name
    }
  }
}

locals {
  # index.html không cache; /assets/ (Vite băm tên) cache 1 năm; phần còn lại 5 phút.
  frontend_buildspec = <<-EOT
    version: 0.2
    phases:
      install:
        runtime-versions:
          nodejs: ${var.node_version}
      build:
        commands:
          - cd "$FRONTEND_DIR"
          - npm ci
          - npm run build
      post_build:
        commands:
          - test "$CODEBUILD_BUILD_SUCCEEDING" = "1"
          - aws s3 sync dist/assets "s3://$FRONTEND_BUCKET/assets" --cache-control "public,max-age=31536000,immutable"
          - aws s3 sync dist/ "s3://$FRONTEND_BUCKET" --exclude "assets/*" --exclude "index.html" --cache-control "public,max-age=300"
          - aws s3 cp dist/index.html "s3://$FRONTEND_BUCKET/index.html" --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html"
          - aws s3 sync dist/ "s3://$FRONTEND_BUCKET" --delete --size-only
          - DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='$DISTRIBUTION_COMMENT'].Id | [0]" --output text)
          - |
            if [ "$DIST_ID" != "None" ] && [ -n "$DIST_ID" ]; then
              aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
            else
              echo "Chua co distribution (30-edge chua dung) - bo qua invalidation"
            fi
    cache:
      paths:
        - '/root/.npm/**/*'
  EOT
}

# ---------------------------------------------------------------------------
# Backend: docker build arm64 -> ECR -> task definition mới -> update service
# ---------------------------------------------------------------------------
resource "aws_codebuild_project" "backend" {
  name          = "${var.project_name}-backend"
  description   = "Build image Rust arm64, day len ECR, deploy ECS"
  service_role  = aws_iam_role.backend.arn
  build_timeout = 60

  source {
    type      = "GITHUB"
    location  = var.github_repo_url
    buildspec = local.backend_buildspec

    auth {
      type     = "CODECONNECTIONS"
      resource = aws_codeconnections_connection.github.arn
    }
  }

  source_version = var.branch

  # ARM native (không cross-compile QEMU). MEDIUM = 4 vCPU, 8 GiB: liên kết Rust dễ hết RAM ở SMALL.
  environment {
    type            = "ARM_CONTAINER"
    compute_type    = var.backend_compute_type
    image           = "aws/codebuild/amazonlinux-aarch64-standard:3.0"
    privileged_mode = true

    environment_variable {
      name  = "BACKEND_DIR"
      value = var.backend_dir
    }

    environment_variable {
      name  = "DOCKERFILE"
      value = var.backend_dockerfile
    }

    environment_variable {
      name  = "REPOSITORY_URL"
      value = var.ecr_repository_url
    }

    environment_variable {
      name  = "CLUSTER"
      value = local.cluster_name
    }

    environment_variable {
      name  = "SERVICE"
      value = local.service_name
    }
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  cache {
    type  = "LOCAL"
    modes = ["LOCAL_DOCKER_LAYER_CACHE"]
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.build["backend"].name
    }
  }
}

locals {
  backend_buildspec = <<-EOT
    version: 0.2
    phases:
      pre_build:
        commands:
          - TAG=$(echo "$CODEBUILD_RESOLVED_SOURCE_VERSION" | cut -c1-12)
          - IMAGE="$REPOSITORY_URL:$TAG"
          - aws ecr get-login-password | docker login --username AWS --password-stdin "$${REPOSITORY_URL%%/*}"
      build:
        commands:
          - |
            if aws ecr describe-images --repository-name "$${REPOSITORY_URL#*/}" --image-ids imageTag="$TAG" >/dev/null 2>&1; then
              echo "Image $TAG da co (tag IMMUTABLE) - bo qua build"
            else
              docker build -t "$IMAGE" -f "$BACKEND_DIR/$DOCKERFILE" "$BACKEND_DIR"
              docker push "$IMAGE"
            fi
      post_build:
        commands:
          - test "$CODEBUILD_BUILD_SUCCEEDING" = "1"
          - STATUS=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].status' --output text 2>/dev/null || echo NONE)
          - |
            if [ "$STATUS" != "ACTIVE" ]; then
              echo "Service chua chay (20-runtime chua dung) - image da o ECR, lan dung sau se dung image moi nhat"
              exit 0
            fi
            CURRENT=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].taskDefinition' --output text)
            aws ecs describe-task-definition --task-definition "$CURRENT" --query taskDefinition \
              | jq --arg img "$IMAGE" '.containerDefinitions[0].image = $img
                  | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' > td.json
            NEW=$(aws ecs register-task-definition --cli-input-json file://td.json --query 'taskDefinition.taskDefinitionArn' --output text)
            aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --task-definition "$NEW" >/dev/null
            echo "Da deploy $NEW - Circuit Breaker se rollback neu task moi khong khoe"
  EOT
}

# ---------------------------------------------------------------------------
# Webhook — chỉ tạo sau khi connection đã AVAILABLE (enable_webhooks = true).
# Mỗi project chỉ chạy khi push vào main có đổi file trong thư mục của nó.
# ---------------------------------------------------------------------------
resource "aws_codebuild_webhook" "this" {
  for_each = var.enable_webhooks ? {
    frontend = { project = aws_codebuild_project.frontend.name, dir = var.frontend_dir }
    backend  = { project = aws_codebuild_project.backend.name, dir = var.backend_dir }
  } : {}

  project_name = each.value.project
  build_type   = "BUILD"

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH"
    }

    filter {
      type    = "HEAD_REF"
      pattern = "^refs/heads/${var.branch}$"
    }

    filter {
      type    = "FILE_PATH"
      pattern = "^${each.value.dir}/"
    }
  }
}
