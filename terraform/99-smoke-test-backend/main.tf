# Stack thử nghiệm: xác nhận remote backend (S3 + DynamoDB lock) hoạt động.
# Chỉ dùng resource `terraform_data` (không gọi AWS) => KHÔNG tạo tài nguyên, $0.
# Chạy xong có thể xóa hẳn thư mục này.

terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    key = "smoke-test/terraform.tfstate"
    # bucket, region, dynamodb_table, encrypt lấy từ ../backend.hcl
  }
}

resource "terraform_data" "ping" {
  input = "backend-ok"
}

output "ping" {
  value = terraform_data.ping.output
}
