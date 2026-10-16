# Module `security`

Security Group và IAM role cho ECS trên EC2 — `Ke_Hoach_Ha_Tang.md` Mục 4.2. Chi phí **$0**.

Module chỉ cần `vpc_id`, không phụ thuộc trực tiếp vào module `network`: khi test độc lập thì truyền ID giả, khi ghép trong `10-foundation` thì truyền `module.network.vpc_id`.

## Security Group

Chuỗi truy cập duy nhất được phép: **CloudFront → ALB:443 → ECS task:backend_port → RDS:5432**.

| SG | Inbound | Outbound |
| :--- | :--- | :--- |
| `alb` | 443 chỉ từ prefix list `com.amazonaws.global.cloudfront.origin-facing`, cộng IP trong `bypass_test_cidrs` | `backend_port` tới `ecs_task` |
| `ecs_task` | `backend_port` chỉ từ `alb` | 5432 tới `rds`; 443 ra Internet qua NAT |
| `ecs_host` | Không có | 443 ra Internet qua NAT |
| `rds` | 5432 chỉ từ `ecs_task` | Không có |

`bypass_test_cidrs` chỉ nhận IP đơn lẻ dạng `/32`, tối đa 3 — từ chối `0.0.0.0/0` hay cả dải mạng.

## IAM role

| Role | Dùng bởi | Quyền |
| :--- | :--- | :--- |
| `<project>-ecs-instance` (+ instance profile) | EC2 host | `AmazonEC2ContainerServiceforEC2Role`, `AmazonSSMManagedInstanceCore` |
| `<project>-ecs-task-execution` | ECS agent khi khởi động task | `AmazonECSTaskExecutionRolePolicy`; đọc **đúng** các secret trong `execution_secret_arns` |
| `<project>-ecs-task` | Code backend khi chạy | ECS Exec (nếu bật); Get/Put object trong bucket Data (nếu truyền); `bedrock:InvokeModel` trên đúng ARN (nếu truyền); `ses:SendEmail`/`SendRawEmail` trên đúng identity (nếu truyền) |

- Trust policy của 2 role ECS task có điều kiện `aws:SourceAccount` và `aws:SourceArn` giới hạn trong đúng account và region (chống confused deputy).
- Mỗi nhóm quyền của task role **chỉ xuất hiện khi input tương ứng được truyền**. Mặc định chỉ có ECS Exec.
- Không nhận wildcard: ARN secret phải cụ thể, ARN Bedrock và SES không được chứa `*`.
- Role cho CodeBuild **không** nằm ở đây — sẽ viết cùng module `cicd` để quyền đi liền với ECR, S3 frontend, CloudFront.
- Quyền đọc secret do RDS quản lý **không** nằm ở đây — `20-runtime` gắn vào `task_execution_role_name` vì ARN secret đổi mỗi lần dựng lại RDS.

## Input

| Biến | Bắt buộc | Mặc định | Nguồn khi ghép |
| :--- | :-: | :--- | :--- |
| `project_name` | Có | | |
| `vpc_id` | Có | | `module.network.vpc_id` |
| `backend_port` | | `3000` | Giả định A1 |
| `db_port` | | `5432` | |
| `bypass_test_cidrs` | | `[]` | Chỉ điền khi chạy bài nghiệm thu 7b |
| `execution_secret_arns` | | `[]` | Module `secrets` (chưa viết) |
| `data_bucket_arn` | | `null` | Module `s3` (chưa viết) |
| `bedrock_model_arns` | | `[]` | Khi chốt dùng Bedrock |
| `ses_identity_arns` | | `[]` | Module `ses` (chưa viết), chỉ khi giả định A17 được xác nhận |
| `enable_ecs_exec` | | `true` | |

## Output

SG: `alb_security_group_id`, `ecs_task_security_group_id`, `ecs_host_security_group_id`, `rds_security_group_id`, `cloudfront_prefix_list_id`.
IAM: `ecs_instance_profile_name`, `ecs_instance_role_name`, `task_execution_role_arn`, `task_execution_role_name`, `task_role_arn`, `task_role_name`.

## Test độc lập

```bash
cd terraform/modules/security
terraform init -backend=false
terraform test      # 12 bài, mock provider, không cần AWS
```
