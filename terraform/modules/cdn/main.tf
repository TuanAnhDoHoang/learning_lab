# CloudFront — Ke_Hoach_Ha_Tang.md Mục 4.7. Một domain cho cả SPA (S3) và API (ALB).
#
#   /api/*, /auth/*  -> ALB, không cache, forward mọi header trừ Host + header X-Origin-Verify
#   *                -> S3 Frontend qua OAC, cache, CloudFront Function viết lại đường dẫn SPA
#
# SPA fallback bằng Function thay vì custom_error_response: custom_error_response áp cho cả
# distribution nên 403/404 của /api/* cũng bị đổi thành index.html mã 200, che lỗi thật.

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  s3_origin_id  = "s3-frontend"
  api_origin_id = "alb-api"
  has_domain    = var.domain_name != null
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend"
  description                       = "CloudFront doc S3 Frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${var.project_name}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Duong dan khong co phan mo rong -> /index.html"
  publish = true
  code    = file("${path.module}/spa_rewrite.js")
}

resource "aws_cloudfront_distribution" "main" {
  # CodeBuild frontend tìm distribution theo Comment này để invalidation.
  comment             = var.project_name
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = local.has_domain ? [var.domain_name] : []
  web_acl_id          = var.web_acl_arn

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = var.frontend_bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = var.api_origin_domain

    # Chưa có cert ALB: listener HTTP trên cổng 443 (xem modules/alb), nên http-only + http_port 443.
    custom_origin_config {
      origin_protocol_policy   = var.api_origin_https ? "https-only" : "http-only"
      http_port                = 443
      https_port               = 443
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = var.origin_read_timeout
      origin_keepalive_timeout = 60
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = var.origin_verify_value
    }
  }

  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = ["/api/*", "/auth/*"]

    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = local.api_origin_id
      viewer_protocol_policy   = "https-only"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
      compress                 = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.has_domain
    acm_certificate_arn            = local.has_domain ? var.certificate_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : "TLSv1"
  }
}

# Chỉ đúng distribution này được GetObject. Không cấp ListBucket => file thiếu trả 403,
# không lộ danh sách object.
data "aws_iam_policy_document" "frontend" {
  source_policy_documents = [var.frontend_baseline_policy_json]

  statement {
    sid       = "CloudFrontReadOnly"
    actions   = ["s3:GetObject"]
    resources = ["${var.frontend_bucket_arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = var.frontend_bucket_id
  policy = data.aws_iam_policy_document.frontend.json
}

resource "aws_route53_record" "apex" {
  for_each = var.create_dns_records ? toset(["A", "AAAA"]) : toset([])

  zone_id = var.zone_id
  name    = var.domain_name
  type    = each.value

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}
