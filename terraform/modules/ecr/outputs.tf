output "repository_name" {
  description = "Tên repository backend."
  value       = aws_ecr_repository.backend.name
}

output "repository_url" {
  description = "URL để docker push (không kèm tag)."
  value       = aws_ecr_repository.backend.repository_url
}

output "repository_arn" {
  description = "ARN repository (quyền push của CodeBuild)."
  value       = aws_ecr_repository.backend.arn
}
