#[macro_use]
extern crate diesel;
extern crate dotenv;

use anyhow::Context;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use diesel::{
    dsl::exists, query_dsl::methods::FilterDsl, Connection, OptionalExtension, RunQueryDsl,
};
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env};
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

    db::seed_data(&pool)?;

    let app_state = AppState { db_pool: pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build application with a single route
    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/new_exam", post(create_new_exam))
        .route("/exams", get(get_exams))
        .route("/questions", get(get_question))
        .route("/score", post(handle_score))
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

#[derive(Deserialize, Clone, Serialize)]
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
        schema::{Answer, AnswerMap, Exam, Question},
    },
    schema::{
        answer::{self},
        answer_map, exam, question,
    },
    service::{
        answer::NewAnswer, answer_map::NewAnswerMap, domain::NewDomain, question::NewQuestion,
    },
};
#[derive(Serialize)]
struct CreateExamResponse {
    exam_id: i32,
}
use crate::{postgres::schema::Domain, service::exam::NewExam};
async fn create_new_exam(
    State(app_state): State<AppState>,
    Json(payload): Json<CreateExamRequest>,
) -> Result<Json<CreateExamResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let mut new_exam_id = 0;

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

        new_exam_id = inserted_exam.id;

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

    if new_exam_id == 0 {
        Err((StatusCode::INTERNAL_SERVER_ERROR, "Error during creating new exam".to_string()))
    } else {
        Ok(Json(CreateExamResponse {
            exam_id: new_exam_id,
        }))
    }
}

async fn get_exams(
    State(app_state): State<AppState>,
) -> anyhow::Result<Json<Vec<Exam>>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;
    let all_exam: Vec<Exam> = exam::table.load::<Exam>(&mut conn).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error during get exams: {}", e),
        )
    })?;

    Ok(Json(all_exam))
}

#[derive(Serialize)]
struct GetQuestionResponse {
    questions: Vec<QuestionAnswer>,
}

#[derive(Serialize)]
struct QuestionAnswer {
    question: Question,
    answers: Vec<Answer>,
}

#[derive(Deserialize)]
pub struct QuestionQuery {
    pub exam_id: i32, // Axum sẽ tự parse string trên URL sang kiểu i32
}

async fn get_question(
    Query(query): Query<QuestionQuery>,
    State(app_state): State<AppState>,
) -> anyhow::Result<Json<GetQuestionResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let exam_id = query.exam_id;

    let mut response: GetQuestionResponse = GetQuestionResponse {
        questions: Vec::new(),
    };
    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let conn = &mut *conn;

        let questions = question::table
            .filter(question::exam_id.eq(exam_id.to_owned()))
            .load::<Question>(conn)
            .map_err(|e| {
                eprint!("Error during get questions by exam_id: {}", e);
                diesel::result::Error::NotFound
            })?;

        for question in questions {
            let answers = answer::table
                .filter(answer::question_id.eq(question.id))
                .load::<Answer>(conn)
                .map_err(|e| {
                    eprint!("Error during get answers by question_id: {}", e);
                    diesel::result::Error::NotFound
                })?;
            response
                .questions
                .push(QuestionAnswer { question, answers });
        }
        Ok(())
    })
    .map_err(|e| {
        // Map lỗi từ Diesel sang response Axum ở bên ngoài
        let err_msg = if e == diesel::result::Error::NotFound {
            "Invalid Exam Id".to_string()
        } else {
            format!("Transaction failed! All changes rolled back. Error: {}", e)
        };

        (StatusCode::INTERNAL_SERVER_ERROR, err_msg)
    })?;

    Ok(Json(response))
}

#[derive(Deserialize, Serialize)]
struct DoScoreRequest {
    exam_id: i32,
    questions: Vec<QuestionRequest>,
}

#[derive(Serialize, Deserialize)]
struct Score {
    score: u32,
    sum_of_question: u32,
}

async fn handle_score(
    State(app_state): State<AppState>,
    Json(req): Json<DoScoreRequest>,
) -> Result<Json<Score>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let question_req = req.questions.clone();
    let sum_of_question = question_req.len();
    for q in question_req.clone().into_iter() {
        if q.right_answer >= q.answers.len() {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "Right answer out of answers {:?} || {}",
                    q.answers.clone(),
                    q.right_answer
                ),
            ));
        }
    }

    let mut score: u32 = 0; //per 100
    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let conn = &mut *conn;
        let exam_id = req.exam_id;

        let exam_exist = diesel::select(exists(exam::table.filter(exam::id.eq(exam_id))))
            .get_result::<bool>(conn)
            .map_err(|e| {
                eprintln!("Error during check exam id is exist: {}", e);
                diesel::result::Error::NotFound
            })?;
        if !exam_exist {
            return Err(diesel::result::Error::NotFound);
        }

        for q in question_req.into_iter() {
            let question_content = q.question;
            let answers = q.answers.clone();
            let predict_answer = answers.get(q.right_answer).unwrap();
            let question_exist = question::table
                .filter(question::exam_id.eq(exam_id))
                .filter(question::content.eq(question_content))
                .first::<Question>(conn)
                .map_err(|e| {
                    eprintln!("Error during check question by exam id is exist: {}", e);
                    diesel::result::Error::RollbackTransaction
                })?;

            let answer_map = answer_map::table
                .filter(answer_map::question_id.eq(question_exist.id))
                .first::<AnswerMap>(conn)
                .map_err(|e| {
                    eprintln!("Error during check answer map by answer id is exist: {}", e);
                    diesel::result::Error::RollbackTransaction
                })?;

            for a in q.answers {
                let answer_exist = answer::table
                    .filter(answer::question_id.eq(question_exist.id))
                    .filter(answer::content.eq(a))
                    .first::<Answer>(conn)
                    .map_err(|e| {
                        eprintln!("Error during check answer by question id is exist: {}", e);
                        diesel::result::Error::RollbackTransaction
                    })?;
                if answer_exist.content == predict_answer.clone().to_owned()
                    && answer_map.answer_id == answer_exist.id
                {
                    score += 1;
                }
            }
        }
        Ok(())
    })
    .map_err(|e| {
        let err_msg = if e == diesel::result::Error::NotFound {
            "Invalid exam id".to_string()
        } else if e == diesel::result::Error::NotFound {
            "Invalid question or answers".to_string()
        } else {
            format!("Transaction failed! All changes rolled back. Error: {}", e)
        };

        (StatusCode::BAD_REQUEST, err_msg)
    })?;

    if score <= sum_of_question as u32 {
        Ok(Json(Score {
            score,
            sum_of_question: sum_of_question as u32,
        }))
    } else {
        Err((
            StatusCode::BAD_REQUEST,
            "Error during scoring exam".to_string(),
        ))
    }
}
