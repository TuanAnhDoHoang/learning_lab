terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.64"
    }
  }

  # Module KHÔNG khai báo provider hay backend — stack gọi module (20-runtime)
  # truyền provider vào. Nhờ vậy module test độc lập được bằng mock provider.
}
