variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "aws_region" {
  description = "Region ghi log CloudWatch."
  type        = string
}

variable "private_subnet_ids" {
  description = "2 private subnet (2 AZ) cho EC2 host và ENI của task."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải có đúng 2 private subnet."
  }
}

variable "host_security_group_id" {
  description = "SG ecs_host của 10-foundation."
  type        = string
}

variable "task_security_group_id" {
  description = "SG ecs_task của 10-foundation."
  type        = string
}

variable "instance_profile_name" {
  description = "Instance profile ecs-instance của 10-foundation."
  type        = string
}

variable "task_execution_role_arn" {
  description = "Role ECS agent dùng lúc khởi động task."
  type        = string
}

variable "task_role_arn" {
  description = "Role code app dùng lúc chạy."
  type        = string
}

variable "target_group_arn" {
  description = "Target group của ALB."
  type        = string
}

# ---------------------------------------------------------------------------
# Container
# ---------------------------------------------------------------------------
variable "container_image" {
  description = "Image arm64 của backend, tag theo git SHA (A5). Không dùng tag latest."
  type        = string

  validation {
    condition     = !endswith(var.container_image, ":latest") && length(regexall(":[^/]+$", var.container_image)) > 0
    error_message = "container_image phải có tag cụ thể (git SHA), không dùng :latest — nếu không, rollback của Circuit Breaker vô nghĩa."
  }
}

variable "backend_port" {
  description = "Cổng backend trong container (A1)."
  type        = number
  default     = 3000
}

variable "environment" {
  description = "Biến môi trường không nhạy cảm."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Map tên biến môi trường -> ARN secret (có thể kèm ':<khóa json>::')."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for v in values(var.secrets) : startswith(v, "arn:")])
    error_message = "Mỗi giá trị trong secrets phải là ARN của Secrets Manager."
  }
}

variable "task_cpu" {
  description = "CPU unit của task (1024 = 1 vCPU). Khởi điểm 0,25 vCPU."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "MiB của task. t4g.small có khoảng 1,9 GiB cho task, chia cho tối đa 2 task."
  type        = number
  default     = 512

  validation {
    condition     = var.task_memory <= 900
    error_message = "task_memory tối đa 900 MiB để 2 task vừa một t4g.small."
  }
}

variable "stop_timeout" {
  description = "Giây chờ app tắt êm sau SIGTERM (A12). Tối đa 120 trên EC2."
  type        = number
  default     = 120

  validation {
    condition     = var.stop_timeout >= 2 && var.stop_timeout <= 120
    error_message = "stop_timeout phải từ 2 đến 120 giây."
  }
}

variable "log_retention_days" {
  description = "Số ngày giữ log CloudWatch."
  type        = number
  default     = 14
}

variable "enable_execute_command" {
  description = "Bật ECS Exec để debug. Khớp enable_ecs_exec của 10-foundation."
  type        = bool
  default     = true
}

variable "health_check_grace_period" {
  description = "Giây ALB bỏ qua health check sau khi task khởi động."
  type        = number
  default     = 60
}

# ---------------------------------------------------------------------------
# Capacity
# ---------------------------------------------------------------------------
variable "instance_type" {
  description = "Cỡ EC2 host, Graviton arm64."
  type        = string
  default     = "t4g.small"
}

variable "asg_min_size" {
  description = "Số host tối thiểu (1 mỗi AZ)."
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Số host tối đa."
  type        = number
  default     = 6

  validation {
    condition     = var.asg_max_size >= 2
    error_message = "asg_max_size phải ≥ 2."
  }
}

variable "service_desired_count" {
  description = "Số task lúc tạo service. Về sau Auto Scaling quản lý."
  type        = number
  default     = 2
}

variable "service_min_count" {
  description = "Số task tối thiểu của Auto Scaling."
  type        = number
  default     = 2
}

variable "service_max_count" {
  description = "Số task tối đa. Trần vật lý = 2 task x asg_max_size."
  type        = number
  default     = 6

  validation {
    condition     = var.service_max_count >= var.service_min_count
    error_message = "service_max_count phải ≥ service_min_count."
  }
}

variable "cpu_target_percent" {
  description = "CPU trung bình của service mà Auto Scaling giữ."
  type        = number
  default     = 60
}

variable "alarm_topic_arn" {
  description = "SNS topic nhận cảnh báo. null = không tạo alarm."
  type        = string
  default     = null
}
