# RDS PostgreSQL Multi-AZ — Ke_Hoach_Ha_Tang.md Mục 4.5. Thuộc 20-runtime (tính phí theo giờ).
#
# Vòng đời dữ liệu khi destroy/dựng lại mỗi buổi demo:
#   destroy  -> RDS tạo final snapshot "<project>-final-<thời điểm dựng>"
#   dựng lại -> truyền restore_snapshot_id = snapshot mới nhất (Huong_dan Mục 7.2)

locals {
  restoring = var.restore_snapshot_id != null
}

resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db"
  description = "Private subnet cho RDS"
  subnet_ids  = var.private_subnet_ids
}

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-db"

  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # Mục 3.1: Multi-AZ. Chỉ tắt khi tài khoản AWS ở gói Free plan (AWS chặn Multi-AZ).
  multi_az = var.multi_az

  storage_type          = "gp3"
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_encrypted     = true

  # Khi khôi phục từ snapshot, tên DB và user lấy từ snapshot; truyền vào sẽ bị AWS từ chối.
  snapshot_identifier         = var.restore_snapshot_id
  db_name                     = local.restoring ? null : var.db_name
  username                    = local.restoring ? null : var.master_username
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false
  port                   = 5432

  backup_retention_period    = var.backup_retention_days
  auto_minor_version_upgrade = true
  # 20-runtime dựng theo phiên, không chờ được tới khung bảo trì hằng tuần.
  # Đổi cỡ máy / Multi-AZ sẽ áp ngay (đổi cỡ máy có reboot ngắn).
  apply_immediately   = true
  deletion_protection = var.deletion_protection

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-final-${formatdate("YYYYMMDD-hhmm", timestamp())}"
  # Snapshot không mang tag CostTier=session, nếu không bài kiểm tra Mục 8.3 sẽ báo nhầm
  # là "còn sót" dù snapshot được giữ lại có chủ đích.
  copy_tags_to_snapshot = false

  performance_insights_enabled = false
  monitoring_interval          = 0

  lifecycle {
    # timestamp() đổi mỗi lần plan; snapshot_identifier chỉ có ý nghĩa lúc tạo — đổi về
    # sau sẽ làm Terraform thay instance (mất dữ liệu).
    ignore_changes = [final_snapshot_identifier, snapshot_identifier]
  }
}

# ---------------------------------------------------------------------------
# Alarm — chỉ tạo khi có topic nhận cảnh báo.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-rds-cpu-high"
  alarm_description   = "CPU RDS > 80% trong 15 phút"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "free_storage_low" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-rds-free-storage-low"
  alarm_description   = "Dung lượng trống RDS < 2 GiB"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}

# db.t4g.small chịu khoảng 100–150 connection; cảnh báo sớm trước khi ECS scale-out làm ngợp (R2).
resource "aws_cloudwatch_metric_alarm" "connections_high" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-rds-connections-high"
  alarm_description   = "Số connection RDS > ${var.connections_alarm_threshold} (R2: pool Diesel x số task)"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.connections_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}
