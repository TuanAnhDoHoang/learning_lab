output "frontend_bucket_id" {
  description = "Tên bucket Frontend. CodeBuild sync build vào đây."
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_arn" {
  description = "ARN bucket Frontend, dùng cho IAM policy của CodeBuild và bucket policy ở 30-edge."
  value       = local.bucket_arns.frontend
}

output "frontend_bucket_regional_domain_name" {
  description = "Domain của bucket Frontend, dùng làm origin của CloudFront (OAC)."
  value       = aws_s3_bucket.frontend.bucket_regional_domain_name
}

output "frontend_baseline_policy_json" {
  description = "Policy nền của bucket Frontend (chỉ từ chối HTTP). 30-edge dùng làm source_policy_documents rồi cộng quyền GetObject cho đúng CloudFront distribution. Module này KHÔNG gắn policy vào bucket Frontend."
  value       = data.aws_iam_policy_document.deny_insecure_transport["frontend"].json
}

output "data_bucket_id" {
  description = "Tên bucket Data."
  value       = aws_s3_bucket.data.bucket
}

output "data_bucket_arn" {
  description = "ARN bucket Data, truyền vào modules/security để task role được Get/Put object."
  value       = local.bucket_arns.data
}

output "trail_logs_bucket_id" {
  description = "Tên bucket chứa log CloudTrail."
  value       = aws_s3_bucket.trail_logs.bucket
}

output "cloudtrail_arn" {
  description = "ARN của trail."
  value       = aws_cloudtrail.main.arn
}
