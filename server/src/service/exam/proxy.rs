use std::env;

use axum::{
    extract::Multipart,
    http::StatusCode,
    Json,
};
use reqwest::{
    Client,
    multipart::{Form, Part},
};
use serde_json::Value;

use crate::service::question::QuestionRequest;

pub fn normalize_python_question(raw_question: &Value) -> QuestionRequest {
    let question = raw_question
        .get("question")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();

    let options = raw_question
        .get("options")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut answers = Vec::with_capacity(4);
    for option in ["A", "B", "C", "D"] {
        answers.push(
            options
                .get(option)
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        );
    }

    let mut right_answer = 0usize;
    if let Some(correct_value) = raw_question.get("correct_answer") {
        if let Some(correct_letter) = correct_value.as_str() {
            let normalized = correct_letter.trim().to_ascii_uppercase();
            if let Some(index) = ["A", "B", "C", "D"]
                .iter()
                .position(|letter| **letter == normalized)
            {
                right_answer = index;
            }
        } else if let Some(index) = correct_value.as_u64() {
            right_answer = index as usize;
        }
    }

    QuestionRequest {
        question,
        answers,
        right_answer,
    }
}

pub fn normalize_python_questions(raw_questions: &Value) -> Vec<QuestionRequest> {
    raw_questions
        .as_array()
        .unwrap_or(&Vec::new())
        .iter()
        .map(normalize_python_question)
        .collect()
}



#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalize_python_questions_keeps_option_order_and_correct_index() {
        let payload = json!([
            {
                "question": "Câu hỏi mẫu",
                "options": {"A": "Đáp án A", "B": "Đáp án B", "C": "Đáp án C", "D": "Đáp án D"},
                "correct_answer": "B"
            }
        ]);

        let normalized = normalize_python_questions(&payload);
        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0].question, "Câu hỏi mẫu");
        assert_eq!(normalized[0].answers, vec!["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"]);
        assert_eq!(normalized[0].right_answer, 1);
    }

    #[test]
    fn normalize_python_questions_defaults_to_first_option_when_answer_is_missing() {
        let payload = json!([
            {
                "question": "Câu hỏi thiếu đáp án",
                "options": {"A": "A", "B": "B", "C": "C", "D": "D"}
            }
        ]);

        let normalized = normalize_python_questions(&payload);
        assert_eq!(normalized[0].right_answer, 0);
    }
}
