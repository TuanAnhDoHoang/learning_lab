variable "project_name" {
  description = "Tiền tố tên resource."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "project_name chỉ gồm a-z, 0-9, '-' và dài 3-30 ký tự."
  }
}

variable "vpc_cidr" {
  description = "CIDR block của VPC."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr phải là CIDR IPv4 hợp lệ."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR của 2 public subnet (AZ-a, AZ-b) — chỉ chứa ALB. Kiến trúc cố định 2 AZ."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải khai báo đúng 2 CIDR."
  }

  validation {
    condition     = alltrue([for c in var.public_subnet_cidrs : can(cidrhost(c, 0))])
    error_message = "Mỗi phần tử của public_subnet_cidrs phải là CIDR IPv4 hợp lệ."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR của 2 private subnet (AZ-a, AZ-b) — chứa ECS host (awsvpc ENI) và RDS."
  type        = list(string)
  default     = ["10.0.16.0/20", "10.0.32.0/20"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải khai báo đúng 2 CIDR."
  }

  validation {
    condition     = alltrue([for c in var.private_subnet_cidrs : can(cidrhost(c, 0))])
    error_message = "Mỗi phần tử của private_subnet_cidrs phải là CIDR IPv4 hợp lệ."
  }
}

variable "enable_flow_logs" {
  description = "Bật VPC Flow Logs ra CloudWatch Logs. Tốn phí nên tắt mặc định, chỉ bật khi cần điều tra sự cố mạng."
  type        = bool
  default     = false
}

variable "flow_logs_retention_days" {
  description = "Số ngày giữ Flow Logs trong CloudWatch Logs (chỉ có tác dụng khi enable_flow_logs = true)."
  type        = number
  default     = 14
}

variable "enable_s3_gateway_endpoint" {
  description = "Gắn S3 Gateway Endpoint (miễn phí) vào route table private để traffic S3 không đi qua NAT."
  type        = bool
  default     = true
}
