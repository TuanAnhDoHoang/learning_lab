use axum::{
    Extension, Json,
    extract::{Multipart, State},
    http::StatusCode,
};
use diesel::{Connection, RunQueryDsl};

use crate::{
    AppState,
    postgres::schema::{Exam, Users},
    schema::exam,
    service::{
        answer::new_answer,
        answer_map::new_answer_map,
        domain::{get_existed_domain, new_domain},
        exam::{
            CreateExamRequest, CreateExamResponse, create_exam_from_parsed_questions,
            extract_exam_payload_and_image, new_exam, validate_answer_index,
            validate_exam_payload,
        },
        question::new_question,
    },
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

pub async fn create_new_exam(
    State(app_state): State<AppState>,
    Extension(_user): Extension<Users>,
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

        let created_exam = new_exam(domain_id, &payload.exam_name, payload.duration, conn)
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

pub async fn create_new_exam_by_image(
    State(app_state): State<AppState>,
    Extension(_user): Extension<Users>,
    mut multipart: Multipart,
) -> Result<Json<CreateExamResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let (payload, image_path) = extract_exam_payload_and_image(&mut multipart)
        .await
        .map_err(|(code, message)| (code, message))?;

    validate_exam_payload(&payload).map_err(|message| {
        (StatusCode::BAD_REQUEST, message)
    })?;

    let parsed = crate::utils::ocr::parse_image(std::path::Path::new(&image_path))
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Error during parse image {}", e)))?;

    // if let Err(_) = validate_answer_count(payload.answers.len(), parsed.len()) {
    //     return handle_invalid_answer_count(payload.answers.len(), parsed.len()).await;
    // }

    let mut new_exam_id = 0;

    if payload.answers.len() > parsed.len() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Số lượng câu trả lời đúng ({}) không được nhiều hơn số lượng câu hỏi ({}).",
                payload.answers.len(),
                parsed.len()
            ),
        ));
    }

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let conn = &mut *conn;

        for (index, question) in parsed.iter().enumerate() {
            if let Some(&selected_index) = payload.answers.get(index) {
                validate_answer_index(selected_index as usize, question.answers.len())
                    .map_err(|_| diesel::result::Error::NotFound)?;
            }
        }

        let exam_id = create_exam_from_parsed_questions(conn, &payload, &parsed)
            .map_err(|e| diesel::result::Error::QueryBuilderError(format!("{}", e).into()))?;

        new_exam_id = exam_id;
        Ok(())
    })
    .map_err(|e| {
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
        Ok(Json(CreateExamResponse { exam_id: new_exam_id }))
    }
}