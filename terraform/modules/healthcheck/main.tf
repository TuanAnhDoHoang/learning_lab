# Route 53 Health Check — Ke_Hoach_Ha_Tang.md Mục 4.12, rủi ro R7 (domain hết hạn,
# CloudFront chết — Budgets không bắt được). Chi phí ~0,75 USD/tháng.
#
# Metric của Health Check chỉ có ở us-east-1 => alarm và SNS topic phải ở us-east-1
# (stack truyền provider aws.us_east_1 làm provider mặc định của module).

data "aws_caller_identity" "current" {}

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-us-east-1"
}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudWatchPublish"
      Effect    = "Allow"
      Principal = { Service = "cloudwatch.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.alerts.arn
      Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id } }
    }]
  })
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alert_emails)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_route53_health_check" "site" {
  fqdn              = var.domain_name
  type              = "HTTPS"
  port              = 443
  resource_path     = var.resource_path
  request_interval  = 30
  failure_threshold = 3
  enable_sni        = true

  tags = {
    Name = "${var.project_name}-site"
  }
}

resource "aws_cloudwatch_metric_alarm" "site_down" {
  alarm_name          = "${var.project_name}-site-down"
  alarm_description   = "${var.domain_name} không truy cập được (domain hết hạn, DNS hoặc CloudFront lỗi)"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.site.id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
