use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use diesel::Connection;

use crate::{
    service::{
        answer::get_answers_by_question,
        question::{get_questions_by_exam, GetQuestionResponse, QuestionAnswer, QuestionQuery},
    },
    AppState,
};
pub async fn get_question(
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

        let questions = get_questions_by_exam(exam_id, conn).map_err(|e| {
            eprint!("Error during get questions by exam_id: {}", e);
            diesel::result::Error::NotFound
        })?;

        for question in questions {
            let answers = get_answers_by_question(question.id, conn).map_err(|e| {
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
