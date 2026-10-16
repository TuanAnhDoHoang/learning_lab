locals {
  default_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Stack       = "30-edge"
    # Tùy chọn: destroy được để bỏ phí WAF (~10 USD/tháng), không bắt buộc sau mỗi buổi.
    CostTier = "optional"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.default_tags
  }
}

# WAF scope CLOUDFRONT, cert CloudFront, metric Route 53 Health Check đều chỉ ở us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.default_tags
  }
}
