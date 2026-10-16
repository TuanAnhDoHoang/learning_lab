# S3 + CloudTrail — Ke_Hoach_Ha_Tang.md Mục 4.8 và 4.12. Chi phí: gần 0 USD
# (CloudTrail: bản sao đầu tiên của management events trong mỗi region là miễn phí).
#
# 3 bucket, cùng một bộ cứng hóa: chặn public đủ 4 cờ, BucketOwnerEnforced (tắt ACL),
# mã hóa SSE-S3, và policy từ chối mọi yêu cầu không qua TLS.
#
# Bucket policy của FRONTEND cố ý KHÔNG nằm ở đây: nó cần ARN của CloudFront distribution,
# mà distribution thuộc stack 30-edge. Module chỉ xuất policy nền (từ chối HTTP) qua
# output frontend_baseline_policy_json để 30-edge cộng thêm quyền đọc cho CloudFront.
# Mỗi bucket chỉ có MỘT policy, nên chỉ một stack được sở hữu nó.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  partition  = data.aws_partition.current.partition
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  # Tên bucket phải duy nhất toàn cầu nên gắn account và region (cùng quy ước với 00-bootstrap).
  bucket_names = {
    frontend   = "${var.project_name}-frontend-${local.account_id}-${local.region}"
    data       = "${var.project_name}-data-${local.account_id}-${local.region}"
    trail_logs = "${var.project_name}-trail-logs-${local.account_id}-${local.region}"
  }

  # ARN tính từ TÊN (biết ngay lúc plan) thay vì từ thuộc tính arn của resource (chỉ biết sau
  # apply). Nhờ vậy modules/security dùng được `data_bucket_arn != null` để quyết định
  # có cấp quyền S3 hay không mà plan không bị lỗi "value cannot be determined".
  bucket_arns = { for k, n in local.bucket_names : k => "arn:${local.partition}:s3:::${n}" }

  bucket_ids = {
    frontend   = aws_s3_bucket.frontend.bucket
    data       = aws_s3_bucket.data.bucket
    trail_logs = aws_s3_bucket.trail_logs.bucket
  }

  trail_name = "${var.project_name}-trail"
  trail_arn  = "arn:${local.partition}:cloudtrail:${local.region}:${local.account_id}:trail/${local.trail_name}"
}

resource "aws_s3_bucket" "frontend" {
  bucket        = local.bucket_names.frontend
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket" "data" {
  bucket        = local.bucket_names.data
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket" "trail_logs" {
  bucket        = local.bucket_names.trail_logs
  force_destroy = var.force_destroy
}

# ---------------------------------------------------------------------------
# Cứng hóa chung cho cả 3 bucket
# ---------------------------------------------------------------------------
resource "aws_s3_bucket_public_access_block" "this" {
  for_each = local.bucket_ids

  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = local.bucket_ids

  bucket = each.value

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.bucket_ids

  bucket = each.value

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Frontend bật versioning để rollback; Data bật vì Mục 4.8 yêu cầu.
# Trail logs không cần: log đã có file digest để kiểm tra toàn vẹn.
resource "aws_s3_bucket_versioning" "this" {
  for_each = { for k, v in local.bucket_ids : k => v if contains(["frontend", "data"], k) }

  bucket = each.value

  versioning_configuration {
    status = "Enabled"
  }
}

# Policy từ chối yêu cầu không qua TLS — nền của mọi bucket.
data "aws_iam_policy_document" "deny_insecure_transport" {
  for_each = local.bucket_arns

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [each.value, "${each.value}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

# ---------------------------------------------------------------------------
# Frontend — không có bucket policy ở đây (xem đầu file).
# Versioning giữ mọi bản build cũ; không dọn thì bản cũ tích lại mãi (cùng cái bẫy của Data).
# ---------------------------------------------------------------------------
resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.bucket

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "remove-expired-delete-markers"
    status = "Enabled"

    filter {}

    expiration {
      expired_object_delete_marker = true
    }
  }

  depends_on = [aws_s3_bucket_versioning.this]
}

# ---------------------------------------------------------------------------
# Data — ảnh upload của thí sinh
# ---------------------------------------------------------------------------
resource "aws_s3_bucket_policy" "data" {
  bucket = aws_s3_bucket.data.bucket
  policy = data.aws_iam_policy_document.deny_insecure_transport["data"].json

  # Sửa policy đồng thời với public access block gây lỗi OperationAborted.
  depends_on = [aws_s3_bucket_public_access_block.this]
}

# Bucket bật versioning: không có 2 rule dưới thì phiên bản cũ và delete marker giữ mãi.
resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.bucket

  rule {
    id     = "expire-objects-and-old-versions"
    status = "Enabled"

    filter {}

    expiration {
      days = var.data_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.data_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Sau khi bản hiện hành hết hạn S3 để lại delete marker; rule này dọn nó khi
  # không còn phiên bản nào phía sau.
  rule {
    id     = "remove-expired-delete-markers"
    status = "Enabled"

    filter {}

    expiration {
      expired_object_delete_marker = true
    }
  }

  depends_on = [aws_s3_bucket_versioning.this]
}

# Chỉ bật khi app upload thẳng từ trình duyệt bằng presigned URL (giả định A14).
resource "aws_s3_bucket_cors_configuration" "data" {
  count = length(var.data_cors_allowed_origins) > 0 ? 1 : 0

  bucket = aws_s3_bucket.data.bucket

  cors_rule {
    allowed_methods = ["GET", "PUT"]
    allowed_origins = var.data_cors_allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ---------------------------------------------------------------------------
# CloudTrail — nhật ký mọi thao tác quản trị trong account
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "trail_logs" {
  source_policy_documents = [data.aws_iam_policy_document.deny_insecure_transport["trail_logs"].json]

  # aws:SourceArn giới hạn trong đúng trail này (chống confused deputy: trail của
  # account khác không ghi vào bucket này được).
  statement {
    sid       = "CloudTrailAclCheck"
    effect    = "Allow"
    actions   = ["s3:GetBucketAcl"]
    resources = [local.bucket_arns.trail_logs]

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
  }

  statement {
    sid       = "CloudTrailWrite"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${local.bucket_arns.trail_logs}/AWSLogs/${local.account_id}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "trail_logs" {
  bucket = aws_s3_bucket.trail_logs.bucket
  policy = data.aws_iam_policy_document.trail_logs.json

  depends_on = [aws_s3_bucket_public_access_block.this]
}

resource "aws_s3_bucket_lifecycle_configuration" "trail_logs" {
  bucket = aws_s3_bucket.trail_logs.bucket

  rule {
    id     = "expire-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.trail_log_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_cloudtrail" "main" {
  name                          = local.trail_name
  s3_bucket_name                = aws_s3_bucket.trail_logs.bucket
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true

  # CloudTrail kiểm tra quyền ghi vào bucket ngay lúc tạo trail.
  depends_on = [aws_s3_bucket_policy.trail_logs]
}
