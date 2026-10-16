variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string
}

variable "domain_name" {
  description = "Tên miền công khai cần theo dõi."
  type        = string
}

variable "resource_path" {
  description = "Đường dẫn kiểm tra — trang SPA tĩnh, không phụ thuộc 20-runtime."
  type        = string
  default     = "/index.html"
}

variable "alert_emails" {
  description = "Email nhận cảnh báo (phải bấm xác nhận thư AWS gửi)."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "Cần ít nhất 1 email."
  }
}
