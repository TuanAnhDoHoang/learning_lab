use axum::Extension;
use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl};

use crate::{service::answer_history::new_answer_history, AppState};
use crate::service::room::RoomStatus;
use crate::postgres::schema::{Room, Users};

#[derive(Deserialize)]
pub struct SaveAttemptAnswerRequest {
    exam_attempt_id: i32,
    question_id: i32,
    answer_id: i32,
}

#[derive(Serialize)]
pub struct SaveAttemptAnswerResponse {
    time: i64,
}

pub async fn save_attempt_answer(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<SaveAttemptAnswerRequest>,
) -> Result<Json<SaveAttemptAnswerResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    // If this exam_attempt is linked to a room_member, ensure the room is still ONGOING
    let room_id_opt = crate::schema::room_member::table
        .filter(crate::schema::room_member::exam_attempt_id.eq(req.exam_attempt_id))
        .filter(crate::schema::room_member::user_id.eq(user.id))
        .select(crate::schema::room_member::room_id)
        .first::<i32>(&mut conn)
        .optional()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to query room_member: {}", e)))?;

    if let Some(room_id) = room_id_opt {
        let room_row = crate::schema::room::table
            .filter(crate::schema::room::id.eq(room_id))
            .first::<Room>(&mut conn)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to load room {}: {}", room_id, e)))?;

        if room_row.status != RoomStatus::ONGOING {
            return Err((StatusCode::BAD_REQUEST, format!("Cannot save answer: room {} status is {}", room_row.id, room_row.status)));
        }
    }

    let saved = new_answer_history(
        req.exam_attempt_id,
        req.question_id,
        req.answer_id,
        &mut conn,
    )
    .map_err(|e| {
        let status = if e.to_string().contains("Exam time is over") {
            StatusCode::BAD_REQUEST
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        };

        (status, format!("Error during save answer history: {}", e))
    })?;

    Ok(Json(SaveAttemptAnswerResponse {
        time: saved.time.and_utc().timestamp(),
    }))
}
