# Test OFFLINE — chạy bằng `terraform test`, KHÔNG cần tài khoản AWS, KHÔNG tốn tiền.
# Dùng mock_provider để giả lập AWS, chỉ kiểm tra logic cấu hình.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
    }
  }

  override_data {
    target = data.aws_iam_policy_document.state
    values = {
      json = "{}"
    }
  }
}

run "state_bucket_is_hardened" {
  command = apply

  assert {
    condition     = aws_s3_bucket.state.bucket == "stem-digitizer-tfstate-123456789012-ap-southeast-1"
    error_message = "Tên state bucket phải gồm project, account ID và region."
  }

  assert {
    condition     = aws_s3_bucket_versioning.state.versioning_configuration[0].status == "Enabled"
    error_message = "State bucket phải bật versioning."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.state.block_public_acls,
      aws_s3_bucket_public_access_block.state.block_public_policy,
      aws_s3_bucket_public_access_block.state.ignore_public_acls,
      aws_s3_bucket_public_access_block.state.restrict_public_buckets,
    ])
    error_message = "State bucket phải chặn public hoàn toàn."
  }

  assert {
    condition     = one([for r in aws_s3_bucket_server_side_encryption_configuration.state.rule : r.apply_server_side_encryption_by_default[0].sse_algorithm]) == "AES256"
    error_message = "Phải dùng SSE-S3 (AES256), không dùng KMS customer-managed key."
  }

  assert {
    condition     = aws_dynamodb_table.lock.hash_key == "LockID" && aws_dynamodb_table.lock.billing_mode == "PAY_PER_REQUEST"
    error_message = "Lock table phải có hash key LockID và billing on-demand."
  }
}

run "rejects_invalid_project_name" {
  command = plan

  variables {
    project_name = "Invalid_Name"
  }

  expect_failures = [var.project_name]
}
