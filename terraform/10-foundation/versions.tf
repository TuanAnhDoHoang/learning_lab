terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.64"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  backend "s3" {
    key = "10-foundation/terraform.tfstate"
    # bucket, region, dynamodb_table, encrypt lấy từ ../backend.hcl (sinh ra từ 00-bootstrap)
  }
}
