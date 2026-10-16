variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "keep_image_count" {
  description = "Số image gần nhất được giữ lại."
  type        = number
  default     = 10

  validation {
    condition     = var.keep_image_count >= 2
    error_message = "Giữ ít nhất 2 image để còn bản rollback."
  }
}

variable "force_delete" {
  description = "Cho phép destroy repository còn image. Chỉ bật khi bỏ hẳn dự án."
  type        = bool
  default     = false
}
