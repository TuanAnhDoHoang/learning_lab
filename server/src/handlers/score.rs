use axum::{extract::State, http::StatusCode, Json};
use diesel::{Connection, ExpressionMethods, OptionalExtension, RunQueryDsl};
use diesel::query_dsl::methods::{FilterDsl, SelectDsl};

use crate::{
    AppState,
    service::{
        exam::check_exam_exist,
        score::{DoScoreRequest, Score},
    },
};

pub async fn handle_score(
    State(app_state): State<AppState>,
    Json(req): Json<DoScoreRequest>,
) -> Result<Json<Score>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let total_questions = req.questions.len() as u32;
    let mut correct_count = 0u32;
    let mut question_no_answer = Vec::new();

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let exam_id = req.exam_id;

        let exam_exists = check_exam_exist(exam_id, conn).map_err(|e| {
            eprintln!("Error during check exam id: {}", e);
            diesel::result::Error::NotFound
        })?;

        if !exam_exists {
            return Err(diesel::result::Error::NotFound);
        }

        for q in &req.questions {
            let question_id = crate::schema::question::table
                .filter(crate::schema::question::id.eq(q.question_id))
                .filter(crate::schema::question::exam_id.eq(exam_id))
                .select(crate::schema::question::id)
                .first::<i32>(conn)
                .map_err(|_| diesel::result::Error::NotFound)?;

            let correct_answer_id = crate::schema::answer_map::table
                .filter(crate::schema::answer_map::question_id.eq(question_id))
                .select(crate::schema::answer_map::answer_id)
                .first::<i32>(conn)
                .optional()
                .map_err(|_| diesel::result::Error::NotFound)?;

            match correct_answer_id {
                Some(correct_answer_id) if correct_answer_id == q.answer_id => {
                    correct_count += 1;
                }
                None => {
                    question_no_answer.push(question_id);
                }
                _ => {}
            }
        }

        Ok(())
    })
    .map_err(|e| {
        let err_msg = if e == diesel::result::Error::NotFound {
            "Invalid exam id or question id".to_string()
        } else {
            format!("Transaction failed! All changes rolled back. Error: {}", e)
        };

        (StatusCode::BAD_REQUEST, err_msg)
    })?;

    Ok(Json(Score {
        score: correct_count,
        sum_of_question: total_questions,
        question_no_answer,
    }))
}
