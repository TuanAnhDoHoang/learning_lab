output "identity_arn" {
  description = "ARN identity — truyền vào security.ses_identity_arns để task role được gửi email."
  value       = aws_sesv2_email_identity.domain.arn
}

output "dkim_records" {
  description = "Bản ghi CNAME DKIM (để thêm tay khi DNS không nằm ở Route 53)."
  value = [
    for t in aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens :
    { name = "${t}._domainkey.${var.domain_name}", type = "CNAME", value = "${t}.dkim.amazonses.com" }
  ]
}
