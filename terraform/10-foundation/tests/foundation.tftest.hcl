# Test OFFLINE TÍCH HỢP cho 10-foundation — `terraform test`, không cần AWS, không tốn tiền.
#
# Test chi tiết của từng phần nằm ở terraform/modules/<tên>/tests/. File này chỉ kiểm tra
# những gì module test không thấy được: các module có NỐI ĐÚNG DÂY với nhau không,
# và output của stack có đúng là thứ 20-runtime sẽ đọc không.

mock_provider "aws" {
  override_data {
    target = module.network.data.aws_availability_zones.available
    values = {
      names = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
    }
  }

  override_data {
    target = module.security.data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = module.security.data.aws_region.current
    values = { region = "ap-southeast-1" }
  }

  override_data {
    target = module.security.data.aws_partition.current
    values = { partition = "aws" }
  }

  override_data {
    target = module.security.data.aws_iam_policy_document.ec2_assume
    values = { json = "{}" }
  }

  override_data {
    target = module.security.data.aws_iam_policy_document.ecs_tasks_assume
    values = { json = "{}" }
  }

  override_data {
    target = module.security.data.aws_iam_policy_document.task
    values = { json = "{}" }
  }

  # VPC ID mock phải đúng định dạng vpc-xxxx vì module security kiểm tra vpc_id.
  override_resource {
    target = module.network.aws_vpc.main
    values = { id = "vpc-0a1b2c3d4e5f60718" }
  }

  override_data {
    target = module.observability.data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = module.observability.data.aws_partition.current
    values = { partition = "aws" }
  }

  override_data {
    target = module.observability.data.aws_iam_policy_document.alerts_topic
    values = { json = "{}" }
  }

  # Subscription và topic policy kiểm tra cú pháp ARN của topic.
  override_resource {
    target = module.observability.aws_sns_topic.alerts
    values = { arn = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts" }
  }

  # Module security kiểm tra ARN secret truyền vào có đúng cú pháp không.
  override_resource {
    target = module.secrets.aws_secretsmanager_secret.app["jwt-secret"]
    values = { arn = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-secret-AbCdEf" }
  }

  override_data {
    target = module.security.data.aws_iam_policy_document.task_execution_secrets
    values = { json = "{}" }
  }

  override_data {
    target = module.s3.data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = module.s3.data.aws_partition.current
    values = { partition = "aws" }
  }

  override_data {
    target = module.s3.data.aws_region.current
    values = { region = "ap-southeast-1" }
  }

  override_data {
    target = module.s3.data.aws_iam_policy_document.deny_insecure_transport
    values = { json = "{}" }
  }

  override_data {
    target = module.s3.data.aws_iam_policy_document.trail_logs
    values = { json = "{}" }
  }

  override_data {
    target = module.cicd[0].data.aws_iam_policy_document.codebuild_assume
    values = { json = "{}" }
  }

  override_data {
    target = module.cicd[0].data.aws_iam_policy_document.frontend
    values = { json = "{}" }
  }

  override_data {
    target = module.cicd[0].data.aws_iam_policy_document.backend
    values = { json = "{}" }
  }
}

# Provider us-east-1 cho module dns (cert CloudFront) khi bật domain_name.
mock_provider "aws" {
  alias = "us_east_1"
}

# terraform test tự đọc terraform.tfvars; ghim lại để test không phụ thuộc cấu hình thật.
variables {
  alert_emails     = ["ops@example.com"]
  app_secret_names = ["jwt-secret"]
  github_repo_url  = null
}

run "modules_are_wired_together" {
  command = apply

  assert {
    condition     = module.security.alb_security_group_id != null && output.vpc_id == "vpc-0a1b2c3d4e5f60718"
    error_message = "Stack phải dựng được cả network lẫn security."
  }

  assert {
    condition     = output.vpc_id == module.network.vpc_id
    error_message = "Output vpc_id của stack phải lấy từ module network."
  }

  assert {
    condition     = length(output.public_subnet_ids) == 2 && length(output.private_subnet_ids) == 2 && length(output.private_route_table_ids) == 2
    error_message = "Stack phải xuất đủ subnet và route table của 2 AZ cho 20-runtime."
  }

  assert {
    condition     = output.budget_name == "stem-digitizer-monthly-cost"
    error_message = "Budget phải được dựng cùng stack với tên đúng quy ước."
  }

  assert {
    condition = alltrue([
      output.alb_security_group_id != null,
      output.ecs_task_security_group_id != null,
      output.ecs_host_security_group_id != null,
      output.rds_security_group_id != null,
      output.ecs_instance_profile_name == "stem-digitizer-ecs-instance",
    ])
    error_message = "Stack phải xuất đủ SG và instance profile cho 20-runtime."
  }
}

run "alerts_reach_team_through_both_channels" {
  command = apply

  assert {
    condition     = output.alerts_topic_arn == "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"
    error_message = "Stack phải xuất ARN của SNS topic alerts cho 20-runtime."
  }

  assert {
    condition     = module.observability.subscribed_emails == tolist(["ops@example.com"])
    error_message = "alert_emails của stack phải thành subscription của SNS topic."
  }

  assert {
    condition     = module.budgets.alert_emails == tolist(["ops@example.com"])
    error_message = "alert_emails của stack cũng phải nhận cảnh báo Budgets trực tiếp."
  }

  assert {
    condition     = module.budgets.actual_alert_thresholds == tolist([50, 80, 100, 200])
    error_message = "Với ngân sách 30 USD, cảnh báo thực tế phải ở 15, 24, 30 và 60 USD."
  }
}

run "secrets_and_buckets_reach_the_task_roles" {
  command = apply

  assert {
    condition     = output.data_bucket_arn == "arn:aws:s3:::stem-digitizer-data-123456789012-ap-southeast-1"
    error_message = "Stack phải xuất ARN bucket Data từ module s3."
  }

  assert {
    condition     = tolist(module.security.granted_secret_arns) == tolist(["arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:stem-digitizer/jwt-secret-AbCdEf"])
    error_message = "Execution role phải được đọc đúng các secret do module secrets tạo."
  }

  assert {
    condition     = tolist(module.security.granted_data_bucket_object_arns) == tolist(["${output.data_bucket_arn}/*"])
    error_message = "Task role phải được Get/Put object trong đúng bucket Data do module s3 tạo."
  }

  assert {
    condition     = length(output.app_secret_arns) == 1 && can(output.origin_verify_value)
    error_message = "Stack phải xuất secret của app và giá trị X-Origin-Verify cho 20-runtime và 30-edge."
  }
}

run "edge_and_ci_inputs_are_exported" {
  command = apply

  assert {
    condition = alltrue([
      output.frontend_bucket_id == "stem-digitizer-frontend-123456789012-ap-southeast-1",
      output.frontend_bucket_arn == "arn:aws:s3:::stem-digitizer-frontend-123456789012-ap-southeast-1",
      output.data_bucket_id == "stem-digitizer-data-123456789012-ap-southeast-1",
    ])
    error_message = "Stack phải xuất tên và ARN bucket cho 30-edge và CodeBuild."
  }

  assert {
    condition     = can(regex("^[A-Za-z0-9]{32}$", nonsensitive(output.origin_verify_value)))
    error_message = "X-Origin-Verify xuất ra phải là 32 ký tự chữ và số."
  }
}

run "project_name_flows_into_every_module" {
  command = plan

  variables {
    project_name = "learning-lab-test"
  }

  assert {
    condition     = output.ecs_instance_profile_name == "learning-lab-test-ecs-instance"
    error_message = "project_name của stack phải truyền xuống module security."
  }

  assert {
    condition     = output.budget_name == "learning-lab-test-monthly-cost"
    error_message = "project_name của stack phải truyền xuống module budgets."
  }
}

run "defaults_create_only_free_additions" {
  command = plan

  assert {
    condition     = output.ecr_repository_name == "stem-digitizer-backend"
    error_message = "ECR luôn được tạo để có chỗ đẩy image backend."
  }

  assert {
    condition     = length(module.dns) == 0 && length(module.ses) == 0 && length(module.cicd) == 0
    error_message = "Chưa có domain/repo thì không tạo dns, ses, cicd."
  }
}

run "domain_ses_and_cicd_wire_when_enabled" {
  command = plan

  variables {
    domain_name             = "learninglab.example"
    dns_wait_for_validation = false
    enable_ses              = true
    github_repo_url         = "https://github.com/example/learning-lab.git"
  }

  assert {
    condition     = length(module.dns) == 1 && length(module.ses) == 1 && length(module.cicd) == 1
    error_message = "Có domain + enable_ses + repo thì tạo đủ dns, ses, cicd."
  }

  assert {
    condition     = output.origin_fqdn == "origin.learninglab.example"
    error_message = "Phải xuất origin.<domain> cho 20-runtime và 30-edge."
  }
}

run "ses_requires_domain" {
  command = plan

  variables {
    enable_ses = true
  }

  expect_failures = [var.enable_ses]
}
