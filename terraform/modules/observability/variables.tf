variable "project_name" {
  description = "Tiền tố tên SNS topic."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "alert_emails" {
  description = "Email của team nhận cảnh báo vận hành (CloudWatch Alarms). Mỗi email phải bấm xác nhận thư AWS gửi tới thì mới nhận được cảnh báo."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "Phải có ít nhất 1 email — cảnh báo không ai nhận thì vô dụng."
  }

  validation {
    condition     = alltrue([for e in var.alert_emails : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", e))])
    error_message = "Mọi phần tử của alert_emails phải là địa chỉ email hợp lệ."
  }
}

variable "allow_budgets_publish" {
  description = "Cho phép AWS Budgets gửi vào topic. Để true để sau này có thể chuyển cảnh báo chi phí sang SNS (ví dụ nối Slack) mà không phải sửa policy."
  type        = bool
  default     = true
}
