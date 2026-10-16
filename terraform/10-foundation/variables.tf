# Biến của stack. Kiểm tra hợp lệ (validation) chi tiết nằm trong từng module,
# nên giá trị sai sẽ báo lỗi tại module tương ứng khi plan.

variable "aws_region" {
  description = "Region đặt toàn bộ hạ tầng."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Tiền tố tên resource. PHẢI khớp giá trị ở 00-bootstrap."
  type        = string
  default     = "stem-digitizer"
}

variable "environment" {
  description = "Tên môi trường, chỉ dùng cho tag."
  type        = string
  default     = "demo"
}

# --------------------------------------------------------------------------
# Network — modules/network
# --------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block của VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR của 2 public subnet (AZ-a, AZ-b)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR của 2 private subnet (AZ-a, AZ-b)."
  type        = list(string)
  default     = ["10.0.16.0/20", "10.0.32.0/20"]
}

variable "enable_flow_logs" {
  description = "Bật VPC Flow Logs (tốn phí)."
  type        = bool
  default     = false
}

# --------------------------------------------------------------------------
# Cảnh báo — dùng chung cho modules/budgets và modules/observability
# --------------------------------------------------------------------------
variable "alert_emails" {
  description = "Email của team nhận cảnh báo chi phí (Budgets) và cảnh báo vận hành (SNS/CloudWatch). BẮT BUỘC khai báo trong terraform.tfvars — không có mặc định."
  type        = list(string)
}

# --------------------------------------------------------------------------
# Budgets — modules/budgets
# --------------------------------------------------------------------------
variable "monthly_budget_usd" {
  description = "Ngân sách chi phí toàn account mỗi tháng (USD)."
  type        = number
  default     = 30
}

variable "budget_alert_thresholds" {
  description = "Ngưỡng cảnh báo theo chi phí thực tế, tính theo % ngân sách. Mặc định với ngân sách 30 USD: 15, 24, 30 và 60 USD (Ke_Hoach_Ha_Tang.md Mục 4.12)."
  type        = list(number)
  default     = [50, 80, 100, 200]
}

# --------------------------------------------------------------------------
# Security — modules/security
# --------------------------------------------------------------------------
variable "backend_port" {
  description = "Cổng backend Rust lắng nghe (giả định A1)."
  type        = number
  default     = 3000
}

variable "bypass_test_cidrs" {
  description = "IP mở TẠM vào ALB cho bài nghiệm thu 7b, dạng x.x.x.x/32. Để rỗng khi không test."
  type        = list(string)
  default     = []
}

variable "bedrock_model_arns" {
  description = "ARN model/inference profile Bedrock app được gọi. Rỗng khi dùng Gemini hoặc chưa chốt."
  type        = list(string)
  default     = []
}

variable "ses_identity_arns" {
  description = "ARN identity SES mà app được gửi email. Để rỗng cho tới khi giả định A17 (app có gửi email không) được xác nhận."
  type        = list(string)
  default     = []
}

variable "enable_ecs_exec" {
  description = "Cho phép ECS Exec để debug container qua SSM."
  type        = bool
  default     = true
}

# --------------------------------------------------------------------------
# Secrets — modules/secrets
# --------------------------------------------------------------------------
variable "app_secret_names" {
  description = "Tên các secret của app mà Terraform chỉ tạo vỏ (giá trị đặt sau bằng put-secret-value). Mặc định chỉ JWT (giả định A6); thêm \"gemini-api-key\" nếu chốt dùng Gemini. Mỗi secret khoảng 0,40 USD/tháng."
  type        = list(string)
  default     = ["jwt-secret"]
}

# --------------------------------------------------------------------------
# S3 — modules/s3
# --------------------------------------------------------------------------
variable "s3_force_destroy" {
  description = "Cho phép destroy bucket khi còn dữ liệu. Chỉ bật khi bỏ hẳn dự án."
  type        = bool
  default     = false
}

variable "data_cors_allowed_origins" {
  description = "Origin https://<domain> được PUT/GET bucket Data từ trình duyệt. Chỉ điền khi app dùng presigned URL (giả định A14); rỗng = không bật CORS."
  type        = list(string)
  default     = []
}

variable "enable_s3_gateway_endpoint" {
  description = "S3 Gateway Endpoint (miễn phí) cho subnet private — traffic ECR/S3 không qua NAT."
  type        = bool
  default     = true
}

# --------------------------------------------------------------------------
# ECR — modules/ecr
# --------------------------------------------------------------------------
variable "ecr_force_delete" {
  description = "Cho phép destroy repository còn image. Chỉ bật khi bỏ hẳn dự án."
  type        = bool
  default     = false
}

# --------------------------------------------------------------------------
# DNS — modules/dns (chỉ tạo khi có domain_name, giả định A16)
# --------------------------------------------------------------------------
variable "domain_name" {
  description = "Tên miền gốc, ví dụ learninglab.vn. null = chưa có tên miền: không tạo hosted zone, ACM, SES."
  type        = string
  default     = null
}

variable "existing_zone_id" {
  description = "Hosted zone đã có (domain mua qua Route 53 tự tạo zone). null = tạo zone mới."
  type        = string
  default     = null
}

variable "dns_wait_for_validation" {
  description = "Chờ ACM cấp chứng chỉ khi apply. Đặt false ở lần apply đầu nếu registrar chưa trỏ NS."
  type        = bool
  default     = true
}

# --------------------------------------------------------------------------
# SES — modules/ses (giả định A17)
# --------------------------------------------------------------------------
variable "enable_ses" {
  description = "Tạo identity SES cho domain_name và cấp quyền gửi cho task role. Cần domain_name."
  type        = bool
  default     = false

  validation {
    condition     = !var.enable_ses || var.domain_name != null
    error_message = "enable_ses cần domain_name."
  }
}

# --------------------------------------------------------------------------
# CI/CD — modules/cicd (chỉ tạo khi có github_repo_url)
# --------------------------------------------------------------------------
variable "github_repo_url" {
  description = "https://github.com/<org>/<repo>.git. null = chưa tạo CI/CD."
  type        = string
  default     = null
}

variable "github_branch" {
  description = "Nhánh được deploy."
  type        = string
  default     = "main"
}

variable "frontend_dir" {
  description = "Thư mục frontend trong repo."
  type        = string
  default     = "app"
}

variable "backend_dir" {
  description = "Thư mục backend trong repo (giả định A19)."
  type        = string
  default     = "backend"
}

variable "backend_dockerfile" {
  description = "Dockerfile production, tương đối với backend_dir (giả định A19)."
  type        = string
  default     = "Dockerfile"
}

variable "frontend_build_env" {
  description = "Biến VITE_* lúc build frontend. Không đặt secret."
  type        = map(string)
  default     = {}
}

variable "enable_cicd_webhooks" {
  description = "Tự build khi push. Chỉ bật sau khi connection GitHub đã AVAILABLE."
  type        = bool
  default     = false
}
