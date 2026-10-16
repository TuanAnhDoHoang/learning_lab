# Module `network`

VPC khung cho toàn dự án — `Ke_Hoach_Ha_Tang.md` Mục 4.1. Chi phí **$0** (Flow Logs tắt mặc định).

| Tạo ra | Chi tiết |
| :--- | :--- |
| VPC | `10.0.0.0/16`, bật DNS support và DNS hostnames |
| 2 public subnet | `10.0.0.0/24`, `10.0.1.0/24` — chỉ đặt ALB, không tự gán public IP |
| 2 private subnet | `10.0.16.0/20`, `10.0.32.0/20` — ECS host, ENI của task, RDS |
| Internet Gateway | Gắn vào route table public |
| Route table | 1 bảng public dùng chung; mỗi AZ 1 bảng private, **chưa có route ra Internet** |
| Default SG | Bị khóa hết rule |
| VPC Flow Logs | Chỉ khi `enable_flow_logs = true` |

**Không** tạo NAT Gateway — NAT tính phí theo giờ nên thuộc stack `20-runtime`, gắn route vào `private_route_table_ids`.

## Input

| Biến | Bắt buộc | Mặc định |
| :--- | :-: | :--- |
| `project_name` | Có | |
| `vpc_cidr` | | `10.0.0.0/16` |
| `public_subnet_cidrs` | | `["10.0.0.0/24", "10.0.1.0/24"]` — đúng 2 phần tử |
| `private_subnet_cidrs` | | `["10.0.16.0/20", "10.0.32.0/20"]` — đúng 2 phần tử |
| `enable_flow_logs` | | `false` |
| `flow_logs_retention_days` | | `14` |

## Output chính

`vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `private_route_table_ids` (các map có key là tên AZ), `availability_zones`, `internet_gateway_id`.

## Test độc lập

```bash
cd terraform/modules/network
terraform init -backend=false
terraform test      # 4 bài, mock provider, không cần AWS
```
