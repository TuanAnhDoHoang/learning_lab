use serde_json::json;
use serde_json::Value;
use reqwest::Client;
use super::send_json;

pub async fn register_user(client: &Client, email: &str, username: &str, password: &str) -> Value {
    send_json(
        "POST /auth/register",
        client,
        reqwest::Method::POST,
        "/auth/register",
        Some(json!({"email": email, "username": username, "password": password})),
        None,
    )
    .await
}

pub async fn login_user(client: &Client, email: &str, password: &str) -> Value {
    send_json(
        "POST /auth/login",
        client,
        reqwest::Method::POST,
        "/auth/login",
        Some(json!({ "email": email, "password": password })),
        None,
    )
    .await
}

#[allow(dead_code)]
pub async fn register_multiple_users(
    client: &Client,
    base: &str,
    count: usize,
    password: &str,
) -> Vec<(String, String)> {
    let mut results = Vec::new();
    let t = super::now_millis();
    for i in 1..=count {
        let email = format!("{}_user{}_{}@example.com", base, i, t);
        let username = format!("{}_{}", base, i);
        let _ = register_user(client, &email, &username, password).await;
        let login = login_user(client, &email, password).await;
        let token = login["access_token"].as_str().unwrap().to_string();
        results.push((email, token));
    }
    results
}

#[allow(dead_code)]
pub async fn refresh_token(client: &Client, refresh_token: &str) -> Value {
    send_json(
        "POST /auth/refresh",
        client,
        reqwest::Method::POST,
        "/auth/refresh",
        Some(json!({ "refresh_token": refresh_token })),
        None,
    )
    .await
}

#[allow(dead_code)]
pub async fn logout_user(client: &Client, token: &str, refresh_token: &str) -> Value {
    send_json(
        "POST /auth/logout",
        client,
        reqwest::Method::POST,
        "/auth/logout",
        Some(json!({ "refresh_token": refresh_token })),
        Some(token),
    )
    .await
}
