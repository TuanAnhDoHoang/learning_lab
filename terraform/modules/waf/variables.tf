variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string
}

variable "auth_rate_limit" {
  description = "Số request /auth/* tối đa mỗi IP trong 1 phút (chống brute-force)."
  type        = number
  default     = 15

  validation {
    condition     = var.auth_rate_limit >= 10
    error_message = "WAF rate-based rule có ngưỡng tối thiểu 10."
  }
}

variable "ocr_rate_limit" {
  description = "Số request /api/new_exam_by_image tối đa mỗi IP trong 5 phút (chống tốn tiền AI)."
  type        = number
  default     = 10

  validation {
    condition     = var.ocr_rate_limit >= 10
    error_message = "WAF rate-based rule có ngưỡng tối thiểu 10 (bản cũ ghi 5 — không hợp lệ)."
  }
}
