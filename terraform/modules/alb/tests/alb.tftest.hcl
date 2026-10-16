# Test OFFLINE module alb — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_resource {
    target = aws_lb.main
    values = {
      arn        = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:loadbalancer/app/stem-digitizer-alb/0123456789abcdef"
      arn_suffix = "app/stem-digitizer-alb/0123456789abcdef"
    }
  }

  override_resource {
    target = aws_lb_target_group.api
    values = {
      arn        = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/stem-digitizer-api/0123456789abcdef"
      arn_suffix = "targetgroup/stem-digitizer-api/0123456789abcdef"
    }
  }

  override_resource {
    target = aws_lb_listener.main
    values = {
      arn = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:listener/app/stem-digitizer-alb/0123456789abcdef/0123456789abcdef"
    }
  }
}

variables {
  project_name        = "stem-digitizer"
  vpc_id              = "vpc-0a1b2c3d4e5f60718"
  public_subnet_ids   = ["subnet-0aaaaaaaaaaaaaaaa", "subnet-0bbbbbbbbbbbbbbbb"]
  security_group_id   = "sg-0aaaaaaaaaaaaaaaa"
  origin_verify_value = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
  alarm_topic_arn     = "arn:aws:sns:ap-southeast-1:123456789012:stem-digitizer-alerts"
}

run "blocks_requests_without_origin_header" {
  command = apply

  assert {
    condition     = aws_lb.main.internal == false && aws_lb.main.drop_invalid_header_fields
    error_message = "ALB phải public (CloudFront gọi vào) và bỏ header không hợp lệ."
  }

  assert {
    condition     = aws_lb.main.idle_timeout == 180
    error_message = "idle_timeout phải 180 giây (A11, WebSocket)."
  }

  assert {
    condition     = aws_lb_listener.main.port == 443 && aws_lb_listener.main.default_action[0].fixed_response[0].status_code == "403"
    error_message = "Listener 443, mặc định trả 403 (chống bypass CloudFront)."
  }

  assert {
    condition     = aws_lb_listener_rule.origin_verify.priority == 1 && nonsensitive(one(one(aws_lb_listener_rule.origin_verify.condition).http_header).http_header_name) == "X-Origin-Verify"
    error_message = "Rule ưu tiên 1 phải kiểm tra header X-Origin-Verify."
  }

  assert {
    condition     = aws_lb_target_group.api.target_type == "ip" && aws_lb_target_group.api.port == 3000
    error_message = "Target group kiểu ip (awsvpc) và đúng backend_port."
  }

  assert {
    condition     = aws_lb_target_group.api.deregistration_delay == "120"
    error_message = "deregistration_delay phải khớp stopTimeout 120 giây."
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.unhealthy_targets) == 1 && length(aws_cloudwatch_metric_alarm.target_5xx) == 1 && length(aws_cloudwatch_metric_alarm.response_time_p95) == 1
    error_message = "Có topic thì phải có đủ 3 alarm."
  }
}

run "http_on_443_without_certificate" {
  command   = plan
  state_key = "http"

  assert {
    condition     = aws_lb_listener.main.protocol == "HTTP" && aws_lb_listener.main.port == 443
    error_message = "Không có chứng chỉ thì listener là HTTP (vẫn cổng 443)."
  }
}

run "https_tls13_with_certificate" {
  command   = plan
  state_key = "https"

  variables {
    certificate_arn = "arn:aws:acm:ap-southeast-1:123456789012:certificate/00000000-0000-0000-0000-000000000000"
  }

  assert {
    condition     = aws_lb_listener.main.protocol == "HTTPS" && aws_lb_listener.main.ssl_policy == "ELBSecurityPolicy-TLS13-1-2-2021-06"
    error_message = "Có chứng chỉ thì listener phải HTTPS với chính sách TLS 1.3."
  }
}

run "rejects_wildcard_in_origin_value" {
  command = plan

  variables {
    origin_verify_value = "AbCdEfGhIjKlMnOpQrStUvWxYz01234*"
  }

  expect_failures = [var.origin_verify_value]
}
