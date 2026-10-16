# Email giao dịch — Ke_Hoach_Ha_Tang.md Mục 4.13. Chỉ dùng khi A17 xác nhận app gửi email.
# Chi phí ~0,10 USD/1.000 email.
#
# Tài khoản mới ở SES Sandbox: chỉ gửi tới địa chỉ đã verify. Xin thoát Sandbox trong
# console (mất khoảng 24 giờ) — Terraform không làm được bước này.

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# Easy DKIM: 3 bản ghi CNAME. Cờ riêng thay vì "zone_id != null" vì zone mới tạo thì
# zone_id chưa biết lúc plan, count không tính được.
resource "aws_route53_record" "dkim" {
  count = var.create_dkim_records ? 3 : 0

  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}
