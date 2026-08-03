#[macro_use]
extern crate diesel;
extern crate dotenv;

use anyhow::Context;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use diesel::{query_dsl::methods::FilterDsl, Connection, OptionalExtension, RunQueryDsl};
use dotenv::dotenv;
use serde::Deserialize;
use std::env;
use tower_http::cors::{Any, CorsLayer}; // Import các module r2d2

mod postgres;
pub mod schema;
pub mod service;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    let pool = db::get_pool()?;
    db::migration(&pool)?;

    let app_state = AppState { db_pool: pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build application with a single route
    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/new_exam", post(create_new_exam))
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

#[derive(Deserialize)]
struct QuestionRequest {
    question: String,
    answers: Vec<String>,
    right_answer: usize,
}

#[derive(Deserialize)]
struct CreateExamRequest {
    exam_name: String,
    domain: String,
    questions: Vec<QuestionRequest>,
}

use self::schema::domain;
use crate::{
    diesel::ExpressionMethods,
    postgres::{
        db::{self, DbPool},
        schema::{Answer, Exam, Question},
    },
    schema::{
        answer::{self},
        answer_map, exam, question,
    },
    service::{
        answer::NewAnswer, answer_map::NewAnswerMap, domain::NewDomain, question::NewQuestion,
    },
};
use crate::{postgres::schema::Domain, service::exam::NewExam};
async fn create_new_exam(
    State(app_state): State<AppState>,
    Json(payload): Json<CreateExamRequest>,
) -> Result<Json<String>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let conn = &mut *conn;

        let domain_existed: Option<Domain> = domain::table
            .filter(domain::name.eq(&payload.domain))
            .first::<Domain>(conn)
            .optional()?; // Dùng `?` trực tiếp của Diesel

        let domain_id = match domain_existed {
            Some(domain) => domain.id,
            None => {
                let new_domain: NewDomain<'_> = NewDomain {
                    name: payload.domain.as_str(),
                };
                let inserted_domain: Domain = diesel::insert_into(domain::table)
                    .values(&new_domain)
                    .get_result(conn)?;

                inserted_domain.id
            }
        };

        // --- Step 2: Tạo Exam mới ---
        let new_exam: NewExam = NewExam {
            domain_id,
            name: payload.exam_name,
        };
        let inserted_exam: Exam = diesel::insert_into(exam::table)
            .values(&new_exam)
            .get_result(conn)?;

        // --- Step 3: Thêm danh sách Questions & Answers ---
        for question in &payload.questions {
            let new_question = NewQuestion {
                exam_id: inserted_exam.id,
                content: question.question.as_str(),
            };

            let inserted_question: Question = diesel::insert_into(question::table)
                .values(&new_question)
                .get_result(conn)?;

            let mut answer_ids = Vec::new();
            for answer_str in &question.answers {
                let new_answer = NewAnswer {
                    question_id: inserted_question.id,
                    content: answer_str.as_str(),
                };

                let inserted_answer: Answer = diesel::insert_into(answer::table)
                    .values(&new_answer)
                    .get_result(conn)?;

                answer_ids.push(inserted_answer.id);
            }

            // --- Step 4: Map câu trả lời đúng ---
            if let Some(&right_answer_id) = answer_ids.get(question.right_answer) {
                let new_answer_map = NewAnswerMap {
                    question_id: inserted_question.id,
                    answer_id: right_answer_id,
                };

                // Dùng .execute() thay vì .get_result()
                diesel::insert_into(answer_map::table)
                    .values(&new_answer_map)
                    .execute(conn)?;
            } else {
                // Trả về NotFound để ép Transaction Rollback
                return Err(diesel::result::Error::NotFound);
            }
        }

        Ok(())
    })
    .map_err(|e| {
        // Map lỗi từ Diesel sang response Axum ở bên ngoài
        let err_msg = if e == diesel::result::Error::NotFound {
            "Chỉ số câu trả lời đúng (right_answer) không hợp lệ!".to_string()
        } else {
            format!("Transaction failed! All changes rolled back. Error: {}", e)
        };

        (StatusCode::BAD_REQUEST, err_msg)
    })?;

    Ok(Json("Exam created successfully!".to_string()))
}
