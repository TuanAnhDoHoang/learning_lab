# Test OFFLINE module cdn — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_iam_policy_document.frontend
    values = { json = "{}" }
  }

  override_resource {
    target = aws_cloudfront_function.spa_rewrite
    values = { arn = "arn:aws:cloudfront::123456789012:function/stem-digitizer-spa-rewrite" }
  }

  override_resource {
    target = aws_cloudfront_distribution.main
    values = {
      arn            = "arn:aws:cloudfront::123456789012:distribution/E1234567890ABC"
      domain_name    = "d111111abcdef8.cloudfront.net"
      hosted_zone_id = "Z2FDTNDATAQYW2"
    }
  }
}

variables {
  project_name                         = "stem-digitizer"
  frontend_bucket_id                   = "stem-digitizer-frontend-123456789012-ap-southeast-1"
  frontend_bucket_arn                  = "arn:aws:s3:::stem-digitizer-frontend-123456789012-ap-southeast-1"
  frontend_bucket_regional_domain_name = "stem-digitizer-frontend-123456789012-ap-southeast-1.s3.ap-southeast-1.amazonaws.com"
  frontend_baseline_policy_json        = "{}"
  api_origin_domain                    = "stem-digitizer-alb-123.ap-southeast-1.elb.amazonaws.com"
  api_origin_https                     = false
  origin_verify_value                  = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
  web_acl_arn                          = "arn:aws:wafv2:us-east-1:123456789012:global/webacl/stem-digitizer-cloudfront/abc"
}

run "routes_spa_and_api" {
  command = apply

  assert {
    condition     = aws_cloudfront_distribution.main.comment == "stem-digitizer"
    error_message = "Comment phải là project_name — CodeBuild tìm distribution theo đó."
  }

  assert {
    condition     = toset([for b in aws_cloudfront_distribution.main.ordered_cache_behavior : b.path_pattern]) == toset(["/api/*", "/auth/*"])
    error_message = "/api/* và /auth/* phải đi tới ALB."
  }

  assert {
    condition     = alltrue([for b in aws_cloudfront_distribution.main.ordered_cache_behavior : b.target_origin_id == "alb-api" && length(b.allowed_methods) == 7])
    error_message = "Behavior API phải tới ALB với đủ 7 method."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.main.custom_error_response) == 0
    error_message = "Không dùng custom_error_response (che lỗi thật của API) — SPA fallback bằng Function."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.main.default_cache_behavior[0].function_association) == 1
    error_message = "Behavior mặc định phải gắn CloudFront Function viết lại đường dẫn SPA."
  }

  assert {
    condition     = aws_cloudfront_distribution.main.web_acl_id == "arn:aws:wafv2:us-east-1:123456789012:global/webacl/stem-digitizer-cloudfront/abc"
    error_message = "Phải gắn WAF."
  }

  assert {
    condition     = length(aws_route53_record.apex) == 0 && aws_cloudfront_distribution.main.viewer_certificate[0].cloudfront_default_certificate
    error_message = "Chưa có tên miền thì dùng *.cloudfront.net, không tạo bản ghi."
  }
}

run "http_only_origin_without_alb_cert" {
  command = plan

  assert {
    condition = anytrue([
      for o in aws_cloudfront_distribution.main.origin : o.origin_id == "alb-api" &&
      one(o.custom_origin_config).origin_protocol_policy == "http-only" &&
      one(o.custom_origin_config).http_port == 443
    ])
    error_message = "ALB chưa có cert: CloudFront gọi HTTP vào cổng 443."
  }
}

run "custom_domain_with_records" {
  command   = apply
  state_key = "domain"

  variables {
    domain_name        = "learninglab.example"
    certificate_arn    = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000002"
    api_origin_domain  = "origin.learninglab.example"
    api_origin_https   = true
    create_dns_records = true
    zone_id            = "Z0123456789ABCDEFGHIJ"
  }

  assert {
    condition     = aws_cloudfront_distribution.main.aliases == toset(["learninglab.example"])
    error_message = "Distribution phải nhận tên miền."
  }

  assert {
    condition     = aws_cloudfront_distribution.main.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "Tên miền riêng phải dùng TLS ≥ 1.2."
  }

  assert {
    condition     = toset(keys(aws_route53_record.apex)) == toset(["A", "AAAA"])
    error_message = "Phải có bản ghi A và AAAA tới CloudFront."
  }
}

run "domain_requires_certificate" {
  command = plan

  variables {
    domain_name = "learninglab.example"
  }

  expect_failures = [var.certificate_arn]
}
