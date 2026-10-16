# Test OFFLINE module secrets — `terraform test`, không cần AWS, không tốn tiền.
# Provider aws được mock; provider random chạy thật (không gọi mạng).

mock_provider "aws" {}

variables {
  project_name = "stem-digitizer"
}

run "creates_empty_shells_for_default_secret" {
  command = apply

  assert {
    condition     = toset(keys(aws_secretsmanager_secret.app)) == toset(["jwt-secret"])
    error_message = "Mặc định chỉ có vỏ secret JWT (giả định A6)."
  }

  assert {
    condition     = aws_secretsmanager_secret.app["jwt-secret"].name == "stem-digitizer/jwt-secret"
    error_message = "Tên secret phải theo quy ước <project>/<tên>."
  }

  assert {
    condition     = aws_secretsmanager_secret.app["jwt-secret"].recovery_window_in_days == 7
    error_message = "Recovery window mặc định phải là 7 ngày (Mục 4.3)."
  }
}

run "one_shell_per_requested_name" {
  command = apply

  variables {
    app_secret_names = ["jwt-secret", "gemini-api-key"]
  }

  assert {
    condition     = length(aws_secretsmanager_secret.app) == 2
    error_message = "Mỗi tên trong app_secret_names phải có đúng 1 vỏ secret."
  }

  assert {
    condition     = length(output.execution_secret_arns) == 2
    error_message = "execution_secret_arns phải có đủ ARN của từng vỏ secret để execution role đọc được."
  }

  assert {
    condition     = toset(keys(output.app_secret_arns)) == toset(["jwt-secret", "gemini-api-key"])
    error_message = "app_secret_arns phải có key là tên secret không kèm tiền tố."
  }
}

run "origin_verify_is_32_alphanumeric_chars" {
  command = apply

  assert {
    condition     = can(regex("^[A-Za-z0-9]{32}$", output.origin_verify_value))
    error_message = "X-Origin-Verify phải là 32 ký tự chữ và số (an toàn khi đặt trong HTTP header)."
  }
}

run "no_app_secrets_is_allowed" {
  command = apply

  variables {
    app_secret_names = []
  }

  assert {
    condition     = length(output.execution_secret_arns) == 0
    error_message = "Không có secret app thì danh sách ARN phải rỗng, để security không cấp quyền đọc secret nào."
  }
}

run "rejects_uppercase_or_slash_in_name" {
  command = plan

  variables {
    app_secret_names = ["JWT/Secret"]
  }

  expect_failures = [var.app_secret_names]
}

run "rejects_duplicate_names" {
  command = plan

  variables {
    app_secret_names = ["jwt-secret", "jwt-secret"]
  }

  expect_failures = [var.app_secret_names]
}

run "rejects_zero_recovery_window" {
  command = plan

  variables {
    recovery_window_in_days = 0
  }

  expect_failures = [var.recovery_window_in_days]
}
