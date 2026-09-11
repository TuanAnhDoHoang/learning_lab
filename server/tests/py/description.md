# Đặc tả hệ thống: Chấm bài trắc nghiệm bằng AI (1 câu hỏi – 4 đáp án)

## 1. Mục tiêu

Xây dựng module chấm điểm tự động cho câu hỏi trắc nghiệm dạng:
- 1 câu hỏi
- 4 lựa chọn: A, B, C, D
- Có thể kèm tài liệu tham khảo (PDF/DOCX/TXT) do người dùng cung cấp

Yêu cầu bắt buộc:
- Model sử dụng: **Gemini 3.6 Flash** (model ID: `gemini-3.6-flash`)
- AI phải chấm dựa trên tài liệu được cung cấp (RAG)
- AI có thể search internet để bổ sung khi tài liệu không đủ căn cứ
- AI phải tránh ảo tưởng (hallucination) — không được suy luận ngoài căn cứ đã có
- Phải có guardrail độc lập kiểm định lại kết quả trước khi trả về

---

## 2. Kiến trúc tổng quan (pipeline)

```
Input: câu hỏi + 4 đáp án (A/B/C/D) + tài liệu tham khảo (optional)
        │
        ▼
[Bước 1] Retrieval nội bộ (RAG trên tài liệu người dùng gửi)
        │  → trích top-k đoạn liên quan nhất
        ▼
[Bước 2] Nếu độ liên quan thấp / model báo thiếu căn cứ
        │  → Không có trong tài liệu 
        ▼
[Bước 3] Gọi Gemini 3.6 Flash với prompt "grounded" + structured output
        │  (đáp án đúng, trích dẫn, lý do, độ tin cậy)
        ▼
[Bước 4] Guardrail layer — kiểm định độc lập trước khi trả kết quả
        │  (schema check, citation-match check, self-consistency,
        │   LLM-as-judge verify, ngưỡng confidence)
        ▼
Output: đáp án đúng + giải thích + nguồn trích dẫn + confidence score
        (hoặc "insufficient_evidence" → chuyển giáo viên review thủ công)
```

---

## 3. Bước 1 — RAG trên tài liệu người dùng

- Chunk tài liệu theo đoạn/mục, khoảng 300–500 token/chunk, overlap ~50 token.
- Tạo embedding cho các chunk (dùng Gemini embedding API, hoặc dùng tính năng **file search tool** có sẵn của `gemini-3.6-flash` để không cần tự build vector DB khi số tài liệu nhỏ).
- Truy vấn: lấy top 3–5 chunk liên quan nhất tới (câu hỏi + 4 đáp án) làm context.
- Lưu lại chunk nào được chọn để phục vụ audit log ở bước 4.

---

## 4. Bước 2 — Khi nào coi là không tìm thấy trong tài liệu

Không bật **Google Search grounding** trong hệ thống này.

Nếu retrieval nội bộ không tìm thấy đoạn nào đủ liên quan, hoặc model báo `insufficient_evidence = true` dựa trên tài liệu hiện có, thì hệ thống phải trả về trạng thái:
- `needs_human_review`, hoặc
- `Không tìm thấy căn cứ đủ trong tài liệu`

Quy tắc này nhằm:
- tránh phụ thuộc vào web search ngoài phạm vi kiểm soát
- tránh ảo tưởng khi tài liệu không đủ căn cứ
- yêu cầu người review hoặc giáo viên xác nhận thủ công khi không có bằng chứng rõ ràng

Trong mọi trường hợp không tìm thấy căn cứ phù hợp trong tài liệu, không gây suy luận hoặc đoán mò từ kiến thức bên ngoài.

---

## 5. Bước 3 — Prompt design & structured output

### 5.1 Nguyên tắc prompt (system instruction)

- Chỉ được trả lời dựa trên NGỮ CẢNH được cung cấp (tài liệu retrieval + kết quả search nếu có).
- Không được suy luận từ kiến thức nền ngoài ngữ cảnh.
- Nếu ngữ cảnh không đủ để xác định chắc chắn đáp án đúng, phải trả `insufficient_evidence = true` và **không được đoán**.
- Mọi đáp án phải kèm trích dẫn cụ thể (nguyên văn ngắn, tối đa 1 câu) lấy từ ngữ cảnh, không được bịa trích dẫn.
- Chỉ được chọn 1 trong 4 giá trị: A, B, C, D.

### 5.2 System prompt mẫu

```
Bạn là giám khảo chấm trắc nghiệm. Chỉ dựa vào NGỮ CẢNH được cung cấp bên dưới
để xác định đáp án đúng trong 4 lựa chọn A/B/C/D. Không được suy luận từ kiến
thức nền ngoài ngữ cảnh. Nếu ngữ cảnh không đủ để xác định chắc chắn, đặt
insufficient_evidence = true và không đoán. Mọi câu trả lời phải kèm trích dẫn
cụ thể (nguyên văn ngắn, tối đa 1 câu) từ ngữ cảnh, ghi rõ nguồn.
```

