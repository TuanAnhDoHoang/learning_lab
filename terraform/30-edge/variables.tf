variable "aws_region" {
  description = "Region chính."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Tiền tố tên resource. PHẢI khớp các stack khác."
  type        = string
  default     = "stem-digitizer"
}

variable "environment" {
  description = "Giá trị tag Environment."
  type        = string
  default     = "demo"
}

variable "api_origin_domain" {
  description = "Chỉ dùng khi 10-foundation CHƯA có tên miền: DNS của ALB (terraform output -raw alb_dns_name trong 20-runtime). Có tên miền thì bỏ trống — dùng origin.<domain>."
  type        = string
  default     = null

  validation {
    condition     = var.api_origin_domain != null || try(data.terraform_remote_state.foundation.outputs.domain_name, null) != null
    error_message = "Chưa có tên miền: truyền -var api_origin_domain=$(cd ../20-runtime && terraform output -raw alb_dns_name)."
  }
}

variable "origin_read_timeout" {
  description = "Giây CloudFront chờ ALB. Trên 60 cần xin tăng hạn mức trước (R3)."
  type        = number
  default     = 60
}

variable "enable_waf" {
  description = "Gắn WAF (~10 USD/tháng)."
  type        = bool
  default     = true
}

variable "enable_health_check" {
  description = "Route 53 Health Check + alarm ở us-east-1. Chỉ có tác dụng khi có tên miền."
  type        = bool
  default     = true
}
