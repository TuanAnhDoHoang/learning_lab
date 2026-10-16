# Application Load Balancer — Ke_Hoach_Ha_Tang.md Mục 4.6. Thuộc 20-runtime.
#
# Chống bypass CloudFront, lớp ứng dụng: hành động mặc định trả 403, chỉ request mang
# đúng header X-Origin-Verify mới được forward. Lớp mạng là SG alb ở 10-foundation.
#
# Listener luôn ở cổng 443 vì SG alb chỉ mở 443 từ prefix list CloudFront. Prefix list
# đó tính khoảng 55 rule vào hạn mức 60 rule/SG, nên không thêm được rule cổng 80.
#   certificate_arn != null -> HTTPS (đích cuối, cần tên miền + ACM, A16)
#   certificate_arn == null -> HTTP trên cổng 443, tạm thời khi chưa có tên miền.
#     Đoạn CloudFront -> ALB khi đó KHÔNG mã hóa, kể cả header X-Origin-Verify.

locals {
  https = var.certificate_arn != null
}

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnet_ids
  security_groups    = [var.security_group_id]

  idle_timeout               = var.idle_timeout
  drop_invalid_header_fields = true
  enable_deletion_protection = false
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api"
  vpc_id      = var.vpc_id
  target_type = "ip"
  protocol    = "HTTP"
  port        = var.backend_port

  deregistration_delay = var.deregistration_delay

  health_check {
    path                = var.health_check_path
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = local.https ? "HTTPS" : "HTTP"
  certificate_arn   = var.certificate_arn
  ssl_policy        = local.https ? "ELBSecurityPolicy-TLS13-1-2-2021-06" : null

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

resource "aws_lb_listener_rule" "origin_verify" {
  listener_arn = aws_lb_listener.main.arn
  priority     = 1

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [var.origin_verify_value]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ---------------------------------------------------------------------------
# Alarm — chỉ tạo khi có topic nhận cảnh báo.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-alb-unhealthy-targets"
  alarm_description   = "Có task backend không qua health check trong 5 phút"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = aws_lb_target_group.api.arn_suffix }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "target_5xx" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-alb-target-5xx"
  alarm_description   = "Backend trả trên 10 lỗi 5xx mỗi phút, 3 phút liên tiếp"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "response_time_p95" {
  count = var.alarm_topic_arn == null ? 0 : 1

  alarm_name          = "${var.project_name}-alb-response-time-p95"
  alarm_description   = "p95 thời gian phản hồi backend > 3 giây trong 5 phút"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  extended_statistic  = "p95"
  period              = 60
  evaluation_periods  = 5
  threshold           = 3
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}
