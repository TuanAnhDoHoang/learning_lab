variable "domain_name" {
  description = "Tên miền gửi email (identity SES)."
  type        = string
}

variable "create_dkim_records" {
  description = "Tự tạo 3 bản ghi DKIM trong zone_id. false = thêm tay theo output dkim_records."
  type        = bool
  default     = true
}

variable "zone_id" {
  description = "Hosted zone Route 53 chứa bản ghi DKIM. Bắt buộc khi create_dkim_records = true."
  type        = string
  default     = null

  validation {
    condition     = !var.create_dkim_records || var.zone_id != null
    error_message = "create_dkim_records = true cần zone_id."
  }
}
