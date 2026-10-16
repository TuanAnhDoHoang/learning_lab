# Kênh cảnh báo vận hành — Ke_Hoach_Ha_Tang.md Mục 4.12.
# Chi phí: $0 (1.000 email/tháng đầu miễn phí).
#
# Không có SNS thì CloudWatch Alarm chỉ đổi trạng thái trong Console, không ai biết.
# Alarm của 20-runtime đặt alarm_actions = [output alerts_topic_arn].
#
# Cố ý KHÔNG bật mã hóa SNS (SSE): khóa AWS-managed aws/sns không cho CloudWatch và
# Budgets publish vào topic; muốn mã hóa phải dùng KMS customer-managed key — đã loại
# (Mục 3.2). Nội dung cảnh báo không chứa dữ liệu nhạy cảm.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

# Email subscription ở trạng thái PendingConfirmation cho tới khi người nhận bấm xác nhận.
resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alert_emails)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# Policy của topic: chủ account quản lý; CloudWatch và Budgets chỉ được Publish,
# và chỉ khi yêu cầu đến từ chính account này (chống account khác đẩy tin vào).
data "aws_iam_policy_document" "alerts_topic" {
  statement {
    sid    = "AccountOwnerManage"
    effect = "Allow"
    actions = [
      "sns:GetTopicAttributes",
      "sns:SetTopicAttributes",
      "sns:Subscribe",
      "sns:ListSubscriptionsByTopic",
      "sns:Publish",
    ]
    resources = [aws_sns_topic.alerts.arn]

    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid       = "ServicesPublishFromThisAccount"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]

    principals {
      type = "Service"
      identifiers = concat(
        ["cloudwatch.amazonaws.com"],
        var.allow_budgets_publish ? ["budgets.amazonaws.com"] : [],
      )
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  # Từ chối mọi yêu cầu không đi qua TLS.
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts_topic.json
}
