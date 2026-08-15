use axum::{extract::State, http::StatusCode, Extension, Json};
use diesel::{Connection, RunQueryDsl};

use crate::{
    postgres::schema::{Exam, Users},
    schema::exam,
    service::{
        answer::new_answer,
        answer_map::new_answer_map,
        domain::{get_existed_domain, new_domain},
        exam::{new_exam, CreateExamRequest, CreateExamResponse},
        question::new_question,
        users::ROLE,
    },
    AppState,
};

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

    let check_user_role = match user.role {
        ROLE::ADMIN => true,
        _ => false,
    };

    if !check_user_role {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "You have no permission".to_string(),
        ));
    }

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
            } else {
                return Err(diesel::result::Error::NotFound);
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
