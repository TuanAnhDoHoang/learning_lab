# WAF cho CloudFront — Ke_Hoach_Ha_Tang.md Mục 4.7. Scope CLOUDFRONT bắt buộc ở us-east-1
# (stack truyền provider aws.us_east_1 vào làm provider mặc định của module).
# Chi phí ~5 USD/tháng Web ACL + ~1 USD/rule + 0,60 USD/1 triệu request.
#
# Không bật logging: URL WebSocket mang access_token trong query string (R4).

locals {
  managed_rule_groups = [
    { name = "AWSManagedRulesAmazonIpReputationList", priority = 0, count_rules = [] },
    # SizeRestrictions_BODY chặn body > 8 KB => chặn mọi lần upload ảnh. Chuyển sang Count.
    { name = "AWSManagedRulesCommonRuleSet", priority = 1, count_rules = ["SizeRestrictions_BODY"] },
    { name = "AWSManagedRulesKnownBadInputsRuleSet", priority = 2, count_rules = [] },
  ]

  rate_rules = [
    { name = "rate-auth", priority = 10, limit = var.auth_rate_limit, window = 60, uri = "/auth/", match = "STARTS_WITH" },
    { name = "rate-ocr", priority = 11, limit = var.ocr_rate_limit, window = 300, uri = "/api/new_exam_by_image", match = "EXACTLY" },
  ]
}

resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-cloudfront"
  description = "Managed rules + rate limit cho CloudFront"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  dynamic "rule" {
    for_each = local.managed_rule_groups

    content {
      name     = rule.value.name
      priority = rule.value.priority

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.value.name

          dynamic "rule_action_override" {
            for_each = rule.value.count_rules

            content {
              name = rule_action_override.value

              action_to_use {
                count {}
              }
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value.name
        sampled_requests_enabled   = true
      }
    }
  }

  dynamic "rule" {
    for_each = local.rate_rules

    content {
      name     = rule.value.name
      priority = rule.value.priority

      action {
        block {}
      }

      statement {
        rate_based_statement {
          limit                 = rule.value.limit
          evaluation_window_sec = rule.value.window
          aggregate_key_type    = "IP"

          scope_down_statement {
            byte_match_statement {
              search_string         = rule.value.uri
              positional_constraint = rule.value.match

              field_to_match {
                uri_path {}
              }

              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value.name
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-cloudfront"
    sampled_requests_enabled   = true
  }
}
