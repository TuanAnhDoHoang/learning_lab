# Test OFFLINE module budgets — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {}

variables {
  project_name = "stem-digitizer"
  alert_emails = ["ops@example.com"]
}

run "budget_matches_spec" {
  command = apply

  assert {
    condition     = aws_budgets_budget.monthly.budget_type == "COST" && aws_budgets_budget.monthly.time_unit == "MONTHLY"
    error_message = "Budget phải là COST theo tháng."
  }

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "30.0" && aws_budgets_budget.monthly.limit_unit == "USD"
    error_message = "Ngân sách mặc định phải là 30 USD (Ke_Hoach_Ha_Tang.md Mục 4.12)."
  }

  assert {
    condition     = length(aws_budgets_budget.monthly.notification) == 4
    error_message = "Phải có 4 cảnh báo: thực tế 50%, 80%, 100% và dự báo 100%."
  }

  assert {
    condition = toset([
      for n in aws_budgets_budget.monthly.notification : n.threshold if n.notification_type == "ACTUAL"
    ]) == toset([50, 80, 100])
    error_message = "Cảnh báo thực tế phải ở đúng các ngưỡng 50%, 80%, 100%."
  }

  assert {
    condition = [
      for n in aws_budgets_budget.monthly.notification : n.threshold if n.notification_type == "FORECASTED"
    ] == [100]
    error_message = "Phải có đúng 1 cảnh báo dự báo ở ngưỡng 100%."
  }

  assert {
    condition = alltrue([
      for n in aws_budgets_budget.monthly.notification :
      contains(n.subscriber_email_addresses, "ops@example.com") && n.threshold_type == "PERCENTAGE"
    ])
    error_message = "Mọi cảnh báo phải gửi tới email đã khai báo và tính theo phần trăm."
  }
}

run "forecast_can_be_disabled" {
  command = apply

  variables {
    forecast_alert_threshold = null
  }

  assert {
    condition     = length([for n in aws_budgets_budget.monthly.notification : n if n.notification_type == "FORECASTED"]) == 0
    error_message = "forecast_alert_threshold = null thì không được có cảnh báo dự báo."
  }
}

run "sns_only_is_accepted" {
  command = plan

  variables {
    alert_emails         = []
    alert_sns_topic_arns = ["arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"]
  }
}

run "rejects_no_subscriber" {
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

run "rejects_non_positive_budget" {
  command = plan

  variables {
    monthly_budget_usd = 0
  }

  expect_failures = [var.monthly_budget_usd]
}
