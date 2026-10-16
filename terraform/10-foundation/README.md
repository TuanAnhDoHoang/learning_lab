# 10-foundation

Stack **thường trực** (`CostTier = persistent`) — không destroy sau mỗi buổi demo.
Giai đoạn #2 trong `Ke_Hoach_Ha_Tang.md` Mục 8.

## Cách tổ chức: module + stack ghép

Mỗi phần hạ tầng là một **module** trong `terraform/modules/`, có test riêng và chạy
độc lập được. Stack này **không chứa logic** — chỉ gọi các module và nối output của
module này vào input của module kia (`main.tf`).

```text
terraform/
├── modules/
│   ├── network/        VPC, subnet, route table, IGW        tests: 4
│   ├── budgets/        AWS Budgets + cảnh báo email          tests: 6
│   ├── security/       Security Group + IAM role cho ECS     tests: 12
│   ├── observability/  SNS topic alerts cho CloudWatch       tests: 5
│   ├── secrets/        Vỏ secret app + X-Origin-Verify       tests: 7
│   ├── s3/             3 bucket + CloudTrail                 tests: 17
│   ├── ecr/            Repository image backend              tests: 2
│   ├── dns/            Hosted zone + 2 cert ACM              tests: 3   (khi có domain_name)
│   ├── ses/            Identity SES + DKIM                   tests: 3   (khi enable_ses)
│   └── cicd/           CodeConnections + 2 CodeBuild         tests: 4   (khi có github_repo_url)
└── 10-foundation/      gọi và nối các module trên            tests: 8 (tích hợp)
```

Nối dây hiện tại:

| Từ | Tới | Ý nghĩa |
| :--- | :--- | :--- |
| `module.network.vpc_id` | `module.security.vpc_id` | Security Group tạo trong đúng VPC |
| `var.alert_emails` | `module.budgets` và `module.observability` | Một danh sách email nhận cả cảnh báo chi phí lẫn cảnh báo vận hành |
| `module.secrets.execution_secret_arns` | `module.security.execution_secret_arns` | Execution role chỉ đọc được đúng các secret đã tạo |
| `module.s3.data_bucket_arn` | `module.security.data_bucket_arn` | Task role chỉ Get/Put object trong đúng bucket Data |
| `module.ses[*].identity_arn` | `module.security.ses_identity_arns` | Task role chỉ gửi email từ đúng identity |
| `module.ecr`, `module.s3` (Frontend), role task | `module.cicd` | CodeBuild chỉ đẩy đúng repository, đồng bộ đúng bucket, PassRole đúng 2 role |

## Trạng thái các phần

| Thứ tự | Module | Trạng thái | Chi phí |
| :-: | :--- | :--- | :--- |
| 1 | `network` | Xong, 4/4 test | $0 |
| 2 | `budgets` | Xong, 6/6 test | $0 |
| 3 | `security` | Xong, 12/12 test | $0 |
| 4 | `observability` (SNS topic `alerts`) | Xong, 5/5 test | $0 |
| 5 | `secrets` (Secrets Manager vỏ + `X-Origin-Verify`) | Xong, 7/7 test | Khoảng $0,40/secret/tháng |
| 6 | `s3` (Frontend, Data, CloudTrail logs) + CloudTrail | Xong, 17/17 test | Gần $0 |
| 7 | `ecr` | Xong, 2/2 test. Luôn tạo | ~0,10 USD/GB image |
| 8 | `cicd` (CodeConnections, CodeBuild + IAM của CodeBuild) | Xong, 4/4 test. Chỉ tạo khi có `github_repo_url` | Theo phút build |
| 9 | `dns` (ACM + Route 53) | Xong, 3/3 test. Chỉ tạo khi có `domain_name` | $0,50/tháng hosted zone |
| 10 | `ses` (email giao dịch) | Xong, 3/3 test. Chỉ tạo khi `enable_ses = true` (A17) | Gần $0 |
| — | S3 Gateway Endpoint (trong `network`) | Xong. Bật mặc định | $0 |

Chưa có NAT Gateway: thuộc stack `20-runtime` vì tính phí theo giờ.

## Thêm một module mới vào stack

