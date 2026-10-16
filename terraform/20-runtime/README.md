# 20-runtime — NAT, RDS, ALB, ECS (tính phí theo giờ)

Giai đoạn **#7** trong kế hoạch (`Ke_Hoach_Ha_Tang.md` Mục 4.4–4.6, 8). **Khoảng 7–8 USD/ngày khi chạy. Destroy sau mỗi buổi demo.**

| Module | Tạo ra |
| :--- | :--- |
| `modules/nat` | 1 Regional NAT Gateway (chế độ auto) + route `0.0.0.0/0` cho 2 route table private, alarm `ErrorPortAllocation` |
| `modules/database` | RDS PostgreSQL 17 Multi-AZ `db.t4g.small`, gp3 20→100 GiB, mật khẩu do RDS quản lý, alarm CPU / dung lượng / số connection |
| `modules/alb` | ALB public, listener 443 (mặc định 403), rule `X-Origin-Verify` → target group, alarm unhealthy / 5xx / p95 |
| `modules/ecs` | Cluster, launch template `t4g.small` (IMDSv2, EBS mã hóa), ASG 2–6 host, Capacity Provider, task definition arm64, service (Circuit Breaker), Auto Scaling theo CPU 60%, alarm CPU / Memory |
| Stack | Quyền đọc secret RDS cho task execution role; bản ghi `origin.<domain>` khi có tên miền |

Khoảng 30 resource. Đọc output của `10-foundation` qua `terraform_remote_state`.

## Điều kiện trước khi dựng

1. `10-foundation` đang chạy, và **mọi secret trong `app_secret_env` đã có giá trị** (`put-secret-value`). Nếu chưa, task chết với `ResourceInitializationError`.
2. Repository ECR (`10-foundation`) đã có **ít nhất một image arm64** (A5) — do CodeBuild backend đẩy lên, hoặc đẩy tay. Không truyền `container_image` thì stack tự lấy image mới nhất; repository rỗng thì `plan` báo lỗi.
3. `terraform.tfvars` khớp với backend `learning_lab/server` — đã làm, lý do từng giá trị ở `Khop_ha_tang_voi_backend.md`. Sai thì sửa `terraform.tfvars` rồi apply lại — chỉ tạo task definition revision mới, không đụng RDS.
4. Người phụ trách đã đồng ý chi phí.

## Kiểm tra offline (không cần AWS)

```bash
terraform init -backend=false
terraform validate
terraform test          # 3 test tích hợp; test từng module ở terraform/modules/<tên>/
```

## Dựng và destroy

Theo `Huong_dan_quan_ly_ha_tang.md` Mục 7.2 (dựng, khôi phục từ snapshot) và Mục 8.1 (tắt `rds_deletion_protection` rồi destroy), sau đó **bắt buộc** kiểm tra Mục 8.3.

## Migration Diesel (A4)

Backend hiện tại **tự chạy migration + seed lúc khởi động** (`embed_migrations!`), không cần bước riêng. Vì vậy giữ 1 task khi database còn trống để 2 task không migrate cùng lúc.

Chỉ khi app đổi sang chạy migration tay, mới chạy một task riêng từ cùng task definition, ghi đè lệnh:

```bash
aws ecs run-task \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --task-definition "$(terraform output -raw ecs_task_definition_family)" \
  --capacity-provider-strategy capacityProvider=stem-digitizer-ecs-host,weight=1 \
  --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -json private_subnet_ids | jq -r 'join(",")')],securityGroups=[$(terraform output -raw ecs_task_security_group_id)]}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["<lệnh migration>"]}]}'
```

## Những điểm cần biết

| Điểm | Chi tiết |
| :--- | :--- |
| Có tên miền ở `10-foundation` | Tự dùng cert `origin.<domain>` (HTTPS) và tạo bản ghi `origin.<domain>` → ALB |
| Chưa có tên miền (A16) | Listener **HTTP trên cổng 443**. SG `alb` chỉ mở 443 và prefix list CloudFront chiếm khoảng 55/60 rule nên không thêm cổng 80 được. Đoạn CloudFront → ALB **không mã hóa**, kể cả header `X-Origin-Verify`. Có tên miền + ACM thì truyền ARN chứng chỉ, listener tự chuyển HTTPS |
| Final snapshot | Tên `stem-digitizer-final-<thời điểm dựng instance>`, không mang tag `CostTier` để không bị Mục 8.3 báo nhầm |
| Đổi `rds_restore_snapshot_id` khi RDS đang chạy | Không có tác dụng (bị `ignore_changes`) — cố ý, để không thay instance và mất dữ liệu |
| WebSocket in-memory (A9, R1) | Demo phòng thi trực tiếp: đặt `service_desired_count`, `service_min_count`, `service_max_count` cùng bằng 1 |
| Mỗi host tối đa 2 task | `t4g.small` có 3 ENI, mỗi task `awsvpc` chiếm 1 |
| CI/CD deploy bản mới khi stack đang chạy | CodeBuild đăng ký task definition revision mới và update service. Lần `apply` sau, Terraform đọc image mới nhất trên ECR nên không kéo về bản cũ |
