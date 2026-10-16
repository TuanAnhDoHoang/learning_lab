output "alerts_topic_arn" {
  description = "ARN của SNS topic cảnh báo. 20-runtime dùng làm alarm_actions / ok_actions của mọi CloudWatch Alarm."
  value       = aws_sns_topic.alerts.arn
}

output "alerts_topic_name" {
  description = "Tên SNS topic cảnh báo."
  value       = aws_sns_topic.alerts.name
}

output "subscribed_emails" {
  description = "Email đã đăng ký nhận cảnh báo (mỗi email phải bấm xác nhận thư AWS gửi tới)."
  value       = sort([for s in aws_sns_topic_subscription.email : s.endpoint])
}
