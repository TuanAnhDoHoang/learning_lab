# Test OFFLINE module observability — `terraform test`, không cần AWS, không tốn tiền.

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
    target = data.aws_iam_policy_document.alerts_topic
    values = { json = "{}" }
  }

  # aws_sns_topic_subscription/aws_sns_topic_policy kiểm tra cú pháp ARN của topic.
  override_resource {
    target = aws_sns_topic.alerts
    values = { arn = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts" }
  }
}

variables {
  project_name = "stem-digitizer"
  alert_emails = ["ops@example.com", "lead@example.com"]
}

run "topic_and_subscriptions_match_spec" {
  command = apply

  assert {
    condition     = aws_sns_topic.alerts.name == "stem-digitizer-alerts"
    error_message = "Tên topic phải theo quy ước <project>-alerts."
  }

  assert {
    condition     = length(aws_sns_topic_subscription.email) == 2
    error_message = "Mỗi email phải có đúng 1 subscription."
  }

  assert {
    condition = alltrue([
      for s in aws_sns_topic_subscription.email : s.protocol == "email" && s.topic_arn == aws_sns_topic.alerts.arn
    ])
    error_message = "Subscription phải là email và gắn đúng topic alerts."
  }

  assert {
    condition     = aws_sns_topic.alerts.kms_master_key_id == null || aws_sns_topic.alerts.kms_master_key_id == ""
    error_message = "Không mã hóa bằng KMS (CloudWatch/Budgets không publish được vào topic mã hóa bằng khóa aws/sns)."
  }
}

run "topic_policy_restricts_services" {
  command = apply

  assert {
    condition = one([
      for s in data.aws_iam_policy_document.alerts_topic.statement : s.actions
      if s.sid == "ServicesPublishFromThisAccount"
    ]) == toset(["sns:Publish"])
    error_message = "Dịch vụ AWS chỉ được Publish, không có quyền quản lý topic."
  }

  assert {
    condition = toset(flatten([
      for s in data.aws_iam_policy_document.alerts_topic.statement : [
        for p in s.principals : p.identifiers
      ] if s.sid == "ServicesPublishFromThisAccount"
    ])) == toset(["cloudwatch.amazonaws.com", "budgets.amazonaws.com"])
    error_message = "Mặc định chỉ CloudWatch và Budgets được publish vào topic."
  }

  assert {
    condition = flatten([
      for s in data.aws_iam_policy_document.alerts_topic.statement : [
        for c in s.condition : c.values if c.variable == "aws:SourceAccount"
      ] if s.sid == "ServicesPublishFromThisAccount"
    ]) == ["123456789012"]
    error_message = "Dịch vụ chỉ được publish khi yêu cầu đến từ chính account này."
  }

  assert {
    condition     = contains([for s in data.aws_iam_policy_document.alerts_topic.statement : s.sid], "DenyInsecureTransport")
    error_message = "Topic phải từ chối yêu cầu không đi qua TLS."
  }
}

run "budgets_publish_can_be_disabled" {
  command = apply

  variables {
    allow_budgets_publish = false
  }

  assert {
    condition = toset(flatten([
      for s in data.aws_iam_policy_document.alerts_topic.statement : [
        for p in s.principals : p.identifiers
      ] if s.sid == "ServicesPublishFromThisAccount"
    ])) == toset(["cloudwatch.amazonaws.com"])
    error_message = "allow_budgets_publish = false thì chỉ còn CloudWatch được publish."
  }
}

run "rejects_no_email" {
  command = plan

  variables {
    alert_emails = []
  }

  expect_failures = [var.alert_emails]
}

run "rejects_invalid_email" {
  command = plan

  variables {
    alert_emails = ["khong-phai-email"]
  }

  expect_failures = [var.alert_emails]
}
