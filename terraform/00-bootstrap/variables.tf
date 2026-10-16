variable "aws_region" {
  description = "Region đặt state bucket và lock table."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Tên dự án, dùng làm tiền tố tên resource (chữ thường, số, gạch ngang)."
  type        = string
  default     = "stem-digitizer"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự (vì dùng trong tên S3 bucket)."
  }
}

variable "environment" {
  description = "Tên môi trường, dùng cho tag."
  type        = string
  default     = "prod"
}

variable "state_noncurrent_version_days" {
  description = "Số ngày giữ các phiên bản cũ (noncurrent) của file state trước khi xóa."
  type        = number
  default     = 90
}
