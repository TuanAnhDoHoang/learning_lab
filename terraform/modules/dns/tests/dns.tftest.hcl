# Test OFFLINE module dns — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_resource {
    target = aws_acm_certificate.origin
    values = {
      arn = "arn:aws:acm:ap-southeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000001"
      domain_validation_options = [{
        domain_name           = "origin.learninglab.example"
        resource_record_name  = "_a.origin.learninglab.example."
        resource_record_type  = "CNAME"
        resource_record_value = "_b.acm-validations.aws."
      }]
    }
  }
}

mock_provider "aws" {
  alias = "us_east_1"

  override_resource {
    target = aws_acm_certificate.cloudfront
    values = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000002"
      domain_validation_options = [{
        domain_name           = "learninglab.example"
        resource_record_name  = "_c.learninglab.example."
        resource_record_type  = "CNAME"
        resource_record_value = "_d.acm-validations.aws."
      }]
    }
  }
}

# Module khai báo configuration_aliases nên phải truyền cả 2 provider cho mỗi run.
variables {
  project_name = "stem-digitizer"
  domain_name  = "learninglab.example"
}

run "zone_and_two_certificates" {
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  command = apply

  assert {
    condition     = length(aws_route53_zone.main) == 1
    error_message = "Không truyền zone có sẵn thì phải tạo hosted zone."
  }

  assert {
    condition     = aws_acm_certificate.origin.domain_name == "origin.learninglab.example" && aws_acm_certificate.cloudfront.domain_name == "learninglab.example"
    error_message = "Cert ALB cho origin.<domain>, cert CloudFront cho <domain>."
  }

  assert {
    condition     = length(aws_route53_record.validation) == 2
    error_message = "Mỗi chứng chỉ một bản ghi xác thực DNS."
  }

  assert {
    condition     = output.cloudfront_certificate_arn == "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000002"
    error_message = "Cert CloudFront phải ở us-east-1."
  }
}

run "existing_zone_without_waiting" {
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  command   = apply
  state_key = "existing"

  variables {
    existing_zone_id    = "Z0123456789ABCDEFGHIJ"
    wait_for_validation = false
  }

  assert {
    condition     = length(aws_route53_zone.main) == 0 && output.zone_id == "Z0123456789ABCDEFGHIJ"
    error_message = "Có zone sẵn thì không tạo zone mới."
  }

  assert {
    condition     = length(aws_acm_certificate_validation.origin) == 0
    error_message = "wait_for_validation = false thì không chờ cấp chứng chỉ."
  }
}

run "rejects_trailing_dot" {
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  command = plan

  variables {
    domain_name = "learninglab.example."
  }

  expect_failures = [var.domain_name]
}
