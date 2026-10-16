# Tầng 1 của Auto Scaling — Ke_Hoach_Ha_Tang.md Mục 4.4. Miễn phí.
#
# Giả định A9 / rủi ro R1: nếu WebSocket hub nằm trong bộ nhớ một tiến trình, buổi demo
# có phòng thi trực tiếp nên đặt service_min_count = service_max_count = 1.

resource "aws_appautoscaling_target" "backend" {
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  min_capacity       = var.service_min_count
  max_capacity       = var.service_max_count
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.backend.service_namespace
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  resource_id        = aws_appautoscaling_target.backend.resource_id

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_percent
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Auto Scaling giữ CPU quanh cpu_target_percent; alarm chỉ kêu khi đã chạm trần mà vẫn quá tải.
resource "aws_cloudwatch_metric_alarm" "service" {
  for_each = var.alarm_topic_arn == null ? {} : {
    cpu    = "CPUUtilization"
    memory = "MemoryUtilization"
  }

  alarm_name          = "${local.name}-${each.key}-high"
  alarm_description   = "${each.value} của service > 85% trong 10 phút"
  namespace           = "AWS/ECS"
  metric_name         = each.value
  dimensions          = { ClusterName = aws_ecs_cluster.main.name, ServiceName = aws_ecs_service.backend.name }
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 10
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.alarm_topic_arn]
}
