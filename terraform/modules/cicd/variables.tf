variable "project_name" {
  description = "Tiền tố tên resource. Cũng là tên ECS cluster và Comment của distribution CloudFront."
  type        = string
}

variable "github_repo_url" {
  description = "URL HTTPS của repo GitHub, ví dụ https://github.com/<org>/<repo>.git."
  type        = string

  validation {
    condition     = can(regex("^https://github\\.com/[^/]+/[^/]+$", var.github_repo_url))
    error_message = "github_repo_url phải có dạng https://github.com/<org>/<repo>(.git)."
  }
}

variable "branch" {
  description = "Nhánh được deploy."
  type        = string
  default     = "main"
}

variable "frontend_dir" {
  description = "Thư mục frontend trong repo (app_deploy.md: app/)."
  type        = string
  default     = "app"
}

variable "backend_dir" {
  description = "Thư mục backend trong repo (giả định A19)."
  type        = string
  default     = "backend"
}

variable "backend_dockerfile" {
  description = "Dockerfile production của backend, tương đối với backend_dir (A19)."
  type        = string
  default     = "Dockerfile"
}

variable "frontend_build_env" {
  description = "Biến môi trường lúc build Vite (VITE_*). Không đặt secret ở đây — sẽ lộ trong bundle JS."
  type        = map(string)
  default     = {}
}

variable "node_version" {
  description = "Phiên bản Node.js của CodeBuild."
  type        = string
  default     = "20"
}

variable "backend_compute_type" {
  description = "Cỡ máy build Rust trên ARM."
  type        = string
  default     = "BUILD_GENERAL1_MEDIUM"

  validation {
    condition     = contains(["BUILD_GENERAL1_MEDIUM", "BUILD_GENERAL1_LARGE"], var.backend_compute_type)
    error_message = "Dùng MEDIUM hoặc LARGE — SMALL (4 GiB) dễ hết RAM khi liên kết Rust."
  }
}

variable "ecr_repository_url" {
  description = "URL repository ECR của backend."
  type        = string
}

variable "ecr_repository_arn" {
  description = "ARN repository ECR."
  type        = string
}

variable "frontend_bucket_name" {
  description = "Bucket Frontend."
  type        = string
}

variable "frontend_bucket_arn" {
  description = "ARN bucket Frontend."
  type        = string
}

variable "pass_role_arns" {
  description = "Role mà CodeBuild được gắn vào task definition mới (task execution role, task role)."
  type        = list(string)
}

variable "enable_webhooks" {
  description = "Tạo webhook tự build khi push. Chỉ bật SAU KHI connection GitHub đã AVAILABLE."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Số ngày giữ log build."
  type        = number
  default     = 14
}
