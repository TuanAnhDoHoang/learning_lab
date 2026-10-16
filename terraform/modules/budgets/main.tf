# AWS Budgets — lưới an toàn chi phí (Ke_Hoach_Ha_Tang.md Mục 0 và Mục 4.12).
# Chi phí: $0 (2 budget đầu tiên mỗi account miễn phí, cảnh báo email miễn phí).
#
# Budget áp dụng cho TOÀN BỘ account, cố ý không lọc theo tag Project:
#   - Rủi ro lớn nhất là resource mồ côi quên destroy — loại này thường KHÔNG có tag đúng.
#   - Lọc theo tag cần bật cost allocation tag thủ công trong Billing console.
#
# Giới hạn cần biết: dữ liệu chi phí AWS cập nhật chậm vài giờ đến khoảng 1 ngày.
# Budget là lưới an toàn cuối cùng, KHÔNG thay thế việc chạy kiểm tra sau mỗi lần destroy
# (Huong_dan_quan_ly_ha_tang.md Mục 8.3).

resource "aws_budgets_budget" "monthly" {
  name         = "${var.project_name}-monthly-cost"
  budget_type  = "COST"
  limit_amount = format("%.1f", var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = toset(var.actual_alert_thresholds)

    content {
      notification_type          = "ACTUAL"
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = var.alert_emails
      subscriber_sns_topic_arns  = var.alert_sns_topic_arns
    }
  }

  dynamic "notification" {
    for_each = var.forecast_alert_threshold == null ? [] : [var.forecast_alert_threshold]

    content {
      notification_type          = "FORECASTED"
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = var.alert_emails
      subscriber_sns_topic_arns  = var.alert_sns_topic_arns
    }
  }
}
