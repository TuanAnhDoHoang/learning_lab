# Secrets Manager — Ke_Hoach_Ha_Tang.md Mục 4.3. Chi phí: khoảng 0,40 USD/secret/tháng.
#
# Hai loại bí mật, xử lý khác nhau:
#
#   1. Secret của app (JWT, Gemini key...): Terraform CHỈ tạo vỏ. Giá trị đặt bằng
#      `aws secretsmanager put-secret-value` nên không nằm trong state hay Git.
#      Cố ý KHÔNG có aws_secretsmanager_secret_version, để Terraform không bao giờ
#      ghi đè giá trị đã đặt.
#
#   2. X-Origin-Verify: giá trị sinh bằng random_password và BẮT BUỘC nằm trong state,
#      vì CloudFront (custom header) và ALB (listener rule) đều cần giá trị thật.
#      State đã được bảo vệ ở 00-bootstrap (mã hóa, chặn public, bắt buộc TLS, versioning).

resource "aws_secretsmanager_secret" "app" {
  for_each = toset(var.app_secret_names)

  name                    = "${var.project_name}/${each.value}"
  description             = "Vỏ secret của app. Giá trị đặt bằng put-secret-value, không nằm trong Terraform."
  recovery_window_in_days = var.recovery_window_in_days
}

# Chỉ chữ và số: giá trị này nằm trong HTTP header, ký tự đặc biệt dễ gây lỗi.
# 32 ký tự chữ và số cho khoảng 190 bit entropy.
resource "random_password" "origin_verify" {
  length  = 32
  special = false
}
