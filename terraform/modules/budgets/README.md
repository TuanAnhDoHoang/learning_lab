# Module `budgets`

Lưới an toàn chi phí — `Ke_Hoach_Ha_Tang.md` Mục 0 và Mục 4.12. Chi phí **$0** (2 budget đầu tiên mỗi account miễn phí).

| Tạo ra | Chi tiết |
| :--- | :--- |
| 1 budget chi phí tháng | Mặc định 30 USD, áp dụng **toàn account** |
| Cảnh báo theo chi phí thực tế | Khi vượt các ngưỡng trong `actual_alert_thresholds`. Stack `10-foundation` truyền `[50, 80, 100, 200]`, tức 15, 24, 30 và 60 USD |
| Cảnh báo theo dự báo | Khi chi phí dự báo cuối tháng vượt 100% |

## Vì sao áp dụng toàn account, không lọc theo tag

Rủi ro chi phí lớn nhất là resource mồ côi quên destroy — loại này thường không mang tag đúng. Lọc theo tag còn cần bật cost allocation tag thủ công trong Billing console.

## Giới hạn cần biết

- Budget **chỉ gửi cảnh báo, không tự tắt resource.**
- Dữ liệu chi phí của AWS cập nhật chậm vài giờ đến khoảng 1 ngày. Không thay thế việc kiểm tra sau mỗi lần destroy (`Huong_dan_quan_ly_ha_tang.md` Mục 8.3).
- Mỗi email nhận cảnh báo sẽ nhận được email xác nhận từ AWS lần đầu.

## Input

| Biến | Bắt buộc | Mặc định | Ghi chú |
| :--- | :-: | :--- | :--- |
| `project_name` | Có | | |
| `alert_emails` | Có | | Tối đa 10. Có thể để rỗng nếu đã truyền `alert_sns_topic_arns` |
| `monthly_budget_usd` | | `30` | Phải lớn hơn 0 |
| `actual_alert_thresholds` | | `[50, 80, 100]` | Phần trăm. Có thể vượt 100 để báo mức "chắc chắn đã quên destroy" |
| `forecast_alert_threshold` | | `100` | `null` để tắt cảnh báo dự báo |
| `alert_sns_topic_arns` | | `[]` | Tối đa 1. Gắn SNS topic `alerts` khi module observability có mặt |

## Output

`budget_name`, `budget_limit_usd`.

## Test độc lập

```bash
cd terraform/modules/budgets
terraform init -backend=false
terraform test      # 6 bài, mock provider, không cần AWS
```
