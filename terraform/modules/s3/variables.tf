variable "project_name" {
  description = "Tiền tố tên bucket. Tên bucket đầy đủ là <project>-<mục đích>-<account>-<region>, tối đa 63 ký tự nên project_name bị giới hạn 3-24 ký tự."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-', dài 3-24 ký tự, bắt đầu và kết thúc bằng chữ hoặc số."
  }
}

variable "force_destroy" {
  description = "Cho phép destroy bucket kể cả khi còn object (kể cả mọi phiên bản cũ). Để false trừ khi bỏ hẳn dự án: bucket bật versioning không thể destroy khi còn dữ liệu."
  type        = bool
  default     = false
}

variable "data_retention_days" {
  description = "Số ngày giữ object trong bucket Data, và giữ phiên bản cũ sau khi bị ghi đè hoặc xóa (Mục 4.8)."
  type        = number
  default     = 14

  validation {
    condition     = var.data_retention_days >= 1 && floor(var.data_retention_days) == var.data_retention_days
    error_message = "data_retention_days phải là số nguyên từ 1 trở lên."
  }
}

variable "trail_log_retention_days" {
  description = "Số ngày giữ log CloudTrail (Mục 4.8)."
  type        = number
  default     = 90

  validation {
    condition     = var.trail_log_retention_days >= 1 && floor(var.trail_log_retention_days) == var.trail_log_retention_days
    error_message = "trail_log_retention_days phải là số nguyên từ 1 trở lên."
  }
}

variable "data_cors_allowed_origins" {
  description = "Origin được phép PUT/GET bucket Data từ trình duyệt, dạng https://<domain>. Chỉ điền khi app dùng presigned URL từ trình duyệt (giả định A14). Rỗng = không bật CORS."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for o in var.data_cors_allowed_origins : can(regex("^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$", o))])
    error_message = "Mỗi origin phải có dạng https://<domain> (chữ thường, không wildcard, không có đường dẫn, không dùng http)."
  }
}
