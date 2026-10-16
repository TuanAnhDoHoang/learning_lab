# Test OFFLINE module s3 — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = data.aws_partition.current
    values = { partition = "aws" }
  }

  override_data {
    target = data.aws_region.current
    values = { region = "ap-southeast-1" }
  }

  # Provider mock sinh JSON không hợp lệ cho aws_iam_policy_document; bucket policy
  # kiểm tra JSON nên phải ghi đè. Nội dung policy được kiểm tra qua các khối `statement`.
  override_data {
    target = data.aws_iam_policy_document.deny_insecure_transport
    values = { json = "{}" }
  }

  override_data {
    target = data.aws_iam_policy_document.trail_logs
    values = { json = "{}" }
  }
}

variables {
  project_name = "stem-digitizer"
}

run "buckets_follow_naming_convention" {
  command = apply

  assert {
    condition     = aws_s3_bucket.frontend.bucket == "stem-digitizer-frontend-123456789012-ap-southeast-1"
    error_message = "Tên bucket Frontend phải là <project>-frontend-<account>-<region>."
  }

  assert {
    condition     = aws_s3_bucket.data.bucket == "stem-digitizer-data-123456789012-ap-southeast-1"
    error_message = "Tên bucket Data phải là <project>-data-<account>-<region>."
  }

  assert {
    condition     = aws_s3_bucket.trail_logs.bucket == "stem-digitizer-trail-logs-123456789012-ap-southeast-1"
    error_message = "Tên bucket log phải là <project>-trail-logs-<account>-<region>."
  }

  assert {
    condition     = alltrue([for b in [aws_s3_bucket.frontend.bucket, aws_s3_bucket.data.bucket, aws_s3_bucket.trail_logs.bucket] : length(b) <= 63])
    error_message = "Tên bucket S3 tối đa 63 ký tự."
  }
}

run "arn_outputs_are_known_at_plan_time" {
  command = plan

  assert {
    condition     = output.data_bucket_arn == "arn:aws:s3:::stem-digitizer-data-123456789012-ap-southeast-1"
    error_message = "ARN bucket Data phải tính từ tên bucket để modules/security quyết định được lúc plan."
  }

  assert {
    condition     = output.frontend_bucket_arn == "arn:aws:s3:::stem-digitizer-frontend-123456789012-ap-southeast-1"
    error_message = "ARN bucket Frontend phải tính từ tên bucket."
  }
}

run "every_bucket_is_locked_down" {
  command = apply

  assert {
    condition = alltrue([
      for k, p in aws_s3_bucket_public_access_block.this :
      p.block_public_acls && p.block_public_policy && p.ignore_public_acls && p.restrict_public_buckets
    ]) && length(aws_s3_bucket_public_access_block.this) == 3
    error_message = "Cả 3 bucket phải bật đủ 4 cờ chặn public."
  }

  assert {
    condition = alltrue([
      for k, o in aws_s3_bucket_ownership_controls.this : one(o.rule).object_ownership == "BucketOwnerEnforced"
    ]) && length(aws_s3_bucket_ownership_controls.this) == 3
    error_message = "Cả 3 bucket phải dùng BucketOwnerEnforced (tắt ACL)."
  }

  assert {
    condition = alltrue([
      for k, e in aws_s3_bucket_server_side_encryption_configuration.this :
      one(one(e.rule).apply_server_side_encryption_by_default).sse_algorithm == "AES256"
    ]) && length(aws_s3_bucket_server_side_encryption_configuration.this) == 3
    error_message = "Cả 3 bucket phải mã hóa SSE-S3 (AES256), không dùng KMS (Mục 3.2)."
  }
}

run "every_bucket_denies_plain_http" {
  command = apply

  assert {
    condition = alltrue([
      for k, d in data.aws_iam_policy_document.deny_insecure_transport : one([
        for s in d.statement : s.effect if s.sid == "DenyInsecureTransport"
      ]) == "Deny"
    ]) && length(data.aws_iam_policy_document.deny_insecure_transport) == 3
    error_message = "Policy nền của cả 3 bucket phải từ chối yêu cầu không qua TLS."
  }

  assert {
    condition = alltrue([
      for k, d in data.aws_iam_policy_document.deny_insecure_transport :
      flatten([for s in d.statement : [for c in s.condition : tolist(c.values)]]) == ["false"]
    ])
    error_message = "Điều kiện từ chối phải là aws:SecureTransport = false."
  }
}

run "versioning_only_on_frontend_and_data" {
  command = apply

  assert {
    condition     = toset(keys(aws_s3_bucket_versioning.this)) == toset(["frontend", "data"])
    error_message = "Chỉ Frontend (rollback) và Data (Mục 4.8) bật versioning."
  }

  assert {
    condition     = alltrue([for k, v in aws_s3_bucket_versioning.this : one(v.versioning_configuration).status == "Enabled"])
    error_message = "Versioning phải ở trạng thái Enabled."
  }
}

