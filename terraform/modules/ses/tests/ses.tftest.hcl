# Test OFFLINE module ses — `terraform test`, không cần AWS, không tốn tiền.

mock_provider "aws" {
  override_resource {
    target = aws_sesv2_email_identity.domain
    values = {
      arn = "arn:aws:ses:ap-southeast-1:123456789012:identity/learninglab.example"
      # Khối có trong config: mock áp giá trị cho từng phần tử, nên truyền object.
      dkim_signing_attributes = {
        tokens = ["tok1", "tok2", "tok3"]
      }
    }
  }
}

variables {
  domain_name = "learninglab.example"
  zone_id     = "Z0123456789ABCDEFGHIJ"
}

run "domain_identity_with_dkim_records" {
  command = apply

  assert {
    condition     = length(aws_route53_record.dkim) == 3
    error_message = "Easy DKIM cần đúng 3 bản ghi CNAME."
  }

  assert {
    condition     = aws_route53_record.dkim[0].name == "tok1._domainkey.learninglab.example" && aws_route53_record.dkim[0].records == toset(["tok1.dkim.amazonses.com"])
    error_message = "Bản ghi DKIM phải đúng định dạng <token>._domainkey.<domain> -> <token>.dkim.amazonses.com."
  }
}

run "manual_dns_without_zone" {
  command   = apply
  state_key = "manual"

  variables {
    create_dkim_records = false
    zone_id             = null
  }

  assert {
    condition     = length(aws_route53_record.dkim) == 0 && length(output.dkim_records) == 3
    error_message = "Không có zone thì không tạo bản ghi, chỉ xuất 3 bản ghi để thêm tay."
  }
}

run "dkim_records_need_zone" {
  command = plan

  variables {
    zone_id = null
  }

  expect_failures = [var.zone_id]
}
