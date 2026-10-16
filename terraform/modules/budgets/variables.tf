variable "project_name" {
  description = "Tiền tố tên budget."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "monthly_budget_usd" {
  description = "Ngân sách chi phí toàn account mỗi tháng (USD). Vượt ngưỡng sẽ gửi cảnh báo, KHÔNG tự tắt resource."
  type        = number
  default     = 30

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "monthly_budget_usd phải lớn hơn 0."
  }
}

variable "actual_alert_thresholds" {
  description = "Các ngưỡng (% ngân sách) gửi cảnh báo theo chi phí ĐÃ phát sinh thực tế."
  type        = list(number)
  default     = [50, 80, 100]

  validation {
    condition     = length(var.actual_alert_thresholds) > 0 && alltrue([for t in var.actual_alert_thresholds : t > 0])
    error_message = "Phải có ít nhất 1 ngưỡng và mọi ngưỡng phải lớn hơn 0."
  }

  validation {
    condition     = length(distinct(var.actual_alert_thresholds)) == length(var.actual_alert_thresholds)
    error_message = "Các ngưỡng không được trùng nhau."
  }
}

variable "forecast_alert_threshold" {
  description = "Ngưỡng (% ngân sách) gửi cảnh báo khi chi phí DỰ BÁO cuối tháng vượt. null = không dùng cảnh báo dự báo."
  type        = number
  default     = 100

  validation {
    condition     = var.forecast_alert_threshold == null || try(var.forecast_alert_threshold > 0, false)
    error_message = "forecast_alert_threshold phải lớn hơn 0 hoặc null."
  }
}

variable "alert_emails" {
  description = "Email nhận cảnh báo chi phí. Không có giá trị mặc định: lưới an toàn phải báo tới người thật."
  type        = list(string)

  validation {
    condition     = alltrue([for e in var.alert_emails : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", e))])
    error_message = "Mọi phần tử của alert_emails phải là địa chỉ email hợp lệ."
  }

  validation {
    condition     = length(var.alert_emails) <= 10
    error_message = "AWS Budgets cho tối đa 10 email mỗi cảnh báo."
  }

  validation {
    condition     = length(var.alert_emails) + length(var.alert_sns_topic_arns) > 0
    error_message = "Phải có ít nhất 1 người nhận (alert_emails hoặc alert_sns_topic_arns) — cảnh báo không ai nhận thì vô dụng."
  }
}

variable "alert_sns_topic_arns" {
  description = "SNS topic nhận cảnh báo (tùy chọn). Gắn topic 'alerts' vào đây khi module observability có mặt."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for a in var.alert_sns_topic_arns : can(regex("^arn:aws[a-zA-Z-]*:sns:", a))])
    error_message = "Mọi phần tử của alert_sns_topic_arns phải là ARN của SNS topic."
  }

  validation {
    condition     = length(var.alert_sns_topic_arns) <= 1
    error_message = "AWS Budgets cho tối đa 1 SNS topic mỗi cảnh báo."
  }
}
