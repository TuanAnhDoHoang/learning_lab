use serde_json::json;
use serde_json::Value;
use reqwest::Client;
use diesel::Connection;
use super::{send_json, get_db_url, RoomCodeRow};

pub async fn create_room(client: &Client, token: &str, name: &str, exam_id: i32, duration: i32) -> Value {
    send_json(
        "POST /api/create_room",
        client,
        reqwest::Method::POST,
        "/api/create_room",
        Some(json!({ "name": name, "exam_id": exam_id, "duration": duration })),
        Some(token),
    )
    .await
}

pub async fn start_room(client: &Client, token: &str, room_id: i32) -> Value {
    send_json(
        "POST /api/start_room",
        client,
        reqwest::Method::POST,
        "/api/start_room",
        Some(json!({ "room_id": room_id })),
        Some(token),
    )
    .await
}

pub async fn close_room(client: &Client, token: &str, room_id: i32) -> Value {
    send_json(
        "POST /api/close_room",
        client,
        reqwest::Method::POST,
        "/api/close_room",
        Some(json!({ "room_id": room_id })),
        Some(token),
    )
    .await
}

pub async fn join_room(client: &Client, token: &str, room_code: &str) -> Value {
    send_json(
        "POST /api/join_room",
        client,
        reqwest::Method::POST,
        "/api/join_room",
        Some(json!({ "room_code": room_code })),
        Some(token),
    )
    .await
}

pub async fn start_exam_attempt_by_room(client: &Client, token: &str, room_id: i32) -> Value {
    send_json(
        "POST /api/start_exam_attempt_by_room",
        client,
        reqwest::Method::POST,
        "/api/start_exam_attempt_by_room",
        Some(json!({ "room_id": room_id })),
        Some(token),
    )
    .await
}

pub async fn leave_room(client: &Client, token: &str, room_code: &str) -> Value {
    send_json(
        "POST /api/leave_room",
        client,
        reqwest::Method::POST,
        "/api/leave_room",
        Some(json!({ "room_code": room_code })),
        Some(token),
    )
    .await
}

pub async fn room_scores(client: &Client, token: &str, room_id: i32) -> Value {
    send_json(
        "POST /api/room_scores",
        client,
        reqwest::Method::POST,
        "/api/room_scores",
        Some(json!({ "room_id": room_id })),
        Some(token),
    )
    .await
}

pub async fn room_member_score(client: &Client, token: &str, room_id: i32, user_id: i32) -> Value {
    send_json(
        "POST /api/room_member_score",
        client,
        reqwest::Method::POST,
        "/api/room_member_score",
        Some(json!({ "room_id": room_id, "user_id": user_id })),
        Some(token),
    )
    .await
}

pub async fn my_room_score(client: &Client, token: &str, room_id: i32) -> Value {
    send_json(
        "POST /api/my_room_score",
        client,
        reqwest::Method::POST,
        "/api/my_room_score",
        Some(json!({ "room_id": room_id })),
        Some(token),
    )
    .await
}

pub async fn get_rooms_by_user(client: &Client, token: &str) -> Value {
    send_json(
        "GET /api/room_by_user",
        client,
        reqwest::Method::GET,
        "/api/room_by_user",
        None,
        Some(token),
    )
    .await
}

pub async fn delete_room(client: &Client, token: &str, room_id: i32) -> Value {
    send_json(
        "POST /api/delete_room",
        client,
        reqwest::Method::POST,
        "/api/delete_room",
        Some(json!({ "room_id": room_id })),
        Some(token),
    )
    .await
}
