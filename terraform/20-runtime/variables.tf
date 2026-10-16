# ---------------------------------------------------------------------------
# Chung — phải khớp 10-foundation
# ---------------------------------------------------------------------------
variable "aws_region" {
  description = "Region chính."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Tiền tố tên resource. PHẢI khớp 00-bootstrap và 10-foundation."
  type        = string
  default     = "stem-digitizer"
}

variable "environment" {
  description = "Giá trị tag Environment."
  type        = string
  default     = "demo"
}

variable "backend_port" {
  description = "Cổng backend (A1). PHẢI khớp backend_port của 10-foundation (SG mở đúng cổng này)."
  type        = number
  default     = 3000
}

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
variable "container_image" {
  description = "Image arm64 kèm tag git SHA. null = image đẩy lên ECR gần nhất (repo của 10-foundation)."
  type        = string
  default     = null
}

variable "health_check_path" {
  description = "Endpoint health của backend (A2)."
  type        = string
  default     = "/health"
}

variable "app_secret_env" {
  description = "Map tên biến môi trường -> tên secret trong app_secret_names của 10-foundation (A6)."
  type        = map(string)
  default     = { JWT_SECRET = "jwt-secret" }
}

variable "db_env_names" {
  description = "Tên biến môi trường app đọc để kết nối DB (A3). username/password lấy từ secret do RDS quản lý."
  type = object({
    host     = string
    port     = string
    name     = string
    username = string
    password = string
  })
  default = {
    host     = "DB_HOST"
    port     = "DB_PORT"
    name     = "DB_NAME"
    username = "DB_USERNAME"
    password = "DB_PASSWORD"
  }
}

variable "rust_log" {
  description = "Mức log của backend (A13)."
  type        = string
  default     = "info"
}

variable "extra_environment" {
  description = "Biến môi trường không nhạy cảm khác mà app cần."
  type        = map(string)
  default     = {}
}

variable "task_cpu" {
  description = "CPU unit của task (1024 = 1 vCPU)."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "MiB của task."
  type        = number
  default     = 512
}

variable "enable_execute_command" {
  description = "ECS Exec. Khớp enable_ecs_exec của 10-foundation."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# Capacity — xem R1 trước buổi demo có phòng thi trực tiếp
# ---------------------------------------------------------------------------
variable "asg_min_size" {
  description = "Số EC2 host tối thiểu."
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Số EC2 host tối đa."
  type        = number
  default     = 6
}

variable "service_desired_count" {
  description = "Số task lúc tạo service."
  type        = number
  default     = 2
}

variable "service_min_count" {
  description = "Số task tối thiểu. Đặt 1 (cùng service_max_count = 1) khi demo WebSocket mà A9 đúng."
  type        = number
  default     = 2
}

variable "service_max_count" {
  description = "Số task tối đa."
  type        = number
  default     = 6
}

# ---------------------------------------------------------------------------
# ALB
# ---------------------------------------------------------------------------
variable "alb_certificate_arn" {
  description = "Ghi đè cert của ALB. null = dùng origin_certificate_arn của 10-foundation; foundation chưa có tên miền thì listener HTTP trên cổng 443 (A16)."
  type        = string
  default     = null
}

# ---------------------------------------------------------------------------
# RDS
# ---------------------------------------------------------------------------
variable "rds_restore_snapshot_id" {
  description = "Snapshot để khôi phục dữ liệu (Huong_dan Mục 7.2). null = database trắng."
  type        = string
  default     = null
}

variable "rds_deletion_protection" {
  description = "Chặn xóa RDS. Apply với false trước khi destroy (Huong_dan Mục 8.1)."
  type        = bool
  default     = true
}

# 3 biến dưới: mặc định theo Mục 3.1. Tài khoản gói Free plan bị AWS chặn
# (FreeTierRestrictionError) nên terraform.tfvars hạ xuống micro / Single-AZ / 1 ngày.
variable "rds_instance_class" {
  description = "Cỡ máy RDS."
  type        = string
  default     = "db.t4g.small"
}

variable "rds_multi_az" {
  description = "RDS Multi-AZ. false chỉ dùng cho tài khoản gói Free plan."
  type        = bool
  default     = true
}

variable "rds_backup_retention_days" {
  description = "Số ngày giữ automated backup."
  type        = number
  default     = 7
}

variable "rds_engine_version" {
  description = "Phiên bản PostgreSQL (major)."
  type        = string
  default     = "17"
}

variable "db_name" {
  description = "Tên database khi dựng mới."
  type        = string
  default     = "stem_digitizer"
}
