# Test OFFLINE module ecr — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {}

variables {
  project_name = "stem-digitizer"
}

run "repository_matches_spec" {
  command = apply

  assert {
    condition     = aws_ecr_repository.backend.name == "stem-digitizer-backend"
    error_message = "Tên repository phải là <project>-backend."
  }

  assert {
    condition     = aws_ecr_repository.backend.image_tag_mutability == "IMMUTABLE"
    error_message = "Tag phải IMMUTABLE để rollback có ý nghĩa."
  }

  assert {
    condition     = aws_ecr_repository.backend.image_scanning_configuration[0].scan_on_push
    error_message = "Phải quét lỗ hổng khi push."
  }

  assert {
    condition     = aws_ecr_repository.backend.force_delete == false
    error_message = "Mặc định không cho xóa repository còn image."
  }

  assert {
    condition     = jsondecode(aws_ecr_lifecycle_policy.backend.policy).rules[1].selection.countNumber == 10
    error_message = "Lifecycle giữ 10 image gần nhất."
  }
}

run "rejects_keeping_single_image" {
  command = plan

  variables {
    keep_image_count = 1
  }

  expect_failures = [var.keep_image_count]
}
