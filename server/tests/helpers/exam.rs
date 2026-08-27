use serde_json::json;
use serde_json::Value;
use reqwest::Client;
use super::send_json;

pub async fn get_exams(client: &Client, token: &str) -> Value {
    send_json(
        "GET /api/exams",
        client,
        reqwest::Method::GET,
        "/api/exams",
        None,
        Some(token),
    )
    .await
}

pub async fn create_exam(client: &Client, token: &str, exam_name: &str, domain: &str) -> Value {
    send_json(
        "POST /api/new_exam",
        client,
        reqwest::Method::POST,
        "/api/new_exam",
        Some(json!({
            "exam_name": exam_name,
            "domain": domain,
            "duration": 20,
            "questions": [
                {"question": "Câu hỏi test 1", "answers": ["A","B","C","D"], "right_answer": 1},
                {"question": "Câu hỏi test 2", "answers": ["AA","BB","CC","DD"], "right_answer": 3}
            ]
        })),
        Some(token),
    )
    .await
}

pub async fn get_questions(client: &Client, token: &str, exam_id: i32) -> Value {
    let path = format!("/api/questions?exam_id={}", exam_id);
    send_json(
        "GET /api/questions",
        client,
        reqwest::Method::GET,
        &path,
        None,
        Some(token),
    )
    .await
}

pub async fn start_exam_attempt(client: &Client, token: &str, exam_id: i32) -> Value {
    send_json(
        "POST /api/start_exam_attempt",
        client,
        reqwest::Method::POST,
        "/api/start_exam_attempt",
        Some(json!({ "exam_id": exam_id })),
        Some(token),
    )
    .await
}

pub async fn get_time_attempt_end(client: &Client, token: &str, exam_attempt_id: i32) -> Value {
    send_json(
        "POST /api/time_attempt_end",
        client,
        reqwest::Method::POST,
        "/api/time_attempt_end",
        Some(json!({ "exam_attempt_id": exam_attempt_id })),
        Some(token),
    )
    .await
}

pub async fn save_user_answer(client: &Client, token: &str, exam_attempt_id: i32, question_id: i32, answer_id: i32) -> Value {
    send_json(
        "POST /api/save_user_answer",
        client,
        reqwest::Method::POST,
        "/api/save_user_answer",
        Some(json!({"exam_attempt_id": exam_attempt_id, "question_id": question_id, "answer_id": answer_id})),
        Some(token),
    )
    .await
}

pub async fn get_attempt(client: &Client, token: &str, exam_attempt_id: i32) -> Value {
    let path = format!("/api/attempt?exam_attempt_id={}", exam_attempt_id);
    send_json(
        "GET /api/attempt",
        client,
        reqwest::Method::GET,
        &path,
        None,
        Some(token),
    )
    .await
}

pub async fn score_attempt(client: &Client, token: &str, exam_attempt_id: i32) -> Value {
    let path = format!("/api/score_attempt?exam_attempt_id={}", exam_attempt_id);
    send_json(
        "GET /api/score_attempt",
        client,
        reqwest::Method::GET,
        &path,
        None,
        Some(token),
    )
    .await
}
