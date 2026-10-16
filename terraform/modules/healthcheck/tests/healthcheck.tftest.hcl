# Test OFFLINE module healthcheck — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_resource {
    target = aws_sns_topic.alerts
    values = { arn = "arn:aws:sns:us-east-1:123456789012:stem-digitizer-alerts-us-east-1" }
  }
}

variables {
  project_name = "stem-digitizer"
  domain_name  = "learninglab.example"
  alert_emails = ["ops@example.com"]
}

run "monitors_public_site" {
  command = apply

  assert {
    condition     = aws_route53_health_check.site.fqdn == "learninglab.example" && aws_route53_health_check.site.type == "HTTPS"
    error_message = "Health check phải gọi HTTPS vào tên miền công khai."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.site_down.alarm_actions == toset(["arn:aws:sns:us-east-1:123456789012:stem-digitizer-alerts-us-east-1"])
    error_message = "Alarm phải gửi vào SNS topic cùng region us-east-1."
  }

  assert {
    condition     = length(aws_sns_topic_subscription.email) == 1
    error_message = "Mỗi email một subscription."
  }
}

run "requires_email" {
  command = plan

  variables {
    alert_emails = []
  }

  expect_failures = [var.alert_emails]
}
