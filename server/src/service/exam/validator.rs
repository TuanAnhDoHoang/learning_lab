use super::types::CreateExamByImageRequest;

/// Validates the payload passed to the image-based exam creation flow.
///
/// # Returns
/// - `Ok(())` if the payload contains a valid exam name, domain, duration and answer list.
/// - `Err(String)` if any required field is missing or invalid.
pub fn validate_exam_payload(payload: &CreateExamByImageRequest) -> Result<(), String> {
    if payload.exam_name.trim().is_empty() {
        return Err("exam_name is required".to_string());
    }

    if payload.domain.trim().is_empty() {
        return Err("domain is required".to_string());
    }

    if payload.duration <= 0 {
        return Err("duration must be greater than 0".to_string());
    }

    Ok(())
}

/// Validates the selected correct answer index for a parsed question.
///
/// # Arguments
/// - `right_index`: the selected correct answer index from the request payload.
/// - `answer_count`: number of answer options generated for that question.
///
/// # Returns
/// - `Ok(())` when the index is within the valid range.
/// - `Err(String)` when the index points outside the answer list.
pub fn validate_answer_index(right_index: usize, answer_count: usize) -> Result<(), String> {
    if right_index >= answer_count {
        return Err("Chỉ số câu trả lời đúng (right_answer) không hợp lệ!".to_string());
    }

    Ok(())
}

/// Ensures the number of correct-answer selections matches the number of parsed questions.
///
/// # Arguments
/// - `submitted_count`: the number of correct-answer entries coming from the client.
/// - `question_count`: the number of questions parsed from the uploaded image.
///
/// # Returns
/// - `Ok(())` when the counts match.
/// - `Err(String)` when the client provides a mismatch.
pub fn validate_answer_count(submitted_count: usize, question_count: usize) -> Result<(), String> {
    if submitted_count != question_count {
        return Err(format!(
            "Số lượng câu trả lời đúng ({}) không khớp với số lượng câu hỏi ({}).",
            submitted_count, question_count
        ));
    }

    Ok(())
}
