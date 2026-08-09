use axum::{extract::State, http::StatusCode, Json};
use diesel::Connection;

use crate::{
    service::{
        answer::get_one_answer,
        answer_map::get_answer_map,
        exam::check_exam_exist,
        question::get_one_question,
        score::{DoScoreRequest, Score},
    },
    AppState,
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

        let exam_exist = check_exam_exist(exam_id, conn).map_err(|e| {
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
            let question_exist =
                get_one_question(exam_id, &question_content, conn).map_err(|e| {
                    eprintln!("Error during check question by exam id is exist: {}", e);
                    diesel::result::Error::RollbackTransaction
                })?;

            let answer_map = get_answer_map(question_exist.id, conn).map_err(|e| {
                eprintln!("Error during check answer map by answer id is exist: {}", e);
                diesel::result::Error::RollbackTransaction
            })?;

            for a in q.answers {
                let answer_exist =
                    get_one_answer(question_exist.id, a.as_str(), conn).map_err(|e| {
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
