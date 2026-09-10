use anyhow::{Context, anyhow};
use regex::Regex;


#[tokio::test]
async fn test_ocr(){
	// This test ports the functionality of OCRT.py to Rust:
	// - Reads an image file, base64-encodes it
	// - Sends a request to the Google Gemini "generateContent" endpoint
	// - Prints the extracted text from the response

	use reqwest::Client;
	use serde_json::json;
	use std::fs;
	use std::env;

	// Prompt copied from OCRT.py: ask Gemini to return only the plain text of the exam
	const PROMPT: &str = r#"Hãy trích xuất chính xác toàn bộ nội dung đề thi trong ảnh này thành văn bản thuần (plain text).

Yêu cầu:
- Giữ nguyên số thứ tự câu hỏi và các phương án A/B/C/D.
- KHÔNG đánh dấu hay ghi chú đáp án nào đã được khoanh/tô trong ảnh (chỉ lấy nội dung câu hỏi và các phương án, bỏ qua việc khoanh tay).
- KHÔNG bao gồm thông tin cá nhân như họ tên thí sinh, số báo danh, mã đề (nếu có), các thông tin khác câu hỏi và đáp án 
- Giữ đúng chính tả và dấu tiếng Việt.
- Không thêm bất kỳ bình luận, giải thích, hay ký hiệu markdown nào khác ngoài nội dung đề thi.
"#;

	// Allow overriding via env var (recommended): GEMINI_API_KEY
	let api_key = env::var("GEMINI_API_KEY").unwrap();
	let model = "gemini-3.6-flash";
	let api_url = format!(
		"https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
		model
	);

	// Image path used in the original run; change if needed.
	let image_path = "History_Exam.jpg";

	let data = fs::read(image_path).expect("failed to read image file");
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
	let resp = client
		.post(&api_url)
		.header("Content-Type", "application/json")
		.header("x-goog-api-key", api_key)
		.json(&payload)
		.send()
		.await
		.expect("request failed");

	let status = resp.status();
	let text = resp.text().await.expect("failed to read response text");
	if !status.is_success() {
		eprintln!("Gemini API returned error (status: {}):\n{}", status, text);
		panic!("API error");
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

	// println!("Extracted OCR text:\n{}", extracted);
}

#[derive(Debug)]
struct QuestionAnwers {
    question: String,
    answers: Vec<String>,
}

fn result_analyzer(extracted: &str) -> anyhow::Result<Vec<QuestionAnwers>>{ 
    let mut result = Vec::new();
    // Regex crate của Rust KHÔNG hỗ trợ lookahead (khác Python), nên thay vì
    // split bằng lookahead, ta tìm VỊ TRÍ (offset) của từng mốc "Câu N."
    // rồi tự cắt chuỗi (slice) giữa các mốc đó.
    let question_marker = Regex::new(r"Câu\s+\d+\.")?;
 
    // (?m) bật chế độ multi-line để ^ khớp đầu MỖI DÒNG, không chỉ đầu chuỗi.
    // Nhờ vậy "(1930)" hay "8 (1941)" nằm giữa dòng không bị nhầm là đáp án,
    // vì A-D ở đây bắt buộc phải đứng ở đầu dòng thì mới khớp.
    let answer_marker = Regex::new(r"(?m)^([A-D])\.\s*")?;
 
    let starts: Vec<usize> = question_marker
        .find_iter(extracted)
        .map(|m| m.start())
        .collect();
 
    if starts.is_empty() {
        return Err(anyhow!("Không tìm thấy câu hỏi nào trong văn bản đầu vào"));
    }
 
    for (i, &start) in starts.iter().enumerate() {
        // Mỗi block là đoạn văn bản từ mốc "Câu N." hiện tại đến ngay trước
        // mốc "Câu N." kế tiếp (hoặc đến hết chuỗi nếu là câu cuối cùng)
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


#[tokio::test]
async fn test_analyzer() -> anyhow::Result<()>{
    let extracted = r"
 Câu 1. Thắng lợi của cuộc Tiến công chiến lược năm 1972 của quân và dân Việt Nam có ý nghĩa nào sau đây?
A. Buộc Mỹ phải xuống thang chiến tranh, lập tức rút hết quân về nước.
B. Kết thúc cuộc cách mạng dân tộc dân chủ nhân dân ở miền Nam Việt Nam.
C. Giáng đòn quyết định làm sụp đổ hoàn toàn chính quyền Sài Gòn.
D. Buộc Mỹ phải thừa nhận sự thất bại của chiến lược “Việt Nam hóa chiến tranh”.
Câu 2. Phan Bội Châu có hoạt động đối ngoại nào sau đây vào đầu thế kỉ XX?
A. Đàm phán với Pháp để thực hiện cải cách cho Việt Nam.
B. Liên hệ với lực lượng Đồng minh chống phát xít.
C. Tham dự Đại hội lần thứ XVIII của Đảng Xã hội Pháp.
D. Vận động sự ủng hộ của Nhật Bản để giải phóng dân tộc.
Câu 3. Nhận định nào sau đây là đúng về công cuộc Đổi mới ở Việt Nam từ năm 1986 đến nay?
A. Diễn ra đồng bộ và sâu rộng nhưng độc lập trên các lĩnh vực kinh tế – xã hội.
B. Là sự thay đổi hình thức, bước đi và biện pháp để thực hiện mục tiêu xã hội chủ nghĩa.
C. Có sự điều hành trực tiếp của nhà nước vào những quy trình sản xuất của các doanh nghiệp.
D. Hạn chế sự phát triển của kinh tế tư nhân để tập trung phát triển kinh tế nhà nước.
Câu 4. Các nước ASEAN đã kí kết văn kiện nào sau đây vào năm 2003?
A. Tuyên ngôn Quốc tế Nhân quyền.
B. Tuyên bố Ba-li II.
C. Hiến chương Liên hợp quốc.
D. Hiến chương ASEAN.
Câu 5. Tổ chức nào sau đây được thành lập để củng cố sức mạnh khối đại đoàn kết toàn dân tộc Việt Nam vào năm 1951?
A. Hội Chân Hoa Hưng Á.
B. Việt Nam Quang phục Hội.
C. Mặt trận Liên Việt.
D. Hội Liên hiệp thuộc địa.
Câu 6. Liên hợp quốc có hoạt động nào sau đây để bảo đảm quyền con người?
A. Xây dựng và kí kết các văn bản, điều ước quốc tế về quyền con người.
B. Can thiệp trực tiếp vào các nước nhằm thi hành triệt để quyền con người.
C. Thành lập khối phòng thủ chung dựa trên cơ sở đồng thuận.
D. Xây dựng thể chế chính trị thống nhất cho các quốc gia.
Câu 7. So với Hội nghị thành lập Đảng Cộng sản Việt Nam (1930), Hội nghị Ban Chấp hành Trung ương Đảng Cộng sản Đông Dương lần thứ 8 (1941) có điểm mới nào sau đây?
A. Góp phần định hướng, thúc đẩy sự phát triển của phong trào giải phóng dân tộc ở Việt Nam.
B. Chủ trương giải quyết vấn đề dân tộc cho phù hợp với điều kiện lịch sử cụ thể của Việt Nam.
C. Diễn ra trong bối cảnh cách mạng Việt Nam đã có sự lãnh đạo thống nhất của một chính đảng cộng sản.
D. Thể hiện vai trò của Nguyễn Ái Quốc trong việc hoạch định đường lối chiến lược cách mạng Việt Nam.
Câu 8. Một trong những xu thế phát triển chính của thế giới sau cuộc Chiến tranh lạnh là
A. hạn chế liên kết về kinh tế giữa tất cả các nước.
B. đối thoại và hợp tác trong quan hệ quốc tế.
C. chấm dứt ngay mọi xung đột giữa các nước.
D. đối đầu giữa Liên Xô và Mỹ.   
    ";
    let result = result_analyzer(extracted).context("Error during analyzing extracted text")?;
    for r in result{
        println!("{:?}", r);
    }
    Ok(())
}