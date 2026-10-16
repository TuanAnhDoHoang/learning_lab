provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "20-runtime"
      # Stack tính phí theo giờ — destroy sau mỗi buổi demo. Tag này là thứ
      # Huong_dan_quan_ly_ha_tang.md Mục 8.3 dùng để tìm resource còn sót.
      CostTier = "session"
    }
  }
}
