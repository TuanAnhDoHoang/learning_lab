# Test OFFLINE module database — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  # Mock không tự sinh khối lồng nhau master_user_secret.
  override_resource {
    target = aws_db_instance.main
    values = {
      master_user_secret = [{
        secret_arn    = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:rds!db-abc-123456"
        secret_status = "active"
        kms_key_id    = ""
      }]
    }
  }
}

variables {
  project_name       = "stem-digitizer"
  private_subnet_ids = ["subnet-0aaaaaaaaaaaaaaaa", "subnet-0bbbbbbbbbbbbbbbb"]
  security_group_id  = "sg-0aaaaaaaaaaaaaaaa"
  alarm_topic_arn    = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"
}

run "fresh_database_matches_spec" {
  command = apply

  assert {
    condition     = aws_db_instance.main.multi_az == true
    error_message = "RDS phải Multi-AZ cố định (Mục 3.1)."
  }

  assert {
    condition     = aws_db_instance.main.storage_encrypted && !aws_db_instance.main.publicly_accessible
    error_message = "RDS phải mã hóa ổ đĩa và không public."
  }

  assert {
    condition     = aws_db_instance.main.manage_master_user_password == true && aws_db_instance.main.password == null
    error_message = "Mật khẩu phải do RDS quản lý, không được nằm trong Terraform."
  }

  assert {
    condition     = aws_db_instance.main.max_allocated_storage > aws_db_instance.main.allocated_storage
    error_message = "Storage Auto Scaling phải bật."
  }

  assert {
    condition     = aws_db_instance.main.deletion_protection && !aws_db_instance.main.skip_final_snapshot
    error_message = "Mặc định phải bật deletion protection và luôn tạo final snapshot."
  }

  assert {
    condition     = startswith(aws_db_instance.main.final_snapshot_identifier, "stem-digitizer-final-")
    error_message = "Final snapshot phải có tiền tố stem-digitizer-final- để lệnh khôi phục (Huong_dan Mục 7.2) tìm được."
  }

  assert {
    condition     = aws_db_instance.main.copy_tags_to_snapshot == false
    error_message = "Snapshot không được mang tag CostTier=session (gây báo nhầm ở Mục 8.3)."
  }

  assert {
    condition     = aws_db_instance.main.db_name == "stem_digitizer"
    error_message = "Dựng mới phải tạo database stem_digitizer."
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.cpu_high) == 1 && length(aws_cloudwatch_metric_alarm.free_storage_low) == 1 && length(aws_cloudwatch_metric_alarm.connections_high) == 1
    error_message = "Có topic thì phải có đủ 3 alarm."
  }
}

run "restore_from_snapshot" {
  command   = plan
  state_key = "restore"

  variables {
    restore_snapshot_id = "stem-digitizer-final-20261002-1500"
  }

  assert {
    condition     = aws_db_instance.main.snapshot_identifier == "stem-digitizer-final-20261002-1500"
    error_message = "Phải khôi phục từ snapshot được truyền vào."
  }

  assert {
    condition     = aws_db_instance.main.multi_az == true
    error_message = "Khôi phục cũng phải Multi-AZ."
  }
}

run "no_topic_no_alarms" {
  command = plan

  variables {
    alarm_topic_arn = null
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.cpu_high) == 0 && length(aws_cloudwatch_metric_alarm.free_storage_low) == 0
    error_message = "Không có topic thì không tạo alarm."
  }
}

run "rejects_reserved_username" {
  command = plan

  variables {
    master_username = "postgres"
  }

  expect_failures = [var.master_username]
}
