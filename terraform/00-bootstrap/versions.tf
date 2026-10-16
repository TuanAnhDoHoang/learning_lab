terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.64"
    }
  }

  # Bootstrap dùng LOCAL state (chicken-and-egg: bucket state chưa tồn tại).
  # File terraform.tfstate của stack này PHẢI được giữ cẩn thận (không commit Git,
  # nhưng cũng đừng xóa) — xem README.md mục "Sau khi apply".
}
