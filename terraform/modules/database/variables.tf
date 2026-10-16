variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "private_subnet_ids" {
  description = "2 private subnet (2 AZ) cho DB subnet group."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải có đúng 2 private subnet."
  }
}

variable "security_group_id" {
  description = "SG rds của 10-foundation (chỉ nhận 5432 từ ecs_task)."
  type        = string
}

variable "instance_class" {
  description = "Cỡ máy RDS."
  type        = string
  default     = "db.t4g.small"
}

variable "multi_az" {
  description = "Standby ở AZ thứ hai (Mục 3.1). false chỉ dùng khi tài khoản ở gói Free plan."
  type        = bool
  default     = true
}

variable "engine_version" {
  description = "Phiên bản PostgreSQL. Chỉ ghi số major để AWS tự chọn bản minor mới nhất."
  type        = string
  default     = "17"
}

variable "db_name" {
  description = "Tên database tạo lúc dựng mới. Bị bỏ qua khi khôi phục từ snapshot."
  type        = string
  default     = "stem_digitizer"

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{0,62}$", var.db_name))
    error_message = "db_name bắt đầu bằng chữ thường, chỉ gồm a-z, 0-9, '_'."
  }
}

variable "master_username" {
  description = "User quản trị. Mật khẩu do RDS tự tạo và lưu trong Secrets Manager."
  type        = string
  default     = "app_admin"

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{0,15}$", var.master_username)) && !contains(["postgres", "rdsadmin", "admin"], var.master_username)
    error_message = "master_username: chữ thường, tối đa 16 ký tự, không dùng tên dành riêng (postgres, rdsadmin, admin)."
  }
}

variable "allocated_storage" {
  description = "Dung lượng ban đầu (GiB)."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Trần Storage Auto Scaling (GiB)."
  type        = number
  default     = 100

  validation {
    condition     = var.max_allocated_storage > var.allocated_storage
    error_message = "max_allocated_storage phải lớn hơn allocated_storage để Storage Auto Scaling có tác dụng."
  }
}

variable "backup_retention_days" {
  description = "Số ngày giữ automated backup (Mục 3.1: 7 ngày, đặt 30 trước Public Launch)."
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "backup_retention_days phải từ 1 đến 35."
  }
}

variable "restore_snapshot_id" {
  description = "Snapshot để khôi phục dữ liệu. null = database trắng. Chỉ có tác dụng lúc tạo instance."
  type        = string
  default     = null
}

variable "deletion_protection" {
  description = "Chặn xóa RDS. Phải apply với false trước khi destroy (Huong_dan Mục 8.1)."
  type        = bool
  default     = true
}

variable "alarm_topic_arn" {
  description = "SNS topic nhận cảnh báo. null = không tạo alarm."
  type        = string
  default     = null
}

variable "connections_alarm_threshold" {
  description = "Ngưỡng cảnh báo số connection."
  type        = number
  default     = 100
}
