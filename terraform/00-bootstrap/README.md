# 00-bootstrap — Remote state (S3 + DynamoDB lock)

Giai đoạn **#1** trong kế hoạch (Mục 6). Tạo nơi lưu state cho mọi stack sau.

| Resource | Chi phí |
|---|---|
| S3 bucket `<project>-tfstate-<account>-<region>` (versioning, SSE-S3, chặn public, bắt buộc TLS) | ~$0 (vài KB) |
| DynamoDB table `<project>-tfstate-lock` (on-demand) | ~$0 |

Cả hai có `prevent_destroy = true` — thuộc nhóm 🟢, giữ xuyên suốt dự án.

## 0. Kiểm tra offline (không cần tài khoản AWS)

```bash
cd terraform/00-bootstrap
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform test          # dùng mock provider, không gọi AWS
```

## 1. Deploy (cần tài khoản AWS đang hoạt động)

```bash
aws sts get-caller-identity          # xác nhận đúng account + đăng nhập được
cd terraform/00-bootstrap
terraform init
terraform plan -out=tfplan           # XEM KỸ: chỉ có ~9 resource S3/DynamoDB
terraform apply tfplan
terraform output -raw backend_hcl > ../backend.hcl
```

## 2. Chạy thử — xác nhận hoạt động

```bash
B=$(terraform output -raw state_bucket_name)
T=$(terraform output -raw lock_table_name)

aws s3api get-bucket-versioning        --bucket "$B"   # => "Status": "Enabled"
aws s3api get-public-access-block      --bucket "$B"   # => 4 giá trị true
aws s3api get-bucket-encryption        --bucket "$B"   # => AES256
aws dynamodb describe-table --table-name "$T" --query 'Table.TableStatus'  # => "ACTIVE"

# Thử backend thật với stack smoke-test (không tạo tài nguyên AWS nào):
cd ../99-smoke-test-backend
terraform init -backend-config=../backend.hcl
terraform apply -auto-approve                          # => ping = "backend-ok"
aws s3 ls "s3://$B/smoke-test/"                        # => thấy terraform.tfstate
terraform destroy -auto-approve
```

Kiểm tra khóa state: mở 2 terminal trong `99-smoke-test-backend`, chạy
`terraform apply` ở cả hai gần như cùng lúc — terminal thứ hai phải báo
`Error acquiring the state lock`.

## 3. Sau khi apply

- File `terraform.tfstate` (local) của stack này **không commit Git** nhưng **đừng xóa** —
  sao lưu vào nơi an toàn. Mất file này thì phải `terraform import` lại 2 resource.
- Terraform ≥ 1.11 báo cảnh báo `dynamodb_table` deprecated — vẫn chạy bình thường.
  Kế hoạch (Mục 3.1) chốt dùng DynamoDB nên giữ nguyên; nếu sau này muốn chuyển sang
  khóa native của S3, thêm `use_lockfile = true` vào `backend.hcl`.

## Dọn dẹp (chỉ khi bỏ hẳn dự án)

Bỏ `prevent_destroy` trong `main.tf`, làm rỗng bucket (kể cả mọi version), rồi `terraform destroy`.
