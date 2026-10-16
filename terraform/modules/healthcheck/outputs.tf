output "health_check_id" {
  description = "ID Route 53 Health Check."
  value       = aws_route53_health_check.site.id
}

output "alerts_topic_arn" {
  description = "SNS topic us-east-1."
  value       = aws_sns_topic.alerts.arn
}
