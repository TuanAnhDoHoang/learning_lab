output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "state_bucket_name" {
  value = aws_s3_bucket.state.id
}

output "lock_table_name" {
  value = aws_dynamodb_table.lock.name
}

# Nội dung file backend.hcl dùng chung cho các stack sau (10-foundation, ...).
# Mỗi stack chạy: terraform init -backend-config=../backend.hcl
output "backend_hcl" {
  value = <<-EOT
    bucket         = "${aws_s3_bucket.state.id}"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.lock.name}"
    encrypt        = true
  EOT
}
