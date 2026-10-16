# Test OFFLINE module waf — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {}

variables {
  project_name = "stem-digitizer"
}

run "rules_match_spec" {
  command = apply

  assert {
    condition     = aws_wafv2_web_acl.main.scope == "CLOUDFRONT"
    error_message = "Web ACL cho CloudFront phải có scope CLOUDFRONT."
  }

  assert {
    condition     = length(aws_wafv2_web_acl.main.rule) == 5
    error_message = "Phải có 3 managed rule group và 2 rate rule."
  }

  assert {
    condition = anytrue([
      for r in aws_wafv2_web_acl.main.rule : r.name == "AWSManagedRulesCommonRuleSet" &&
      one(one(one(r.statement).managed_rule_group_statement).rule_action_override).name == "SizeRestrictions_BODY"
    ])
    error_message = "SizeRestrictions_BODY phải chuyển sang Count để không chặn upload ảnh."
  }

  assert {
    condition = anytrue([
      for r in aws_wafv2_web_acl.main.rule : r.name == "rate-auth" &&
      one(one(r.statement).rate_based_statement).limit == 15 &&
      one(one(r.statement).rate_based_statement).evaluation_window_sec == 60
    ])
    error_message = "/auth/* giới hạn 15 request/phút/IP."
  }

  assert {
    condition = anytrue([
      for r in aws_wafv2_web_acl.main.rule : r.name == "rate-ocr" &&
      one(one(r.statement).rate_based_statement).limit == 10 &&
      one(one(r.statement).rate_based_statement).evaluation_window_sec == 300
    ])
    error_message = "/api/new_exam_by_image giới hạn 10 request/5 phút/IP."
  }
}

run "rejects_rate_below_waf_minimum" {
  command = plan

  variables {
    ocr_rate_limit = 5
  }

  expect_failures = [var.ocr_rate_limit]
}
