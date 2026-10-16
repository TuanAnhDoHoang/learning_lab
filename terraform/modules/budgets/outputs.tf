output "budget_name" {
  description = "Tên budget tháng."
  value       = aws_budgets_budget.monthly.name
}

output "budget_limit_usd" {
  description = "Ngân sách tháng đã đặt (USD, dạng chuỗi như AWS lưu)."
  value       = aws_budgets_budget.monthly.limit_amount
}

output "alert_emails" {
  description = "Email nhận cảnh báo chi phí trực tiếp."
  value       = var.alert_emails
}

output "actual_alert_thresholds" {
  description = "Các ngưỡng cảnh báo theo chi phí thực tế (% ngân sách)."
  value       = var.actual_alert_thresholds
}
