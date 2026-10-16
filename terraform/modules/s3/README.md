# Module `s3`

3 bucket S3 và 1 trail CloudTrail — `Ke_Hoach_Ha_Tang.md` Mục 4.8 và 4.12. Chi phí **gần 0 USD** (bản sao đầu tiên của management events trong mỗi region miễn phí; chỉ trả tiền lưu trữ log).

Tên bucket: `<project>-<mục đích>-<account>-<region>` (S3 yêu cầu tên duy nhất toàn cầu).

## Cứng hóa áp dụng cho cả 3 bucket

| Mục | Giá trị |
| :--- | :--- |
| Chặn public | Bật đủ 4 cờ |
| ACL | `BucketOwnerEnforced` (tắt hẳn ACL) |
| Mã hóa | SSE-S3 (AES256), không dùng KMS CMK (Mục 3.2) |
| TLS | Bucket policy từ chối `aws:SecureTransport = false` |

## Riêng từng bucket

| Bucket | Versioning | Lifecycle | Policy |
| :--- | :-: | :--- | :--- |
| Frontend | Có | Xóa bản build cũ sau 30 ngày, dọn delete marker | **Không gắn ở đây** — xem bên dưới |
| Data | Có | Xóa object sau `data_retention_days` (14), xóa phiên bản cũ sau đúng số ngày đó, dọn delete marker | Chỉ policy nền (từ chối HTTP) |
| CloudTrail logs | Không | Xóa log sau `trail_log_retention_days` (90) | Nền + quyền ghi cho CloudTrail, giới hạn bằng `aws:SourceArn` = đúng trail này |

Bucket Data bật versioning nên **bắt buộc** có `noncurrent_version_expiration` và dọn delete marker; thiếu hai dòng đó thì ảnh cũ nằm lại vĩnh viễn dù object hiện hành đã hết hạn.

CORS của bucket Data mặc định **tắt**. Chỉ điền `data_cors_allowed_origins` khi app upload thẳng từ trình duyệt bằng presigned URL (giả định A14).

## Bucket policy của Frontend nằm ở `30-edge`

Policy đó cần ARN của CloudFront distribution, mà distribution thuộc `30-edge`. Mỗi bucket chỉ có **một** `aws_s3_bucket_policy`, nên nếu cả hai stack cùng gắn thì chúng ghi đè lẫn nhau mỗi lần apply.

Module xuất `frontend_baseline_policy_json`; `30-edge` dùng nó làm `source_policy_documents` rồi cộng thêm quyền `s3:GetObject` cho đúng distribution. Không cấp `s3:ListBucket`, để file thiếu trả 403 thay vì lộ danh sách file.

## CloudTrail

1 trail multi-region, có `include_global_service_events` (ghi cả IAM) và `enable_log_file_validation` (sinh file digest để phát hiện log bị sửa).

## Input

| Biến | Bắt buộc | Mặc định | Ghi chú |
| :--- | :-: | :--- | :--- |
| `project_name` | Có | | 3–24 ký tự (tên bucket tối đa 63) |
| `force_destroy` | | `false` | `true` mới destroy được bucket còn dữ liệu — chỉ bật khi bỏ hẳn dự án |
| `data_retention_days` | | `14` | Áp cho cả object hiện hành lẫn phiên bản cũ |
| `trail_log_retention_days` | | `90` | |
| `data_cors_allowed_origins` | | `[]` | Chỉ nhận `https://<domain>`, không wildcard |

## Output

`frontend_bucket_id`, `frontend_bucket_arn`, `frontend_bucket_regional_domain_name`, `frontend_baseline_policy_json`, `data_bucket_id`, `data_bucket_arn`, `trail_logs_bucket_id`, `cloudtrail_arn`.

ARN bucket được tính từ **tên** chứ không lấy từ thuộc tính `arn` của resource, nên biết ngay lúc plan. Nhờ vậy `modules/security` dùng được `data_bucket_arn != null` để quyết định có cấp quyền S3 hay không mà plan không lỗi.

## Test độc lập

```bash
cd terraform/modules/s3
terraform init -backend=false
terraform test      # 17 bài, mock provider, không cần AWS
```
