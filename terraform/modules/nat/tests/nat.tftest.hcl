# Test OFFLINE module nat — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {}

variables {
  project_name = "stem-digitizer"
  vpc_id       = "vpc-0a1b2c3d4e5f60718"
  private_route_table_ids = {
    "ap-southeast-1a" = "rtb-0aaaaaaaaaaaaaaaa"
    "ap-southeast-1b" = "rtb-0bbbbbbbbbbbbbbbb"
  }
  alarm_topic_arn = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"
}

run "regional_nat_routes_both_azs" {
  command = apply

  assert {
    condition     = aws_nat_gateway.main.availability_mode == "regional" && aws_nat_gateway.main.subnet_id == null
    error_message = "NAT phải ở chế độ regional (1 resource cho 2 AZ), không gắn subnet."
  }

  assert {
    condition     = length(aws_route.private_default) == 2
    error_message = "Mỗi route table private phải có đúng 1 route mặc định."
  }

  assert {
    condition = alltrue([
      for r in aws_route.private_default :
      r.destination_cidr_block == "0.0.0.0/0" && r.nat_gateway_id == aws_nat_gateway.main.id
    ])
    error_message = "Route mặc định phải trỏ 0.0.0.0/0 vào NAT."
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.port_allocation_errors) == 1
    error_message = "Có topic thì phải có alarm ErrorPortAllocation."
  }
}

run "rejects_single_az" {
  command = plan

  variables {
    private_route_table_ids = { "ap-southeast-1a" = "rtb-0aaaaaaaaaaaaaaaa" }
  }

  expect_failures = [var.private_route_table_ids]
}
