use std::env;

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Extension, Json,
};
use diesel::{Connection, ExpressionMethods, QueryDsl, RunQueryDsl};
use reqwest::{
    multipart::{Form, Part},
    Client,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    postgres::schema::{Exam, Users},
    schema::exam,
    service::{
        answer::new_answer,
        answer_map::new_answer_map,
        domain::{get_existed_domain, new_domain},
        exam::{
            extract_exam_payload_and_image, new_exam, normalize_python_questions,
            CreateExamRequest, CreateExamResponse,
        },
        question::{new_question, QuestionRequest},
    },
    AppState,
};

// async fn handle_invalid_answer_count(
//     payload_answers_len: usize,
//     question_count: usize,
// ) -> Result<Json<CreateExamResponse>, (StatusCode, String)> {
//     Err((
//         StatusCode::BAD_REQUEST,
//         format!(
//             "Số lượng câu trả lời đúng ({}) không khớp với số lượng câu hỏi ({}).",
//             payload_answers_len, question_count
//         ),
//     ))
// }

#[derive(Deserialize)]
pub struct DeleteExamRequest {
    pub exam_id: i32,
}

#[derive(Serialize)]
pub struct DeleteExamResponse {
    pub exam_id: i32,
}

#[derive(Deserialize)]
pub struct UpdateExamRequest {
    pub exam_id: i32,
    pub exam_name: String,
    pub domain: String,
    pub duration: i32,
}

#[derive(Serialize)]
pub struct UpdateExamResponse {
    pub exam_id: i32,
}

pub async fn create_new_exam(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
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

        let domain_existed = get_existed_domain(&payload.domain, conn).map_err(|e| {
            diesel::result::Error::QueryBuilderError(
                format!("Error during create new domain {}", e).into(),
            )
        })?;

        let domain_id = match domain_existed {
            Some(domain) => domain.id,
            None => {
                let domain = new_domain(&payload.domain, conn).map_err(|e| {
                    diesel::result::Error::QueryBuilderError(
                        format!("Error during create new domain {}", e).into(),
                    )
                })?;
                domain.id
            }
        };

        let created_exam = new_exam(
            user.id,
            domain_id,
            &payload.exam_name,
            payload.duration,
            conn,
        )
        .map_err(|e| {
            diesel::result::Error::QueryBuilderError(
                format!("Error during create new exam {}", e).into(),
            )
        })?;

        for question in &payload.questions {
            let created_question = new_question(created_exam.id, question.question.as_str(), conn)
                .map_err(|e| {
                    diesel::result::Error::QueryBuilderError(
                        format!("Error during create new question {}", e).into(),
                    )
                })?;

            let mut answer_ids = Vec::new();
            for answer_str in &question.answers {
                let created_answer = new_answer(created_question.id, answer_str.as_str(), conn)
                    .map_err(|e: anyhow::Error| {
                        diesel::result::Error::QueryBuilderError(
                            format!("Error during create new answer {}", e).into(),
                        )
                    })?;

                answer_ids.push(created_answer.id);
            }

            if let Some(&right_answer_id) = answer_ids.get(question.right_answer) {
                new_answer_map(created_question.id, right_answer_id, conn).map_err(|e| {
                    diesel::result::Error::QueryBuilderError(
                        format!("Error during create new answer map {}", e).into(),
                    )
                })?;
            }
        }

        new_exam_id = created_exam.id;

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
        Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error during creating new exam".to_string(),
        ))
    } else {
        Ok(Json(CreateExamResponse {
            exam_id: new_exam_id,
        }))
    }
}

pub async fn get_exams(
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

pub async fn parse_file(
    multipart: Multipart,
) -> Result<Json<Vec<QuestionRequest>>, (StatusCode, String)> {
    parse_uploaded_file(multipart).await
}

pub async fn create_new_exam_by_image(
    mut multipart: Multipart,
) -> Result<Json<Vec<crate::service::question::QuestionRequest>>, (StatusCode, String)> {
    let (_, image_path) = extract_exam_payload_and_image(&mut multipart)
        .await
        .map_err(|(code, message)| (code, message))?;

    let parsed = crate::utils::ocr::parse_image(std::path::Path::new(&image_path))
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Error during parse image {}", e),
            )
        })?;

    if parsed.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Không tìm thấy câu hỏi nào trong ảnh. Vui lòng kiểm tra lại ảnh chụp rõ nét hơn."
                .to_string(),
        ));
    }

    let question_requests = parsed
        .into_iter()
        .map(|p| crate::service::question::QuestionRequest {
            question: p.question,
            answers: p.answers,
            right_answer: 0,
        })
        .collect::<Vec<_>>();

    Ok(Json(question_requests))
}

