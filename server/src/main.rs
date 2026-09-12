#[macro_use]
extern crate diesel;
extern crate dotenv;

use std::env;

use anyhow::Context;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use dotenv::dotenv;
use tower_http::cors::{Any, CorsLayer}; // Import các module r2d2

use crate::{
    handlers::{
        answer_history::save_attempt_answer,
        exam::{create_new_exam, create_new_exam_by_image, delete_exam, get_exams, update_exam},
        exam_attempt::{attempt_score, create_exam_attempt, get_attempt, get_time_attempt_end, create_exam_attempt_by_room},
        question::get_question,
        room::{close_room, create_room, delete_room, room_live_answers, start_room},
        room_member::{get_room_by_userid, join_room, leave_room},
        score::handle_score,
        token::refresh,
        user::{login, logout, provide_priviliged, register},
    },
    postgres::db::{self, DbPool},
    utils::authentication::authorization_middleware,
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

    let admin_route = env::var("ADMIN_ROUTE")?;

    let app_state = AppState { db_pool: pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let auth_routes = Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh));

    let external_routes = Router::new().route("/exams", get(get_exams));

    let logout_routes =
        Router::new()
            .route("/logout", post(logout))
            .layer(middleware::from_fn_with_state(
                app_state.clone(),
                authorization_middleware,
            ));

    let api_routes = Router::new()
        .route("/new_exam", post(create_new_exam))
        .route("/new_exam_by_image", post(create_new_exam_by_image))
        .route("/delete_exam", post(delete_exam))
        .route("/update_exam", post(update_exam))
        .route("/questions", get(get_question))
        .route("/score", post(handle_score))
        .route("/start_exam_attempt", post(create_exam_attempt))
        .route("/start_exam_attempt_by_room", post(create_exam_attempt_by_room))
        .route("/time_attempt_end", post(get_time_attempt_end))
        .route("/attempt", get(get_attempt))
        .route("/score_attempt", get(attempt_score))
        .route("/save_user_answer", post(save_attempt_answer))
        .route("/create_room", post(create_room))
        .route("/start_room", post(start_room))
        .route("/close_room", post(close_room))
        .route("/room_scores", post(crate::handlers::room::room_scores))
        .route("/room_member_score", post(crate::handlers::room::room_member_score))
        .route("/my_room_score", post(crate::handlers::room::my_room_score))
        .route("/delete_room", post(delete_room))
        .route("/join_room", post(join_room))
        .route("/leave_room", post(leave_room))
        .route("/room_by_user", get(get_room_by_userid))
        .route("/room_live_answers", get(crate::handlers::room::room_live_answers))
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            authorization_middleware,
        ));

    let admin_routes = Router::new()
        .route("/provide_priviliged", post(provide_priviliged))
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            authorization_middleware,
        ));

    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .nest("/api", api_routes)
        .nest("/api", external_routes)
        .nest(format!("/{}", admin_route).as_str(), admin_routes)
        .nest("/auth", auth_routes)
        .nest("/auth", logout_routes)
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
