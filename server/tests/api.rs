use reqwest::Client;
mod helpers;
use helpers::TestServer;
use helpers::{auth, exam, room};

use crate::helpers::auth::register_user;

#[derive(serde::Deserialize)]
struct AnswerResponse {
    id: i32,
    question_id: i32,
    content: String,
}

#[derive(serde::Deserialize)]
struct QuestionResponse {
    id: i32,
    exam_id: i32,
    content: String,
}

#[derive(serde::Deserialize)]
struct QuestionInExamContent {
    question: QuestionResponse,
    answers: Vec<AnswerResponse>,
}

#[derive(serde::Deserialize)]
struct ExamContentResponse {
    exam_id: i32,
    questions: Vec<QuestionInExamContent>,
}

#[derive(serde::Deserialize)]
struct StartExamAttemptResponse {
    exam_attempt_id: i32,
    exam_content: ExamContentResponse,
}

#[tokio::test]
async fn all_routes_true_logic_test() {
    let _server = TestServer::start().await;
    let client = Client::new();

    println!("\n[INFO] Starting full route validation test");

    let admin_email = "anhdoo@gmail.com";
    let admin_password = "Anhdoo#1004";

    let admin_login = auth::login_user(&client, admin_email, admin_password).await;
    let admin_token = admin_login["access_token"].as_str().unwrap().to_string();

    // create and login 3 test clients with fixed emails/usernames, then join the room
    let user1_email = "user1@gmail.com".to_string();
    let user2_email = "user2@gmail.com".to_string();
    let user3_email = "user3@gmail.com".to_string();

    // let _ = register_user(&client, &user1_email, "user1", "Pass#1234").await;
    let login1 = auth::login_user(&client, &user1_email, "Pass#1234").await;
    let token1 = login1["access_token"].as_str().unwrap().to_string();

    // let _ = register_user(&client, &user2_email, "user2", "Pass#1234").await;
    let login2 = auth::login_user(&client, &user2_email, "Pass#1234").await;
    let token2 = login2["access_token"].as_str().unwrap().to_string();

    // let _ = register_user(&client, &user3_email, "user3", "Pass#1234").await;
    let login3 = auth::login_user(&client, &user3_email, "Pass#1234").await;
    let token3 = login3["access_token"].as_str().unwrap().to_string();

    let exam = exam::create_exam(
        &client,
        &admin_token,
        "Route Test Exam",
        "Lập trình Backend",
    )
    .await;
    let exam_id = exam["exam_id"].as_i64().unwrap() as i32;

    let room = room::create_room(&client, &admin_token, "Toan 11C2", exam_id, 15).await;
    let room_id = room["room_id"].as_i64().unwrap() as i32;

    // Start room (optional) and have multiple clients join
    let room_code = room["room_code"].as_str().unwrap().to_string();

    let _ = room::join_room(&client, &token1, &room_code).await;
    let _ = room::join_room(&client, &token2, &room_code).await;
    let _ = room::join_room(&client, &token3, &room_code).await;

    let _ = room::start_room(&client, &admin_token, room_id).await;

    // start an exam attempt for user1 in the room
    let attempt_result1 = room::start_exam_attempt_by_room(&client, &token1, room_id).await;
    let attempt_result2 = room::start_exam_attempt_by_room(&client, &token2, room_id).await;
    let attempt_result3 = room::start_exam_attempt_by_room(&client, &token3, room_id).await;

    // verify rooms by user for one of them
    let _ = room::get_rooms_by_user(&client, &token1).await;

    let attempt_result1: StartExamAttemptResponse =
        serde_json::from_value(attempt_result1).unwrap();
    let exam_attempt_id1 = attempt_result1.exam_attempt_id;
    let exam_content = &attempt_result1.exam_content;

    let first_question = exam_content
        .questions
        .first()
        .expect("exam should contain at least one question");
    let question_id_1 = first_question.question.id;
    let answer_id_1 = first_question.answers[1].id;

    let second_question = exam_content
        .questions
        .get(1)
        .expect("exam should contain at least two questions");
    let question_id_2 = second_question.question.id;
    let answer_id_2 = second_question.answers[3].id;

    exam::save_user_answer(
        &client,
        &token1,
        exam_attempt_id1,
        question_id_1,
        answer_id_1,
    )
    .await;
    exam::save_user_answer(
        &client,
        &token1,
        exam_attempt_id1,
        question_id_2,
        answer_id_2,
    )
    .await;

    let _ = room::close_room(&client, &admin_token, room_id).await;

    // check room scores APIs
    let all_scores = room::room_scores(&client, &admin_token, room_id).await;
    // if there are members, pick first user_id and check member-specific API
    if all_scores.is_array() && !all_scores.as_array().unwrap().is_empty() {
        let first = &all_scores.as_array().unwrap()[0];
        if let Some(uid) = first.get("user_id").and_then(|v| v.as_i64()) {
            let _ = room::room_member_score(&client, &admin_token, room_id, uid as i32).await;
        }
    }

    // check my_room_score for one of the joined users
    let _ = room::my_room_score(&client, &token1, room_id).await;

    // cleanup: leave and delete
    // let _ = room::leave_room(&client, &token1, &room_code).await;
    // let _ = room::leave_room(&client, &token2, &room_code).await;
    // let _ = room::leave_room(&client, &token3, &room_code).await;
    let _ = room::delete_room(&client, &admin_token, room_id).await;

    println!("\n[INFO] All route validation helpers completed successfully.");
}

#[tokio::test]
#[ignore]
async fn create_exam_by_image_route_test() {
    let _server = TestServer::start().await;
    let client = Client::new();

    // login admin
    let admin_login =
        auth::login_user(&client, helpers::ADMIN_EMAIL, helpers::ADMIN_PASSWORD).await;
    let admin_token = admin_login["access_token"].as_str().unwrap().to_string();

    // use real test image from repository root
    let img_bytes =
        std::fs::read("History_Exam.jpg").expect("failed to read test image History_Exam.jpg");

    let payload = serde_json::json!({
        "exam_name": "Image Exam",
        "domain": "Test Domain",
        "answers": [1,0,1,3,2,1,2,0],
        "duration": 10
    });

    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(img_bytes)
                .file_name("test.jpg")
                .mime_str("image/jpeg")
                .unwrap(),
        )
        .part(
            "payload",
            reqwest::multipart::Part::text(payload.to_string())
                .mime_str("application/json")
                .unwrap(),
        );

    let resp = client
        .post(format!("{}/api/new_exam_by_image", helpers::BASE_URL))
        .header("Authorization", format!("Bearer {}", admin_token))
        .multipart(form)
        .send()
        .await
        .expect("request failed");

    // this test is ignored by default because it may call external services
    // assert we got a response (success or client error depending on env)
    if resp.status().is_success() {
        println!("[PASS] POST /api/new_exam_by_image -> success")
    } else {
        println!("[ERROR] POST /api/new_exam_by_image -> fail")
    }
}
