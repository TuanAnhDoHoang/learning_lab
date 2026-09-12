use serde_json::json;
use serde_json::Value;
use reqwest::Client;
use super::send_json;

#[allow(dead_code)]
pub async fn provide_privileged(client: &Client, token: &str, user_id: i32) -> Value {
    let admin_route = std::env::var("ADMIN_ROUTE").unwrap_or_else(|_| "admin".to_string());
    let path = format!("/{}/provide_priviliged", admin_route);
    send_json(
        "POST /admin/provide_priviliged",
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "user_id": user_id })),
        Some(token),
    )
    .await
}
