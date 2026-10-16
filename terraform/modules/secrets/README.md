# Module `secrets`

Secrets Manager — `Ke_Hoach_Ha_Tang.md` Mục 4.3. Chi phí **khoảng 0,40 USD/secret/tháng**.

| Tạo ra | Chi tiết |
| :--- | :--- |
| Vỏ secret của app | Mỗi tên trong `app_secret_names` thành một secret tên `<project>/<tên>`. **Không có giá trị** |
| `X-Origin-Verify` | `random_password` 32 ký tự chữ và số, xuất qua output (không tạo secret trong Secrets Manager) |

## Vì sao vỏ secret không có giá trị

Nếu Terraform đặt giá trị thì giá trị đó nằm trong state và thường nằm cả trong `.tfvars`. Module cố ý **không có** `aws_secretsmanager_secret_version`, nên Terraform không bao giờ ghi đè giá trị bạn đặt bằng tay.

Đặt giá trị sau khi apply:

```bash
aws secretsmanager put-secret-value \
  --secret-id "stem-digitizer/jwt-secret" \
  --secret-string "$(openssl rand -base64 48)"
```

**Secret phải có giá trị trước khi dựng `20-runtime`.** Thiếu giá trị thì task không khởi động được (`ResourceInitializationError`).

## Vì sao `X-Origin-Verify` nằm trong state

CloudFront (custom header) và ALB (listener rule) đều cần giá trị thật, nên nó **bắt buộc** nằm trong state — không có cách nào khác về mặt kỹ thuật. State đã được bảo vệ ở `00-bootstrap`: mã hóa, chặn public, bắt buộc TLS, có versioning.

Xoay vòng không downtime: thêm giá trị mới vào `values` của ALB rule (điều kiện OR), cập nhật CloudFront, rồi bỏ giá trị cũ.

## Input

| Biến | Bắt buộc | Mặc định | Ghi chú |
| :--- | :-: | :--- | :--- |
| `project_name` | Có | | Thành tiền tố `<project>/<tên>` |
| `app_secret_names` | | `["jwt-secret"]` | Chữ thường, không chứa `/`, không trùng nhau. Thêm `"gemini-api-key"` nếu chốt dùng Gemini |
| `recovery_window_in_days` | | `7` | Từ 7 đến 30. Trong thời gian chờ xóa **không tạo lại được secret cùng tên** |

Secret do RDS quản lý (`manage_master_user_password`) **không** nằm ở đây: RDS tự tạo, và ARN đổi mỗi lần dựng lại nên `20-runtime` tự gắn quyền.

## Output

| Output | Dùng ở đâu |
| :--- | :--- |
| `app_secret_arns` | Map tên → ARN; `20-runtime` inject vào task definition |
| `execution_secret_arns` | Truyền vào `modules/security` để execution role đọc được đúng các secret này |
| `origin_verify_value` | `sensitive`. `30-edge` đặt vào CloudFront, `20-runtime` đặt vào ALB rule |

## Test độc lập

```bash
cd terraform/modules/secrets
terraform init -backend=false
terraform test      # 7 bài, mock provider, không cần AWS
```