run "data_lifecycle_cleans_current_old_versions_and_delete_markers" {
  command = apply

  assert {
    condition = one([
      for r in aws_s3_bucket_lifecycle_configuration.data.rule : one(r.expiration).days if r.id == "expire-objects-and-old-versions"
    ]) == 14
    error_message = "Object hiện hành của bucket Data phải bị xóa sau 14 ngày."
  }

  assert {
    condition = one([
      for r in aws_s3_bucket_lifecycle_configuration.data.rule : one(r.noncurrent_version_expiration).noncurrent_days if r.id == "expire-objects-and-old-versions"
    ]) == 14
    error_message = "Phiên bản cũ của bucket Data phải bị xóa sau 14 ngày, nếu không versioning giữ ảnh cũ mãi mãi."
  }

  assert {
    condition = one([
      for r in aws_s3_bucket_lifecycle_configuration.data.rule : one(r.expiration).expired_object_delete_marker if r.id == "remove-expired-delete-markers"
    ]) == true
    error_message = "Phải dọn delete marker mồ côi."
  }
}

run "data_retention_is_configurable" {
  command = apply

  variables {
    data_retention_days = 3
  }

  assert {
    condition = one([
      for r in aws_s3_bucket_lifecycle_configuration.data.rule : one(r.expiration).days if r.id == "expire-objects-and-old-versions"
    ]) == 3
    error_message = "data_retention_days phải điều khiển thời hạn giữ object."
  }
}

run "frontend_lifecycle_prunes_old_builds" {
  command = apply

  assert {
    condition = one([
      for r in aws_s3_bucket_lifecycle_configuration.frontend.rule : one(r.noncurrent_version_expiration).noncurrent_days if r.id == "expire-old-versions"
    ]) == 30
    error_message = "Bản build cũ của Frontend phải được dọn sau 30 ngày."
  }
}

run "cors_is_off_by_default" {
  command = apply

  assert {
    condition     = length(aws_s3_bucket_cors_configuration.data) == 0
    error_message = "CORS phải tắt cho tới khi app xác nhận dùng presigned URL từ trình duyệt (A14)."
  }
}

run "cors_allows_only_listed_https_origin" {
  command = apply

  variables {
    data_cors_allowed_origins = ["https://thi.example.com"]
  }

  assert {
    condition     = one(aws_s3_bucket_cors_configuration.data[0].cors_rule).allowed_origins == toset(["https://thi.example.com"])
    error_message = "CORS chỉ cho đúng origin đã khai báo."
  }

  assert {
    condition     = one(aws_s3_bucket_cors_configuration.data[0].cors_rule).allowed_methods == toset(["GET", "PUT"])
    error_message = "CORS chỉ cho GET và PUT."
  }
}

run "cloudtrail_is_multi_region_with_validation" {
  command = apply

  assert {
    condition     = aws_cloudtrail.main.name == "stem-digitizer-trail"
    error_message = "Tên trail phải là <project>-trail."
  }

  assert {
    condition     = aws_cloudtrail.main.is_multi_region_trail && aws_cloudtrail.main.enable_log_file_validation && aws_cloudtrail.main.include_global_service_events
    error_message = "Trail phải đa region, bật kiểm tra toàn vẹn log và ghi cả dịch vụ toàn cầu (IAM)."
  }

  assert {
    condition     = aws_cloudtrail.main.s3_bucket_name == "stem-digitizer-trail-logs-123456789012-ap-southeast-1"
    error_message = "Trail phải ghi vào bucket log riêng."
  }
}

run "trail_bucket_policy_only_trusts_this_trail" {
  command = apply

  assert {
    condition     = toset([for s in data.aws_iam_policy_document.trail_logs.statement : s.sid]) == toset(["CloudTrailAclCheck", "CloudTrailWrite"])
    error_message = "Policy của bucket log chỉ thêm 2 quyền cho CloudTrail (policy nền được ghép qua source_policy_documents)."
  }

  assert {
    condition = toset(flatten([
      for s in data.aws_iam_policy_document.trail_logs.statement : [
        for c in s.condition : c.values if c.variable == "aws:SourceArn"
      ]
    ])) == toset(["arn:aws:cloudtrail:ap-southeast-1:123456789012:trail/stem-digitizer-trail"])
    error_message = "CloudTrail chỉ được ghi khi yêu cầu đến từ đúng trail này (chống confused deputy)."
  }

  assert {
    condition = one([
      for s in data.aws_iam_policy_document.trail_logs.statement : s.resources if s.sid == "CloudTrailWrite"
    ]) == toset(["arn:aws:s3:::stem-digitizer-trail-logs-123456789012-ap-southeast-1/AWSLogs/123456789012/*"])
    error_message = "CloudTrail chỉ được ghi vào thư mục AWSLogs của đúng account này."
  }

  assert {
    condition = one([
      for r in aws_s3_bucket_lifecycle_configuration.trail_logs.rule : one(r.expiration).days if r.id == "expire-logs"
    ]) == 90
    error_message = "Log CloudTrail phải bị xóa sau 90 ngày."
  }
}

run "rejects_project_name_that_makes_bucket_name_too_long" {
  command = plan

  variables {
    project_name = "a-very-long-project-name-x"
  }

  expect_failures = [var.project_name]
}

run "rejects_uppercase_project_name" {
  command = plan

  variables {
    project_name = "Stem-Digitizer"
  }

  expect_failures = [var.project_name]
}

run "rejects_http_cors_origin" {
  command = plan

  variables {
    data_cors_allowed_origins = ["http://thi.example.com"]
  }

  expect_failures = [var.data_cors_allowed_origins]
}

run "rejects_wildcard_cors_origin" {
  command = plan

  variables {
    data_cors_allowed_origins = ["*"]
  }

  expect_failures = [var.data_cors_allowed_origins]
}

run "rejects_zero_retention" {
  command = plan

  variables {
    data_retention_days = 0
  }

  expect_failures = [var.data_retention_days]
}
