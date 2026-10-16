output "vpc_id" {
  description = "ID của VPC."
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block của VPC."
  value       = aws_vpc.main.cidr_block
}

output "availability_zones" {
  description = "2 AZ đang dùng, theo đúng thứ tự CIDR đã khai báo."
  value       = local.azs
}

output "public_subnet_ids" {
  description = "Map AZ -> subnet ID của public subnet (chỉ đặt ALB)."
  value       = { for az, s in aws_subnet.public : az => s.id }
}

output "private_subnet_ids" {
  description = "Map AZ -> subnet ID của private subnet (ECS host và RDS)."
  value       = { for az, s in aws_subnet.private : az => s.id }
}

output "public_route_table_id" {
  description = "Route table dùng chung cho 2 public subnet."
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "Map AZ -> route table ID của private subnet. Stack 20-runtime gắn route 0.0.0.0/0 -> NAT vào đây."
  value       = { for az, rt in aws_route_table.private : az => rt.id }
}

output "internet_gateway_id" {
  description = "ID của Internet Gateway."
  value       = aws_internet_gateway.main.id
}

output "default_security_group_id" {
  description = "SG mặc định của VPC — đã khóa hết rule, không gắn vào resource nào."
  value       = aws_default_security_group.main.id
}

output "s3_gateway_endpoint_id" {
  description = "ID của S3 Gateway Endpoint (null nếu tắt)."
  value       = one(aws_vpc_endpoint.s3[*].id)
}
