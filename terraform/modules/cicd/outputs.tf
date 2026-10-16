output "connection_arn" {
  description = "Connection GitHub — phải bấm xác nhận trong Console trước khi build."
  value       = aws_codeconnections_connection.github.arn
}

output "frontend_project_name" {
  description = "Project CodeBuild frontend (aws codebuild start-build --project-name ...)."
  value       = aws_codebuild_project.frontend.name
}

output "backend_project_name" {
  description = "Project CodeBuild backend."
  value       = aws_codebuild_project.backend.name
}