1. Viết module trong `terraform/modules/<tên>/`: `versions.tf` (không khai báo `provider`), `variables.tf`, `main.tf`, `outputs.tf`, `tests/<tên>.tftest.hcl`, `README.md`.
2. Chạy test độc lập trong thư mục module cho tới khi 100% qua.
3. Thêm khối `module "<tên>"` vào `main.tf` của stack này, nối output của module khác vào input.
4. Thêm biến vào `variables.tf`, thêm output cần cho `20-runtime` vào `outputs.tf`.
5. Thêm `override_data` cho data source mới của module vào `tests/foundation.tftest.hcl`, thêm assert kiểm tra dây nối mới.
6. Chạy lại test của stack này.

## Kiểm tra offline (không cần AWS, không tốn tiền)

```bash
# Từng module
for m in network budgets security observability secrets s3; do
  (cd terraform/modules/$m && terraform init -backend=false >/dev/null && terraform test)
done

# Stack ghép
cd terraform/10-foundation
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform test
```

## Deploy (cần tài khoản AWS và `00-bootstrap` đã apply)

```bash
cd terraform/10-foundation
cp terraform.tfvars.example terraform.tfvars   # rồi điền alert_emails thật

aws sts get-caller-identity
terraform init -backend-config=../backend.hcl
terraform plan -out=tfplan      # VPC, subnet, route table, 4 SG, 3 IAM role, 1 budget, 1 SNS topic, 1 vỏ secret, 3 bucket, 1 trail
terraform apply tfplan
```

Sau khi apply, làm hai việc:

1. **Xác nhận email SNS** — mỗi email trong `alert_emails` nhận một thư xác nhận; chưa bấm thì không nhận được cảnh báo vận hành. Cảnh báo Budgets gửi thẳng, không cần xác nhận.
2. **Đặt giá trị cho secret** — Terraform chỉ tạo vỏ rỗng. Bắt buộc làm trước khi dựng `20-runtime`:

```bash
aws secretsmanager put-secret-value \
  --secret-id "stem-digitizer/jwt-secret" \
  --secret-string "$(openssl rand -base64 48)"
```

## Kiểm tra sau khi apply

```bash
VPC_ID=$(terraform output -raw vpc_id)

# 4 subnet, cột cuối đều False
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[].[SubnetId,CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]' --output table

# Default SG đã khóa: [] []
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=default" \
  --query 'SecurityGroups[0].[IpPermissions,IpPermissionsEgress]'

# 4 SG của dự án
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Project,Values=stem-digitizer" \
  --query 'SecurityGroups[].[GroupName,GroupId]' --output table

# SNS subscription — PendingConfirmation nghĩa là chưa bấm xác nhận
aws sns list-subscriptions-by-topic --topic-arn "$(terraform output -raw alerts_topic_arn)" \
  --query 'Subscriptions[].[Endpoint,SubscriptionArn]' --output table

# 3 bucket, không bucket nào public
for b in $(terraform output -raw frontend_bucket_id) $(terraform output -raw data_bucket_id); do
  aws s3api get-public-access-block --bucket "$b" --query 'PublicAccessBlockConfiguration'
done

# Trail đang ghi log
aws cloudtrail get-trail-status --name "$(terraform output -raw cloudtrail_arn)" --query 'IsLogging'

# Secret đã có giá trị chưa (lỗi ResourceNotFoundException = chưa đặt)
aws secretsmanager get-secret-value --secret-id "stem-digitizer/jwt-secret" --query 'ARN'

# Budget
aws budgets describe-budget --account-id "$(aws sts get-caller-identity --query Account --output text)" \
  --budget-name "$(terraform output -raw budget_name)" --query 'Budget.[BudgetName,BudgetLimit]'
```

## Dọn dẹp

Không destroy trong quy trình `down` hằng ngày. Chỉ destroy khi bỏ hẳn dự án, sau khi đã destroy `20-runtime` và `30-edge`.

Khi đó cần thêm hai bước, vì mặc định stack tự bảo vệ dữ liệu:

- Bucket còn object thì destroy thất bại. Đặt `s3_force_destroy = true` rồi apply trước khi destroy.
- Secret không mất ngay mà chờ 7 ngày (`recovery_window_in_days`). Trong thời gian đó **không tạo lại được secret cùng tên**, nên nếu định dựng lại dự án sớm thì đổi `project_name` hoặc xóa hẳn bằng `aws secretsmanager delete-secret --force-delete-without-recovery`.
