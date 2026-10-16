# Network khung — Ke_Hoach_Ha_Tang.md Mục 4.1.
# Chi phí: $0 (VPC/subnet/route table/IGW miễn phí; Flow Logs tắt mặc định).
#
# Cố ý KHÔNG có NAT Gateway: NAT tính phí theo giờ nên thuộc stack 20-runtime.
# Private route table để trống route 0.0.0.0/0, 20-runtime gắn vào qua output
# private_route_table_ids.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  # Kiến trúc cố định 2 AZ (Ke_Hoach_Ha_Tang.md Mục 3.1).
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  public_subnets_by_az = {
    for idx, az in local.azs : az => var.public_subnet_cidrs[idx]
  }
  private_subnets_by_az = {
    for idx, az in local.azs : az => var.private_subnet_cidrs[idx]
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# Public subnet — chỉ đặt ALB (stack 20-runtime).
resource "aws_subnet" "public" {
  for_each = local.public_subnets_by_az

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value
  availability_zone       = each.key
  map_public_ip_on_launch = false # ALB tự có public IP theo AZ, không cần EC2 auto-assign

  tags = {
    Name = "${var.project_name}-public-${each.key}"
    Tier = "public"
  }
}

# Private subnet — đặt ECS host (EC2), ENI của task (awsvpc), và RDS.
resource "aws_subnet" "private" {
  for_each = local.private_subnets_by_az

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  availability_zone = each.key

  tags = {
    Name = "${var.project_name}-private-${each.key}"
    Tier = "private"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# Mỗi AZ một route table riêng: nếu Regional NAT chưa được provider hỗ trợ và phải
# lùi về 2 NAT zonal, mỗi AZ route sang NAT của chính AZ đó mà không phải sửa module này.
resource "aws_route_table" "private" {
  for_each = toset(local.azs)

  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-private-rt-${each.key}"
  }
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

# Khóa default SG: không khai báo ingress/egress => Terraform xóa hết rule mặc định.
resource "aws_default_security_group" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-default-sg-DO-NOT-USE"
  }
}

# ---------------------------------------------------------------------------
# VPC Flow Logs — tắt mặc định.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name              = "/vpc/${var.project_name}/flow-logs"
  retention_in_days = var.flow_logs_retention_days
}

data "aws_iam_policy_document" "flow_logs_assume" {
  count = var.enable_flow_logs ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name               = "${var.project_name}-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume[0].json
}

data "aws_iam_policy_document" "flow_logs_publish" {
  count = var.enable_flow_logs ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
    ]
    resources = ["${aws_cloudwatch_log_group.vpc_flow_logs[0].arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name   = "${var.project_name}-vpc-flow-logs-publish"
  role   = aws_iam_role.flow_logs[0].id
  policy = data.aws_iam_policy_document.flow_logs_publish[0].json
}

resource "aws_flow_log" "main" {
  count = var.enable_flow_logs ? 1 : 0

  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.vpc_flow_logs[0].arn
  iam_role_arn             = aws_iam_role.flow_logs[0].arn
  max_aggregation_interval = 600

  tags = {
    Name = "${var.project_name}-vpc-flow-logs"
  }
}

# ---------------------------------------------------------------------------
# S3 Gateway Endpoint — miễn phí (Ke_Hoach_Ha_Tang.md Mục 4.1). Lớp image ECR và ảnh
# upload vào bucket Data đi thẳng tới S3, không qua NAT (~0,059 USD/GB).
# Khác Interface Endpoint (tính phí theo giờ) đã loại ở Mục 3.2.
# ---------------------------------------------------------------------------
data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  count = var.enable_s3_gateway_endpoint ? 1 : 0

  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [for az in local.azs : aws_route_table.private[az].id]

  tags = {
    Name = "${var.project_name}-s3"
  }
}
