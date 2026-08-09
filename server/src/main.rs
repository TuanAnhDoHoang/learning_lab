#[macro_use]
extern crate diesel;
extern crate dotenv;

use std::env;

use anyhow::Context;
use axum::{
    routing::{get, post},
    Router,
};
use dotenv::dotenv;
use tower_http::cors::{Any, CorsLayer}; // Import các module r2d2

use crate::{
    handlers::{
        exam::{create_new_exam, get_exams},
        question::get_question,
        score::handle_score,
        user::{login, register},
    },
    postgres::db::{self, DbPool},
};

mod handlers;
mod postgres;
mod schema;
mod service;
mod utils;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    let pool = db::get_pool()?;
    db::migration(&pool)?;

    db::seed_data(&pool)?;

    let app_state = AppState { db_pool: pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = Router::new()
        .route("/new_exam", post(create_new_exam))
        .route("/exams", get(get_exams))
        .route("/questions", get(get_question))
        .route("/score", post(handle_score))
        .route("/register", post(register))
        .route("/login", post(login));

    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .nest("/api", api_routes)
        .layer(cors)
        .with_state(app_state);

    let host_url = env::var("URL")?;

    // Bind TCP listener to port 3000
    let listener = tokio::net::TcpListener::bind(&host_url)
        .await
        .context("Error during start server")?;

    println!("Server running on {}", host_url);

    // Run the server
    axum::serve(listener, app).await.unwrap();
    Ok(())
}
