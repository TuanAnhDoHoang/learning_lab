# DNS và chứng chỉ — Ke_Hoach_Ha_Tang.md Mục 4.7. Chi phí: 0,50 USD/tháng (hosted zone);
# chứng chỉ ACM public miễn phí.
#
#   <domain>         -> CloudFront (bản ghi do 30-edge tạo), cert ở us-east-1
#   origin.<domain>  -> ALB (bản ghi do 20-runtime tạo), cert ở region chính
#
# Chứng chỉ chỉ được cấp khi registrar đã trỏ NS về hosted zone này (output name_servers).

locals {
  zone_id     = var.existing_zone_id != null ? var.existing_zone_id : aws_route53_zone.main[0].zone_id
  origin_fqdn = "origin.${var.domain_name}"
}

resource "aws_route53_zone" "main" {
  count = var.existing_zone_id == null ? 1 : 0

  name    = var.domain_name
  comment = "${var.project_name} - quan ly boi Terraform"
}

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "origin" {
  domain_name       = local.origin_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Khóa tĩnh: mỗi cert chỉ có 1 tên miền nên có đúng 1 bản ghi xác thực.
locals {
  validation_records = {
    cloudfront = one(aws_acm_certificate.cloudfront.domain_validation_options)
    origin     = one(aws_acm_certificate.origin.domain_validation_options)
  }
}

resource "aws_route53_record" "validation" {
  for_each = local.validation_records

  zone_id         = local.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

# Chờ ACM cấp chứng chỉ. Đặt wait_for_validation = false ở lần apply đầu nếu registrar
# chưa trỏ NS, để apply không treo; trỏ NS xong thì bật lại.
resource "aws_acm_certificate_validation" "cloudfront" {
  count    = var.wait_for_validation ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [aws_route53_record.validation["cloudfront"].fqdn]
}

resource "aws_acm_certificate_validation" "origin" {
  count = var.wait_for_validation ? 1 : 0

  certificate_arn         = aws_acm_certificate.origin.arn
  validation_record_fqdns = [aws_route53_record.validation["origin"].fqdn]
}
