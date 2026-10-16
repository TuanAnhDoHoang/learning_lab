# Test OFFLINE TÍCH HỢP cho 30-edge — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = module.cdn.data.aws_iam_policy_document.frontend
    values = { json = "{}" }
  }

  override_resource {
    target = module.cdn.aws_cloudfront_function.spa_rewrite
    values = { arn = "arn:aws:cloudfront::123456789012:function/stem-digitizer-spa-rewrite" }
  }

  override_resource {
    target = module.cdn.aws_cloudfront_distribution.main
    values = {
      arn            = "arn:aws:cloudfront::123456789012:distribution/E1234567890ABC"
      domain_name    = "d111111abcdef8.cloudfront.net"
      hosted_zone_id = "Z2FDTNDATAQYW2"
    }
  }
}

mock_provider "aws" {
  alias = "us_east_1"

  override_resource {
    target = module.waf[0].aws_wafv2_web_acl.main
    values = { arn = "arn:aws:wafv2:us-east-1:123456789012:global/webacl/stem-digitizer-cloudfront/abc" }
  }
}

override_data {
  target = data.terraform_remote_state.foundation
  values = {
    outputs = {
      frontend_bucket_id                   = "stem-digitizer-frontend-123456789012-ap-southeast-1"
      frontend_bucket_arn                  = "arn:aws:s3:::stem-digitizer-frontend-123456789012-ap-southeast-1"
      frontend_bucket_regional_domain_name = "stem-digitizer-frontend-123456789012-ap-southeast-1.s3.ap-southeast-1.amazonaws.com"
      frontend_baseline_policy_json        = "{}"
      origin_verify_value                  = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
      alert_emails                         = ["ops@example.com"]
      domain_name                          = null
      origin_fqdn                          = null
      dns_zone_id                          = null
      cloudfront_certificate_arn           = null
    }
  }
}

variables {
  api_origin_domain = "stem-digitizer-alb-123.ap-southeast-1.elb.amazonaws.com"
}

run "no_domain_uses_alb_dns_and_cloudfront_url" {
  command = apply

  assert {
    condition     = output.api_origin_domain == "stem-digitizer-alb-123.ap-southeast-1.elb.amazonaws.com"
    error_message = "Chưa có tên miền: CloudFront gọi thẳng DNS của ALB."
  }

  assert {
    condition     = output.site_url == "https://d111111abcdef8.cloudfront.net"
    error_message = "Chưa có tên miền: địa chỉ app là *.cloudfront.net."
  }

  assert {
    condition     = output.web_acl_arn == "arn:aws:wafv2:us-east-1:123456789012:global/webacl/stem-digitizer-cloudfront/abc"
    error_message = "WAF phải được tạo ở us-east-1 và gắn vào distribution."
  }

  assert {
    condition     = length(module.healthcheck) == 0
    error_message = "Chưa có tên miền thì không có Health Check."
  }
}

run "waf_can_be_disabled" {
  command = plan

  variables {
    enable_waf = false
  }

  assert {
    condition     = length(module.waf) == 0
    error_message = "enable_waf = false thì không tạo WAF."
  }
}

run "requires_origin_without_domain" {
  command = plan

  variables {
    api_origin_domain = null
  }

  expect_failures = [var.api_origin_domain]
}

run "domain_uses_origin_record_https_and_health_check" {
  command   = plan
  state_key = "domain"

  variables {
    api_origin_domain = null
  }

  override_data {
    target = data.terraform_remote_state.foundation
    values = {
      outputs = {
        frontend_bucket_id                   = "stem-digitizer-frontend-123456789012-ap-southeast-1"
        frontend_bucket_arn                  = "arn:aws:s3:::stem-digitizer-frontend-123456789012-ap-southeast-1"
        frontend_bucket_regional_domain_name = "stem-digitizer-frontend-123456789012-ap-southeast-1.s3.ap-southeast-1.amazonaws.com"
        frontend_baseline_policy_json        = "{}"
        origin_verify_value                  = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
        alert_emails                         = ["ops@example.com"]
        domain_name                          = "learninglab.example"
        origin_fqdn                          = "origin.learninglab.example"
        dns_zone_id                          = "Z0123456789ABCDEFGHIJ"
        cloudfront_certificate_arn           = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000002"
      }
    }
  }

  assert {
    condition     = local.api_origin_domain == "origin.learninglab.example"
    error_message = "Có tên miền: CloudFront gọi ALB qua origin.<domain>, không phụ thuộc state 20-runtime."
  }

  assert {
    condition     = length(module.healthcheck) == 1
    error_message = "Có tên miền thì có Route 53 Health Check."
  }

  assert {
    condition     = output.site_url == "https://learninglab.example"
    error_message = "Địa chỉ app là tên miền riêng."
  }
}
