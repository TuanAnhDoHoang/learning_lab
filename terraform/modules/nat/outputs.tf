output "nat_gateway_id" {
  description = "ID của Regional NAT Gateway."
  value       = aws_nat_gateway.main.id
}
