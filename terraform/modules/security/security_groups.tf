# Security Groups — Ke_Hoach_Ha_Tang.md Mục 4.2. Chi phí: $0.
#
# Chuỗi truy cập duy nhất được phép:
#   CloudFront -> alb_sg:443 -> ecs_task_sg:backend_port -> rds_sg:5432
#
# Rule khai báo bằng resource riêng (aws_vpc_security_group_*_rule), không viết inline,
# để các SG tham chiếu lẫn nhau mà không bị vòng lặp phụ thuộc.
# Tạo aws_security_group không có egress inline => Terraform xóa rule allow-all mặc định,
# nên mọi SG ở đây chỉ có đúng những rule khai báo bên dưới.

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "ALB: chi nhan HTTPS tu CloudFront origin-facing"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-alb"
  }
}

resource "aws_security_group" "ecs_task" {
  name        = "${var.project_name}-ecs-task"
  description = "ENI cua ECS task (awsvpc): chi nhan tu ALB"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-ecs-task"
  }
}

resource "aws_security_group" "ecs_host" {
  name        = "${var.project_name}-ecs-host"
  description = "EC2 chay ECS agent: khong nhan ket noi vao"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-ecs-host"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds"
  description = "RDS PostgreSQL: chi nhan tu ECS task"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-rds"
  }
}

# ---------------------------------------------------------------------------
# ALB
# ---------------------------------------------------------------------------
resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS tu CloudFront origin-facing"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# Mở tạm cho bài nghiệm thu 7b — mặc định rỗng nên không tạo rule nào.
resource "aws_vpc_security_group_ingress_rule" "alb_bypass_test" {
  for_each = toset(var.bypass_test_cidrs)

  security_group_id = aws_security_group.alb.id
  description       = "TAM THOI - test chan header X-Origin-Verify"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs_task" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Toi backend tren ECS task"
  referenced_security_group_id = aws_security_group.ecs_task.id
  ip_protocol                  = "tcp"
  from_port                    = var.backend_port
  to_port                      = var.backend_port
}

# ---------------------------------------------------------------------------
# ECS task
# ---------------------------------------------------------------------------
resource "aws_vpc_security_group_ingress_rule" "ecs_task_from_alb" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "Chi tu ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.backend_port
  to_port                      = var.backend_port
}

resource "aws_vpc_security_group_egress_rule" "ecs_task_to_rds" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "PostgreSQL"
  referenced_security_group_id = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
}

# Rộng có chủ đích: AI API (Gemini), Secrets Manager, S3 đều ra qua NAT bằng HTTPS.
# Lọc theo tên miền cần Network Firewall/proxy — ngoài phạm vi (Ke_Hoach_Ha_Tang.md Mục 12).
resource "aws_vpc_security_group_egress_rule" "ecs_task_https" {
  security_group_id = aws_security_group.ecs_task.id
  description       = "HTTPS ra ngoai qua NAT"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# ---------------------------------------------------------------------------
# ECS host (EC2) — không có ingress nào.
# ---------------------------------------------------------------------------
resource "aws_vpc_security_group_egress_rule" "ecs_host_https" {
  security_group_id = aws_security_group.ecs_host.id
  description       = "ECS agent, SSM, ECR, CloudWatch Logs qua NAT"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# ---------------------------------------------------------------------------
# RDS — chỉ ingress, không có egress.
# ---------------------------------------------------------------------------
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs_task" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Chi tu ECS task"
  referenced_security_group_id = aws_security_group.ecs_task.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
}
