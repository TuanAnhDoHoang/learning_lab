# Module `observability`

Kênh cảnh báo vận hành — `Ke_Hoach_Ha_Tang.md` Mục 4.12. Chi phí **$0** (1.000 email/tháng đầu miễn phí).

| Tạo ra | Chi tiết |
| :--- | :--- |
| SNS topic `<project>-alerts` | Nơi mọi CloudWatch Alarm gửi thông báo tới |
| Email subscription | Một subscription cho mỗi email trong `alert_emails` |
| Topic policy | Chủ account quản lý; CloudWatch và Budgets chỉ được `sns:Publish` và chỉ khi yêu cầu đến từ chính account này; từ chối yêu cầu không qua TLS |

## Vì sao cần

Không có SNS thì CloudWatch Alarm chỉ đổi trạng thái trong Console mà không ai biết — giám sát trên giấy, vô dụng khi có sự cố thật.

## Điều bắt buộc sau khi apply

Mỗi email nhận thư "AWS Notification - Subscription Confirmation" và **phải bấm xác nhận**. Trước khi xác nhận, subscription ở trạng thái `PendingConfirmation` và không nhận được cảnh báo nào.

```bash
aws sns list-subscriptions-by-topic --topic-arn "<alerts_topic_arn>" \
  --query 'Subscriptions[].[Endpoint,SubscriptionArn]' --output table
```

## Vì sao không mã hóa topic

Khóa AWS-managed `aws/sns` không cho CloudWatch và Budgets publish vào topic. Muốn mã hóa phải dùng KMS customer-managed key — đã loại khỏi thiết kế (Mục 3.2). Nội dung cảnh báo không chứa dữ liệu nhạy cảm.

## Input

| Biến | Bắt buộc | Mặc định | Ghi chú |
| :--- | :-: | :--- | :--- |
| `project_name` | Có | | |
| `alert_emails` | Có | | Ít nhất 1 email hợp lệ |
| `allow_budgets_publish` | | `true` | Để sẵn cho trường hợp sau này muốn chuyển cảnh báo chi phí sang SNS (ví dụ nối Slack) |

## Output

`alerts_topic_arn` (dùng làm `alarm_actions` ở `20-runtime`), `alerts_topic_name`, `subscribed_emails`.

## Test độc lập

```bash
cd terraform/modules/observability
terraform init -backend=false
terraform test      # 5 bài, mock provider, không cần AWS
```
