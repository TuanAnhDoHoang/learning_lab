variable "project_name" {
  description = "Tiền tố tên resource; cũng là Comment của distribution (CodeBuild tìm theo đó)."
  type        = string
}

variable "frontend_bucket_id" {
  description = "Tên bucket Frontend."
  type        = string
}

variable "frontend_bucket_arn" {
  description = "ARN bucket Frontend."
  type        = string
}

variable "frontend_bucket_regional_domain_name" {
  description = "Domain regional của bucket Frontend (origin OAC)."
  type        = string
}

variable "frontend_baseline_policy_json" {
  description = "Policy nền của bucket Frontend từ 10-foundation (từ chối HTTP)."
  type        = string
}

variable "api_origin_domain" {
  description = "origin.<domain> (có tên miền) hoặc DNS của ALB (chưa có tên miền)."
  type        = string
}

variable "api_origin_https" {
  description = "true khi ALB có cert (origin.<domain>), false khi ALB nghe HTTP trên cổng 443."
  type        = bool
}

variable "origin_verify_value" {
  description = "Giá trị header X-Origin-Verify."
  type        = string
  sensitive   = true
}

variable "origin_read_timeout" {
  description = "Giây chờ ALB trả lời. Trên 60 phải xin tăng hạn mức trước (R3); đích là 180 (A11)."
  type        = number
  default     = 60

  validation {
    condition     = var.origin_read_timeout >= 1 && var.origin_read_timeout <= 180
    error_message = "origin_read_timeout từ 1 đến 180 giây."
  }
}

variable "web_acl_arn" {
  description = "Web ACL WAF (us-east-1). null = không gắn WAF."
  type        = string
  default     = null
}

variable "price_class" {
  description = "PriceClass_200 có edge ở Việt Nam và Singapore, rẻ hơn PriceClass_All."
  type        = string
  default     = "PriceClass_200"
}

variable "domain_name" {
  description = "Tên miền gắn vào distribution. null = dùng *.cloudfront.net."
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "Cert us-east-1 cho domain_name."
  type        = string
  default     = null

  validation {
    condition     = var.domain_name == null || var.certificate_arn != null
    error_message = "Có domain_name thì phải có certificate_arn (us-east-1)."
  }
}

variable "create_dns_records" {
  description = "Tạo bản ghi A/AAAA <domain> -> CloudFront trong zone_id."
  type        = bool
  default     = false
}

variable "zone_id" {
  description = "Hosted zone của domain_name."
  type        = string
  default     = null
}
