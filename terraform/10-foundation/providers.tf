provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "10-foundation"
      # Stack này thuộc nhóm "thường trực" (Ke_Hoach_Ha_Tang.md Mục 6) — không destroy
      # sau mỗi phiên demo, khác với 20-runtime (CostTier = session).
      CostTier = "persistent"
    }
  }
}

# Alias us-east-1 dùng cho ACM (CloudFront) và WAF scope CLOUDFRONT — sẽ dùng khi
# code tới phần ACM/Route 53/WAF của stack này (Ke_Hoach_Ha_Tang.md Mục 4.7).
# Khai báo sẵn ở đây để không phải sửa providers.tf lần nữa.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "10-foundation"
      CostTier    = "persistent"
    }
  }
}
