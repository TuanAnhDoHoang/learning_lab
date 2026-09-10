
use anyhow::Context;
use anyhow::anyhow;
use regex::Regex;
use reqwest::Client;
use serde_json::json;
use std::env;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ParsedQuestion {
    pub question: String,
    pub answers: Vec<String>,
}

pub async fn parse_image(image_path: &Path) -> anyhow::Result<Vec<ParsedQuestion>> {
    const PROMPT: &str = r#"Hãy trích xuất chính xác toàn bộ nội dung đề thi trong ảnh này thành văn bản thuần (plain text).
Yêu cầu:
- Giữ nguyên số thứ tự câu hỏi và các phương án A/B/C/D.
- KHÔNG đánh dấu hay ghi chú đáp án nào đã được khoanh/tô trong ảnh (chỉ lấy nội dung câu hỏi và các phương án, bỏ qua việc khoanh tay).
- KHÔNG bao gồm thông tin cá nhân như họ tên thí sinh, số báo danh, mã đề (nếu có), các thông tin khác câu hỏi và đáp án 
- Giữ đúng chính tả và dấu tiếng Việt.
- Không thêm bất kỳ bình luận, giải thích, hay ký hiệu markdown nào khác ngoài nội dung đề thi.
"#;

    // Allow overriding via env var (recommended): GEMINI_API_KEY
    let api_key = env::var("GEMINI_API_KEY").context("Error during get api key")?;
    let model = env::var("GEMINI_MODEL").context("Error during get model name")?;
    let api_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );


    let data = fs::read(image_path).context("failed to read image file")?;
    let image_b64 = base64::encode(&data);
    let mime_type = "image/jpeg"; // adjust if you use PNG etc.

    let payload = json!({
        "contents": [
            {
                "parts": [
                    { "text": PROMPT },
                    { "inline_data": { "mime_type": mime_type, "data": image_b64 } }
                ]
            }
        ]
    });

    let client = Client::new();
    let body = serde_json::to_string(&payload).context("serialize payload")?;
    let resp = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .header("x-goog-api-key", api_key)
        .body(body)
        .send()
        .await
        .context("request failed")?;

    let status = resp.status();
    let text = resp.text().await.context("failed to read response text")?;
    if !status.is_success() {
        eprintln!("Gemini API returned error (status: {}):\n{}", status, text);
        return Err(anyhow!("API error"));
    }

    // Try to extract the candidate text similar to OCRT.py
    let v: serde_json::Value = serde_json::from_str(&text).expect("invalid JSON response");
    let extracted = v
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.get(0))
        .and_then(|p0| p0.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("(no text found)");

    let result = result_analyzer(extracted).context("Error during analyzing image")?;
    // convert to public ParsedQuestion
    let parsed = result
        .into_iter()
        .map(|qa| ParsedQuestion { question: qa.question, answers: qa.answers })
        .collect();
    Ok(parsed)
}

#[derive(Debug)]
struct QuestionAnwers {
    question: String,
    answers: Vec<String>,
}
fn result_analyzer(extracted: &str) -> anyhow::Result<Vec<QuestionAnwers>> {
    let mut result = Vec::new();
    let question_marker = Regex::new(r"Câu\s+\d+\.")?;

    let answer_marker = Regex::new(r"(?m)^([A-D])\.\s*")?;

    let starts: Vec<usize> = question_marker
        .find_iter(extracted)
        .map(|m| m.start())
        .collect();

    if starts.is_empty() {
        return Err(anyhow!("Không tìm thấy câu hỏi nào trong văn bản đầu vào"));
    }

    for (i, &start) in starts.iter().enumerate() {
        let end = starts.get(i + 1).copied().unwrap_or(extracted.len());
        let block = &extracted[start..end];

        // Tìm vị trí tất cả đáp án A/B/C/D trong block này
        let answer_positions: Vec<(usize, usize)> = answer_marker
            .find_iter(block)
            .map(|m| (m.start(), m.end()))
            .collect();

        if answer_positions.is_empty() {
            // Block không có đáp án nào đi kèm -> có thể là phần header/rác, bỏ qua
            continue;
        }

        // Nội dung câu hỏi: từ ngay sau "Câu N." đến trước đáp án đầu tiên
        let q_marker_end = question_marker.find(block).map(|m| m.end()).unwrap_or(0);
        let question = block[q_marker_end..answer_positions[0].0]
            .trim()
            .replace('\n', " ");

        // Tách nội dung từng đáp án: từ sau nhãn "A."/"B."/... đến trước nhãn kế tiếp
        let mut answers = Vec::new();
        for (idx, &(_, a_end)) in answer_positions.iter().enumerate() {
            let content_end = answer_positions
                .get(idx + 1)
                .map(|&(next_start, _)| next_start)
                .unwrap_or(block.len());
            let answer_text = block[a_end..content_end].trim().replace('\n', " ");
            answers.push(answer_text);
        }

        result.push(QuestionAnwers { question, answers });
    }

    Ok(result)
}