### 5.3 JSON schema bắt buộc cho output

```json
{
  "type": "object",
  "properties": {
    "correct_option": { "type": "string", "enum": ["A", "B", "C", "D"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "evidence_quote": { "type": "string" },
    "evidence_source": { "type": "string" },
    "reasoning": { "type": "string" },
    "insufficient_evidence": { "type": "boolean" }
  },
  "required": [
    "correct_option",
    "confidence",
    "evidence_source",
    "insufficient_evidence"
  ]
}
```

### 5.4 Gợi ý cấu hình gọi API

- Model: `gemini-3.6-flash`
- Bật `response_schema` theo JSON schema ở mục 5.3 (structured output)
- Bật tool `google_search` (grounding) chỉ khi cần theo điều kiện ở Bước 2
- Bật tool `file_search` cho retrieval nội bộ (nếu dùng thay vì tự build vector DB)
- Thinking level: mức trung bình (đủ để giảm sai sót suy luận, không cần cao vì tác vụ đơn giản)
- Temperature: thấp (khuyến nghị 0–0.2) để tăng tính nhất quán

---

## 6. Bước 4 — Guardrail layer (bắt buộc, độc lập với model chấm)

Lớp này chạy **sau** khi nhận output từ model, trước khi trả kết quả cuối cho người dùng.

1. **Schema validation**
   - Output phải đúng JSON schema ở mục 5.3
   - `correct_option` phải là một trong 4 giá trị A/B/C/D đã cho trong câu hỏi gốc
   - Reject / retry nếu sai định dạng

2. **Citation-grounding check**
   - Kiểm tra `evidence_quote` có thực sự xuất hiện (khớp gần đúng, dùng string/embedding similarity) trong tài liệu retrieval hoặc kết quả search đã cung cấp cho model
   - Nếu không khớp → nghi ngờ ảo tưởng → tự động hạ `confidence` hoặc reject, chuyển review thủ công

3. **Self-consistency check**
   - Gọi model 2–3 lần với temperature thấp cho cùng input
   - So sánh `correct_option` giữa các lần gọi
   - Nếu không đồng nhất → đánh dấu `low_confidence`, không tự động chấm

4. **LLM-as-judge (verify độc lập)**
   - Lượt gọi thứ 2 với prompt khác: đưa model kết quả của lượt 1 (đáp án + trích dẫn) và yêu cầu xác minh lại tính hợp lý dựa trên cùng ngữ cảnh
   - Chỉ chấp nhận kết quả khi cả "grader" và "verifier" đồng thuận

5. **Ngưỡng confidence**
   - Nếu `confidence < 0.7` HOẶC `insufficient_evidence = true` HOẶC không qua được check 2–4
   - → Không tự động chấm điểm, đưa vào hàng đợi để giáo viên/người review xác nhận thủ công

6. **Giới hạn phạm vi trả lời**
   - Model không được tạo thêm lựa chọn ngoài 4 đáp án đã cho
   - Model không được thêm dữ kiện/giả định không có trong câu hỏi hoặc ngữ cảnh

---

## 7. Logging & audit

Với mỗi lần chấm, cần lưu lại:
- Câu hỏi + 4 đáp án gốc
- Danh sách chunk tài liệu đã dùng làm context (id, nội dung, similarity score)
- Có bật web search hay không, và nếu có: các URL nguồn được model dùng
- Output đầy đủ từ model (JSON structured output)
- Kết quả các bước guardrail (pass/fail từng bước, lý do reject nếu có)
- Trạng thái cuối: `auto_graded` / `needs_human_review`

Mục đích: phục vụ audit khi có tranh chấp kết quả chấm, và để fine-tune ngưỡng confidence sau này.

---

## 8. Output cuối cùng trả về người dùng

```json
{
  "correct_option": "B",
  "confidence": 0.92,
  "evidence_quote": "...",
  "evidence_source": "tailieu.pdf, trang 4",
  "reasoning": "...",
  "insufficient_evidence": false,
  "status": "auto_graded"
}
```

Nếu không đạt guardrail:

```json
{
  "status": "needs_human_review",
  "reason": "confidence thấp / citation không khớp / kết quả không nhất quán giữa các lần gọi"
}
```

---

## 9. Tóm tắt yêu cầu kỹ thuật cho agent code

- [ ] Module chunking + retrieval tài liệu (hoặc dùng file search tool của Gemini)
- [ ] Module điều kiện bật/tắt web search grounding
- [ ] Module gọi Gemini 3.6 Flash với structured output theo schema mục 5.3
- [ ] Module guardrail: schema validation, citation-match check, self-consistency (2–3 lần gọi), LLM-as-judge verify
- [ ] Module logging/audit theo mục 7
- [ ] Ngưỡng confidence có thể cấu hình được (config, không hardcode)
- [ ] Hàng đợi review thủ công cho các case `needs_human_review`