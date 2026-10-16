# Test OFFLINE module network — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_data {
    target = data.aws_availability_zones.available
    values = {
      names = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
    }
  }

  # Mock không tự sinh JSON hợp lệ cho aws_iam_policy_document.
  override_data {
    target = data.aws_iam_policy_document.flow_logs_assume
    values = {
      json = "{}"
    }
  }

  override_data {
    target = data.aws_iam_policy_document.flow_logs_publish
    values = {
      json = "{}"
    }
  }
}

variables {
  project_name = "stem-digitizer"
}

run "network_matches_spec" {
  command = apply

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16"
    error_message = "VPC CIDR phải đúng 10.0.0.0/16 theo Ke_Hoach_Ha_Tang.md Mục 4.1."
  }

  assert {
    condition     = aws_vpc.main.enable_dns_support && aws_vpc.main.enable_dns_hostnames
    error_message = "VPC phải bật DNS support và DNS hostnames."
  }

  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private) == 2
    error_message = "Kiến trúc cố định 2 AZ — phải có đúng 2 public và 2 private subnet."
  }

  assert {
    condition     = alltrue([for s in aws_subnet.public : s.map_public_ip_on_launch == false])
    error_message = "Public subnet KHÔNG được tự gán public IP."
  }

  assert {
    condition = length(setintersection(
      toset([for s in aws_subnet.public : s.availability_zone]),
      toset([for s in aws_subnet.private : s.availability_zone]),
    )) == 2
    error_message = "Public và private subnet phải trải đúng trên cùng 2 AZ."
  }

  assert {
    condition     = contains([for r in aws_route_table.public.route : r.cidr_block], "0.0.0.0/0")
    error_message = "Public route table phải có route 0.0.0.0/0 qua Internet Gateway."
  }

  assert {
    condition     = alltrue([for rt in aws_route_table.private : length(rt.route) == 0])
    error_message = "Private route table KHÔNG được có route mặc định — NAT route do stack 20-runtime gắn sau."
  }

  assert {
    condition     = length(aws_route_table_association.public) == 2 && length(aws_route_table_association.private) == 2
    error_message = "Mỗi subnet phải được gắn đúng 1 route table."
  }

  assert {
    condition     = length(aws_default_security_group.main.ingress) == 0 && length(aws_default_security_group.main.egress) == 0
    error_message = "Default SG phải bị khóa hết rule."
  }

  assert {
    condition     = length(aws_flow_log.main) == 0
    error_message = "Flow Logs phải tắt mặc định."
  }
}

run "s3_gateway_endpoint_on_private_routes" {
  command = apply

  override_data {
    target = data.aws_region.current
    values = { region = "ap-southeast-1" }
  }

  assert {
    condition     = aws_vpc_endpoint.s3[0].vpc_endpoint_type == "Gateway" && aws_vpc_endpoint.s3[0].service_name == "com.amazonaws.ap-southeast-1.s3"
    error_message = "Phải có S3 Gateway Endpoint (miễn phí), không phải Interface Endpoint."
  }

  assert {
    condition     = length(aws_vpc_endpoint.s3[0].route_table_ids) == 2
    error_message = "Endpoint phải gắn vào cả 2 route table private."
  }
}

run "rejects_wrong_subnet_count" {
  command = plan

  variables {
    public_subnet_cidrs = ["10.0.0.0/24"]
  }

  expect_failures = [var.public_subnet_cidrs]
}

run "rejects_invalid_vpc_cidr" {
  command = plan

  variables {
    vpc_cidr = "not-a-cidr"
  }

  expect_failures = [var.vpc_cidr]
}

run "flow_logs_can_be_enabled" {
  command = apply

  variables {
    enable_flow_logs = true
  }

  # aws_flow_log kiểm tra cú pháp ARN kể cả với mock — ARN mock tự sinh sai định dạng.
  override_resource {
    target = aws_cloudwatch_log_group.vpc_flow_logs[0]
    values = {
      arn = "arn:aws:logs:ap-southeast-1:123456789012:log-group:/vpc/stem-digitizer/flow-logs:*"
    }
  }

  override_resource {
    target = aws_iam_role.flow_logs[0]
    values = {
      arn = "arn:aws:iam::123456789012:role/stem-digitizer-vpc-flow-logs"
    }
  }

  assert {
    condition     = length(aws_flow_log.main) == 1
    error_message = "Khi enable_flow_logs = true phải có đúng 1 Flow Log."
  }

  assert {
    condition     = aws_cloudwatch_log_group.vpc_flow_logs[0].retention_in_days == 14
    error_message = "Log group của Flow Logs phải retention 14 ngày."
  }
}
