variable "project_name" {
  description = "Tiền tố tên secret."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "app_secret_names" {
  description = "Tên các secret của app mà Terraform chỉ tạo VỎ (JWT, Gemini key...). Giá trị đặt sau bằng `aws secretsmanager put-secret-value`, không bao giờ nằm trong Terraform hay Git. Tên đầy đủ là <project>/<tên>."
  type        = list(string)
  default     = ["jwt-secret"]

  validation {
    condition     = alltrue([for n in var.app_secret_names : can(regex("^[a-z0-9][a-z0-9-]{1,62}$", n))])
    error_message = "Mỗi tên secret chỉ gồm a-z, 0-9, '-', dài 2-63 ký tự, bắt đầu bằng chữ hoặc số (không chứa '/')."
  }

  validation {
    condition     = length(distinct(var.app_secret_names)) == length(var.app_secret_names)
    error_message = "Tên secret bị trùng."
  }
}

variable "recovery_window_in_days" {
  description = "Số ngày AWS giữ secret sau khi bị xóa trước khi xóa hẳn. Trong thời gian này KHÔNG tạo lại được secret cùng tên."
  type        = number
  default     = 7

  validation {
    condition     = var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30
    error_message = "recovery_window_in_days phải từ 7 đến 30 (không cho 0: xóa ngay, không cứu được)."
  }
}
