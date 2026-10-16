variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "vpc_id" {
  description = "VPC chứa NAT (output vpc_id của 10-foundation)."
  type        = string

  validation {
    condition     = can(regex("^vpc-[0-9a-f]+$", var.vpc_id))
    error_message = "vpc_id phải có dạng vpc-xxxxxxxx."
  }
}

variable "private_route_table_ids" {
  description = "Map AZ -> private route table ID. Mỗi bảng nhận route 0.0.0.0/0 qua NAT."
  type        = map(string)

  validation {
    condition     = length(var.private_route_table_ids) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải có đúng 2 route table private."
  }
}

variable "alarm_topic_arn" {
  description = "SNS topic nhận cảnh báo. null = không tạo alarm."
  type        = string
  default     = null
}