pub async fn parse_uploaded_file(
    mut multipart: Multipart,
) -> Result<Json<Vec<QuestionRequest>>, (StatusCode, String)> {
    let mut uploaded_file: Option<Vec<u8>> = None;
    let mut uploaded_name: Option<String> = None;
    let mut start_page: Option<u32> = None;
    let mut end_page: Option<u32> = None;

    while let Some(field) = multipart.next_field().await.map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            format!("Invalid multipart upload: {error}"),
        )
    })? {
        match field.name().unwrap_or("") {
            "file" => {
                uploaded_name = Some(
                    field
                        .file_name()
                        .map(str::to_owned)
                        .unwrap_or_else(|| format!("upload-{}.bin", uuid::Uuid::new_v4())),
                );
                uploaded_file = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|error| {
                            (
                                StatusCode::BAD_REQUEST,
                                format!("Unable to read uploaded file: {error}"),
                            )
                        })?
                        .to_vec(),
                );
            }
            "start" => {
                let value = field.text().await.map_err(|error| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Invalid start page: {error}"),
                    )
                })?;
                start_page = Some(value.parse::<u32>().map_err(|_| {
                    (
                        StatusCode::BAD_REQUEST,
                        "start must be a valid integer".to_string(),
                    )
                })?);
            }
            "end" => {
                let value = field.text().await.map_err(|error| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Invalid end page: {error}"),
                    )
                })?;
                end_page = Some(value.parse::<u32>().map_err(|_| {
                    (
                        StatusCode::BAD_REQUEST,
                        "end must be a valid integer".to_string(),
                    )
                })?);
            }
            _ => {}
        }
    }

    let file_bytes = uploaded_file.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Missing multipart file field named 'file'".to_string(),
        )
    })?;
    let file_name = uploaded_name.unwrap_or_else(|| format!("upload-{}.bin", uuid::Uuid::new_v4()));

    let parser_url =
        env::var("FILE2EXAM_URL").unwrap_or_else(|_| "http://file2exam:8000/parse".to_string());

    let mut form = Form::new().part("file", Part::bytes(file_bytes).file_name(file_name));
    if let Some(start) = start_page {
        form = form.text("start", start.to_string());
    }
    if let Some(end) = end_page {
        form = form.text("end", end.to_string());
    }

    let response = Client::new()
        .post(&parser_url)
        .multipart(form)
        .send()
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                format!("Parser service unavailable: {error}"),
            )
        })?;

    if !response.status().is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown parser error".to_string());
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("Python parser failed: {body}"),
        ));
    }

    let payload: Value = response.json().await.map_err(|error| {
        (
            StatusCode::BAD_GATEWAY,
            format!("Invalid parser response: {error}"),
        )
    })?;
    let questions = payload
        .get("questions")
        .cloned()
        .unwrap_or_else(|| Value::Array(vec![]));

    Ok(Json(normalize_python_questions(&questions)))
}

pub async fn delete_exam(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<DeleteExamRequest>,
) -> Result<Json<DeleteExamResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let exam_row = exam::table
        .filter(exam::id.eq(req.exam_id))
        .first::<Exam>(&mut conn)
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                format!("Exam {} not found", req.exam_id),
            )
        })?;

    if exam_row.owner_id != user.id {
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("You don't have permission to delete exam {}", req.exam_id),
        ));
    }

    let question_ids: Vec<i32> = crate::schema::question::table
        .filter(crate::schema::question::exam_id.eq(req.exam_id))
        .select(crate::schema::question::id)
        .load(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error loading questions: {}", e),
            )
        })?;

    if !question_ids.is_empty() {
        diesel::delete(
            crate::schema::answer_map::table
                .filter(crate::schema::answer_map::question_id.eq_any(&question_ids)),
        )
        .execute(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error deleting answer_map: {}", e),
            )
        })?;

        diesel::delete(
            crate::schema::answer::table
                .filter(crate::schema::answer::question_id.eq_any(&question_ids)),
        )
        .execute(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error deleting answers: {}", e),
            )
        })?;
    }

    diesel::delete(
        crate::schema::question::table.filter(crate::schema::question::exam_id.eq(req.exam_id)),
    )
    .execute(&mut conn)
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error deleting questions: {}", e),
        )
    })?;

    diesel::delete(exam::table.filter(exam::id.eq(req.exam_id)))
        .execute(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error deleting exam: {}", e),
            )
        })?;

    Ok(Json(DeleteExamResponse {
        exam_id: req.exam_id,
    }))
}

pub async fn update_exam(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<UpdateExamRequest>,
) -> Result<Json<UpdateExamResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let exam_row = exam::table
        .filter(exam::id.eq(req.exam_id))
        .first::<Exam>(&mut conn)
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                format!("Exam {} not found", req.exam_id),
            )
        })?;

    if exam_row.owner_id != user.id {
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("You don't have permission to update exam {}", req.exam_id),
        ));
    }

    let domain_existed = crate::service::domain::get_existed_domain(&req.domain, &mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error during update domain {}", e),
            )
        })?;

    let domain_id = match domain_existed {
        Some(domain) => domain.id,
        None => {
            let domain =
                crate::service::domain::new_domain(&req.domain, &mut conn).map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Error during create new domain {}", e),
                    )
                })?;
            domain.id
        }
    };

    diesel::update(exam::table.filter(exam::id.eq(req.exam_id)))
        .set((
            exam::domain_id.eq(domain_id),
            exam::name.eq(req.exam_name.as_str()),
            exam::duration.eq(req.duration),
        ))
        .execute(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error updating exam: {}", e),
            )
        })?;

    Ok(Json(UpdateExamResponse {
        exam_id: req.exam_id,
    }))
}
