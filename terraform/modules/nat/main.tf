# Regional NAT Gateway — Ke_Hoach_Ha_Tang.md Mục 4.1, giả định A18 (provider ~> 6.64 hỗ trợ).
# Chi phí: tính theo giờ cho mỗi AZ đang dùng + phí xử lý dữ liệu theo GB. Thuộc 20-runtime.
#
# Chế độ auto: không khai báo availability_zone_address => AWS tự mở rộng sang AZ có
# workload và tự cấp IP công khai. Không có subnet_id, không có aws_eip để quản lý.

resource "aws_nat_gateway" "main" {
  vpc_id            = var.vpc_id
  availability_mode = "regional"
  connectivity_type = "public"

  tags = {
    Name = "${var.project_name}-nat"
  }
}

# Route table private do 10-foundation tạo, cố ý để trống route mặc định.
resource "aws_route" "private_default" {
  for_each = var.private_route_table_ids

  route_table_id         = each.value
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}

resource "aws_cloudwatch_metric_alarm" "port_allocation_errors" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-nat-port-allocation-errors"
  alarm_description   = "NAT hết cổng nguồn — kết nối ra ngoài (AI API, ECR) bị rớt"
  namespace           = "AWS/NATGateway"
  metric_name         = "ErrorPortAllocation"
  dimensions          = { NatGatewayId = aws_nat_gateway.main.id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_topic_arn]
}
