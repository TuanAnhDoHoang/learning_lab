use std::{process::Child, time::{Duration, SystemTime, UNIX_EPOCH}};

use reqwest::{Client, StatusCode};
use serde_json::Value;

pub const BASE_URL: &str = "http://127.0.0.1:3000";
pub const ADMIN_EMAIL: &str = "anhdoo@gmail.com";
pub const ADMIN_PASSWORD: &str = "Anhdoo#1004";

pub struct TestServer {
    pub child: Child,
}

impl TestServer {
    pub async fn start() -> Self {
        dotenv::dotenv().ok();

        let mut child = std::process::Command::new("./target/debug/server")
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .stdout(std::process::Stdio::inherit())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .expect("failed to start server binary for integration tests");

        let client = Client::new();
        let deadline = std::time::Instant::now() + Duration::from_secs(30);

        while std::time::Instant::now() < deadline {
            match client.get(format!("{}/api/exams", BASE_URL)).send().await {
                Ok(resp) => {
                    if resp.status().is_success() || resp.status() == StatusCode::UNAUTHORIZED {
                        return Self { child };
                    }
                }
                Err(_) => {}
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        let _ = child.kill();
        panic!("server did not start within 30 seconds");
    }
}

impl Drop for TestServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[allow(dead_code)]
pub fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis()
}

pub fn print_label(label: &str, status: StatusCode, body: &str) {
    println!("\n===== {} =====", label);
    println!("Status: {}", status);
    println!("Body: {}", body);
    if status.is_success() {
        println!("[PASS] {} -> success", label);
    } else {
        println!("[FAIL] {} -> failed", label);
    }
}

pub async fn send_json(
    label: &str,
    client: &Client,
    method: reqwest::Method,
    path: &str,
    payload: Option<serde_json::Value>,
    token: Option<&str>,
) -> serde_json::Value {
    assert!(
        !path.starts_with("/api") || token.is_some(),
        "Access token is required for all /api routes: {}",
        path
    );

    let mut request = client.request(method, format!("{}{}", BASE_URL, path));

    if let Some(token) = token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    if let Some(payload) = payload {
        request = request.json(&payload);
    }

    let response = request.send().await.expect("request failed");
    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "<unable to read body>".to_string());

    print_label(label, status, &body);
    assert!(
        status.is_success(),
        "{} returned status {} with body {}",
        label,
        status,
        body
    );
    serde_json::from_str(&body).unwrap_or(serde_json::Value::Null)
}

pub mod auth;
pub mod exam;
pub mod room;
pub mod admin;
