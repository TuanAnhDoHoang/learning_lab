variable "project_name" {
  description = "Tiền tố tên resource. Tối đa 26 ký tự vì tên ALB/target group giới hạn 32."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,26}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-26 ký tự."
  }
}

variable "vpc_id" {
  description = "VPC của target group."
  type        = string
}

variable "public_subnet_ids" {
  description = "2 public subnet (2 AZ) cho ALB."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải có đúng 2 public subnet."
  }
}

variable "security_group_id" {
  description = "SG alb của 10-foundation."
  type        = string
}

variable "backend_port" {
  description = "Cổng backend trong container (giả định A1). Phải khớp backend_port của 10-foundation."
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Endpoint health không cần JWT, nên kiểm tra thật kết nối RDS (giả định A2)."
  type        = string
  default     = "/health"

  validation {
    condition     = startswith(var.health_check_path, "/")
    error_message = "health_check_path phải bắt đầu bằng '/'."
  }
}

variable "origin_verify_value" {
  description = "Giá trị header X-Origin-Verify (output origin_verify_value của 10-foundation)."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.origin_verify_value) >= 32 && can(regex("^[A-Za-z0-9]+$", var.origin_verify_value))
    error_message = "origin_verify_value phải dài ≥ 32 ký tự, chỉ chữ và số (ALB coi '*' và '?' là ký tự đại diện)."
  }
}

variable "certificate_arn" {
  description = "ACM cert regional cho origin.<domain>. null = listener HTTP trên cổng 443 (tạm khi chưa có tên miền)."
  type        = string
  default     = null
}

variable "idle_timeout" {
  description = "Giây giữ kết nối nhàn rỗi — đủ cho OCR AI (A11) và WebSocket."
  type        = number
  default     = 180
}

variable "deregistration_delay" {
  description = "Giây chờ rút task khỏi ALB — khớp stopTimeout 120 giây của container."
  type        = number
  default     = 120
}

variable "alarm_topic_arn" {
  description = "SNS topic nhận cảnh báo. null = không tạo alarm."
  type        = string
  default     = null
}
