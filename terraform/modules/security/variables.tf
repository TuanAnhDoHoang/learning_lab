variable "project_name" {
  description = "Tiền tố tên Security Group và IAM role."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "vpc_id" {
  description = "VPC chứa các Security Group. Khi ghép: lấy từ module.network.vpc_id. Khi test độc lập: truyền ID giả."
  type        = string

  validation {
    condition     = can(regex("^vpc-[0-9a-f]+$", var.vpc_id))
    error_message = "vpc_id phải có dạng vpc-xxxxxxxx."
  }
}

# --------------------------------------------------------------------------
# Security Groups
# --------------------------------------------------------------------------

variable "backend_port" {
  description = "Cổng backend Rust lắng nghe trong container (giả định A1, Ke_Hoach_Ha_Tang.md Mục 5)."
  type        = number
  default     = 3000

  validation {
    condition     = var.backend_port >= 1 && var.backend_port <= 65535 && floor(var.backend_port) == var.backend_port
    error_message = "backend_port phải là số nguyên từ 1 đến 65535."
  }
}

variable "db_port" {
  description = "Cổng PostgreSQL."
  type        = number
  default     = 5432
}

variable "bypass_test_cidrs" {
  description = "IP được mở TẠM vào ALB để test lớp chặn header X-Origin-Verify (bài nghiệm thu 7b). Để rỗng khi không test."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for c in var.bypass_test_cidrs : can(cidrhost(c, 0)) && endswith(c, "/32")])
    error_message = "Chỉ được mở từng IP đơn lẻ dạng x.x.x.x/32 — không bao giờ mở cả dải mạng hay 0.0.0.0/0."
  }

  validation {
    condition     = length(var.bypass_test_cidrs) <= 3
    error_message = "Tối đa 3 IP: prefix list CloudFront đã chiếm gần hết quota 60 rule inbound của alb_sg."
  }
}

# --------------------------------------------------------------------------
# IAM — các input dưới đây đến từ module CHƯA viết (secrets, s3).
# Để mặc định rỗng/null thì module vẫn chạy độc lập; khi ghép thì truyền output vào.
# --------------------------------------------------------------------------

variable "execution_secret_arns" {
  description = "ARN các secret mà ECS inject vào container lúc khởi động (JWT, Gemini key...). Secret do RDS quản lý KHÔNG truyền ở đây — 20-runtime tự gắn vì ARN đổi mỗi lần dựng lại."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for a in var.execution_secret_arns : can(regex("^arn:aws[a-zA-Z-]*:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:.+$", a))])
    error_message = "Mọi phần tử phải là ARN cụ thể của một secret Secrets Manager (không dùng wildcard toàn account)."
  }
}

variable "data_bucket_arn" {
  description = "ARN bucket S3 Data. null = task không có quyền S3 nào."
  type        = string
  default     = null

  validation {
    condition     = var.data_bucket_arn == null || can(regex("^arn:aws[a-zA-Z-]*:s3:::[a-z0-9.-]{3,63}$", var.data_bucket_arn))
    error_message = "data_bucket_arn phải là ARN của đúng một bucket (arn:aws:s3:::ten-bucket) hoặc null."
  }
}

variable "bedrock_model_arns" {
  description = "ARN model hoặc inference profile Bedrock mà app được gọi. Rỗng = không có quyền Bedrock (dùng Gemini, hoặc chưa chốt)."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for a in var.bedrock_model_arns : can(regex("^arn:aws[a-zA-Z-]*:bedrock:", a)) && !strcontains(a, "*")])
    error_message = "Mọi phần tử phải là ARN Bedrock cụ thể, không chứa wildcard."
  }
}

variable "ses_identity_arns" {
  description = "ARN identity SES (domain hoặc email đã verify) mà app được gửi email từ đó. Rỗng = app không có quyền gửi email (giả định A17 chưa xác nhận)."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for a in var.ses_identity_arns : can(regex("^arn:aws[a-zA-Z-]*:ses:[a-z0-9-]+:[0-9]{12}:identity/.+$", a)) && !strcontains(a, "*")])
    error_message = "Mọi phần tử phải là ARN identity SES cụ thể (arn:aws:ses:<region>:<account>:identity/<domain-hoặc-email>), không chứa wildcard."
  }
}

variable "enable_ecs_exec" {
  description = "Cho phép ECS Exec (mở shell vào container qua SSM để debug)."
  type        = bool
  default     = true
}
