# 30-edge — CloudFront, WAF, Health Check (tùy chọn)

Giai đoạn **#8** trong kế hoạch (`Ke_Hoach_Ha_Tang.md` Mục 4.7, 4.12). Khoảng **10 USD/tháng** (chủ yếu WAF). `CostTier = optional`: destroy được để bỏ phí WAF, không bắt buộc sau mỗi buổi.

| Module | Region | Tạo ra |
| :--- | :--- | :--- |
| `modules/cdn` | toàn cầu | Distribution (`/api/*`, `/auth/*` → ALB; `*` → S3 qua OAC), CloudFront Function SPA, bucket policy Frontend, bản ghi A/AAAA khi có tên miền |
| `modules/waf` | us-east-1 | Web ACL: IpReputation, Common (`SizeRestrictions_BODY` = Count), KnownBadInputs, rate `/auth/*` 15/phút, rate `/api/new_exam_by_image` 10/5 phút |
| `modules/healthcheck` | us-east-1 | Route 53 Health Check + alarm + SNS topic us-east-1 — **chỉ khi có tên miền** |

## Hai chế độ

| | Chưa có tên miền | Có tên miền (`domain_name` ở `10-foundation`) |
| :--- | :--- | :--- |
| Địa chỉ app | `https://xxxx.cloudfront.net` | `https://<domain>` |
| CloudFront → ALB | DNS của ALB, **HTTP** cổng 443 (không mã hóa) | `origin.<domain>`, HTTPS |
| Phụ thuộc `20-runtime` | Có: mỗi lần dựng lại `20-runtime` (ALB mới) phải apply lại stack này | Không |
| Health Check | Không | Có |

## Dựng

```bash
cd terraform/30-edge
terraform init -backend-config=../backend.hcl

# Chưa có tên miền: cần 20-runtime đang chạy
ALB=$(cd ../20-runtime && terraform output -raw alb_dns_name)
terraform plan -out=tfplan -var "api_origin_domain=$ALB"

# Có tên miền:
# terraform plan -out=tfplan

terraform apply tfplan          # CloudFront mất 5–15 phút
terraform output site_url
```

Sau khi dựng: chạy CodeBuild frontend (hoặc `aws s3 sync` tay) để có nội dung, rồi nghiệm thu `Ke_Hoach_Ha_Tang.md` Mục 10.

## Những điểm cần biết

| Điểm | Chi tiết |
| :--- | :--- |
| Timeout 180 giây (A11, R3) | Mặc định `origin_read_timeout = 60` để apply không bị AWS từ chối. Xin tăng hạn mức "Response timeout per origin" trong Service Quotas, được duyệt thì đặt 180 |
| Không có `custom_error_response` | SPA fallback do CloudFront Function, nên lỗi 404 của `/api/*` vẫn là 404 thật |
| `Comment` của distribution = `stem-digitizer` | CodeBuild frontend tìm distribution theo tên này để invalidation — đừng đổi |
| Destroy stack này | Bucket policy Frontend bị gỡ theo — bucket vẫn private (chặn public 4 cờ) |
| WAF không ghi log | URL WebSocket chứa `access_token` (R4) |
