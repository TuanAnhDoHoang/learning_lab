variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string
}

variable "domain_name" {
  description = "Tên miền gốc, ví dụ learninglab.vn."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.domain_name))
    error_message = "domain_name phải là tên miền chữ thường hợp lệ, không có dấu chấm cuối."
  }
}

variable "existing_zone_id" {
  description = "Hosted zone đã có (ví dụ domain mua qua Route 53 tự tạo zone). null = tạo zone mới."
  type        = string
  default     = null
}

variable "wait_for_validation" {
  description = "Chờ ACM cấp chứng chỉ trong lúc apply. false khi registrar chưa trỏ NS."
  type        = bool
  default     = true
}
