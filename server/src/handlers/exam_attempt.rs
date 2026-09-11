use axum::{
    extract::{Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use diesel::{
    query_dsl::methods::{FilterDsl, OrderDsl, SelectDsl},
    Connection, ExpressionMethods, OptionalExtension, RunQueryDsl,
};

use crate::{
    postgres::schema::Users,
    schema::exam_attempt,
    service::{
        exam::{self, get_exam_by_id},
        exam_attempt::{
            new_exam_attempt, AttemptScoreRequest, CreateExamAttemptRequest,
            CreateExamAttemptResponse, GetAttemptRequest, GetAttemptResponse,
            GetTimeAttemptEndRequest, GetTimeAttemptEndResponse,
        },
        room::RoomStatus,
        score::Score,
    },
    AppState,
};

pub async fn create_exam_attempt(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<CreateExamAttemptRequest>,
) -> Result<Json<CreateExamAttemptResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let exam = get_exam_by_id(req.exam_id, &mut conn).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error check exam exist: {}", e),
        )
    })?;

    let time_start = Utc::now().naive_utc();
    let time_end = time_start + chrono::Duration::minutes(exam.duration as i64);

    let exam_attempt_inserted = new_exam_attempt(exam.id, user.id, time_start, time_end, &mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error during create exam attempt: {}", e),
            )
        })?;

    let exam_content = exam::get_exam_content_by_id(req.exam_id, &mut conn)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error during create exam attempt: {}", e),
            )
        })?;

    Ok(Json(CreateExamAttemptResponse {
        exam_attempt_id: exam_attempt_inserted.id,
        exam_content,
    }))
}

pub async fn get_time_attempt_end(
    State(app_state): State<AppState>,
    Json(req): Json<GetTimeAttemptEndRequest>,
) -> Result<Json<GetTimeAttemptEndResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let time_end = exam_attempt::table
        .filter(exam_attempt::id.eq(req.exam_attempt_id))
        .select(exam_attempt::time_end)
        .first::<chrono::NaiveDateTime>(&mut conn)
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                format!("Exam attempt {} not found", req.exam_attempt_id),
            )
        })?;

    let now = Utc::now().naive_utc();

    Ok(Json(GetTimeAttemptEndResponse {
        now: now.and_utc().timestamp(),
        time_end: time_end.and_utc().timestamp(),
    }))
}

pub async fn get_attempt(
    State(app_state): State<AppState>,
    Query(query): Query<GetAttemptRequest>,
    Extension(user): Extension<Users>,
) -> Result<Json<Vec<GetAttemptResponse>>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let response = conn
        .transaction::<_, diesel::result::Error, _>(|conn| {
            let exam_id = exam_attempt::table
                .filter(exam_attempt::id.eq(query.exam_attempt_id))
                .filter(exam_attempt::user_id.eq(user.id))
                .select(exam_attempt::exam_id)
                .first::<i32>(conn)
                .map_err(|_| diesel::result::Error::NotFound)?;

            let questions = crate::schema::question::table
                .filter(crate::schema::question::exam_id.eq(exam_id))
                .load::<crate::postgres::schema::Question>(conn)
                .map_err(|_| diesel::result::Error::NotFound)?;

            let mut result = Vec::with_capacity(questions.len());

            for question in questions {
                let answers = crate::schema::answer::table
                    .filter(crate::schema::answer::question_id.eq(question.id))
                    .load::<crate::postgres::schema::Answer>(conn)
                    .map_err(|e| {
                        eprintln!("Error loading answers: {}", e);
                        diesel::result::Error::NotFound
                    })?;

                let user_answer_id = crate::schema::answer_history::table
                    .filter(
                        crate::schema::answer_history::exam_attempt_id.eq(query.exam_attempt_id),
                    )
                    .filter(crate::schema::answer_history::question_id.eq(question.id))
                    .order(crate::schema::answer_history::time.desc())
                    .select(crate::schema::answer_history::answer_id)
                    .first::<i32>(conn)
                    .ok();

                let user_answer = answers
                    .iter()
                    .position(|answer| Some(answer.id) == user_answer_id);

                result.push(GetAttemptResponse {
                    question: question.content,
                    answers: answers.into_iter().map(|answer| answer.content).collect(),
                    user_answer,
                });
            }

            Ok(result)
        })
        .map_err(|e| {
            let err_msg = if e == diesel::result::Error::NotFound {
                format!(
                    "Exam attempt {} not found or user is not allowed to access it",
                    query.exam_attempt_id
                )
            } else {
                format!("Transaction failed: {}", e)
            };
            (StatusCode::FORBIDDEN, err_msg)
        })?;

    Ok(Json(response))
}

pub async fn attempt_score(
    State(app_state): State<AppState>,
    Query(query): Query<AttemptScoreRequest>,
    Extension(user): Extension<Users>,
) -> Result<Json<Score>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    // compute score and persist via service (service enforces ownership)
    let (correct_count, total_questions, question_no_answer) =
        match crate::service::exam_attempt::score_and_save_attempt(
            query.exam_attempt_id,
            user.id,
            &mut conn,
        ) {
            Ok(res) => res,
            Err(e) => {
                if e == diesel::result::Error::NotFound {
                    return Err((
                        StatusCode::FORBIDDEN,
                        format!(
                            "Exam attempt {} not found or user not allowed",
                            query.exam_attempt_id
                        ),
                    ));
                } else {
                    return Err((StatusCode::BAD_REQUEST, format!("Scoring failed: {}", e)));
                }
            }
        };

    Ok(Json(Score {
        score: correct_count,
        sum_of_question: total_questions,
        question_no_answer,
    }))
}

#[derive(serde::Deserialize)]
pub struct CreateExamAttemptByRoomRequest {
    pub room_id: i32,
}

pub async fn create_exam_attempt_by_room(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<CreateExamAttemptByRoomRequest>,
) -> Result<Json<CreateExamAttemptResponse>, (StatusCode, String)> {
    use crate::schema::room;
    use crate::schema::room_member;

    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    // load room
    let room_row = room::table
        .filter(room::id.eq(req.room_id))
        .first::<crate::postgres::schema::Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Room {} not found: {}", req.room_id, e),
            )
        })?;

    if room_row.status != RoomStatus::ONGOING {
        return Err((StatusCode::FORBIDDEN, format!("Room have not start yet")));
    }

    // check membership and ensure there is no existing exam_attempt for this member
    let member_attempt_opt = room_member::table
        .filter(room_member::room_id.eq(req.room_id))
        .filter(room_member::user_id.eq(user.id))
        .select(room_member::exam_attempt_id)
        .first::<Option<i32>>(&mut conn)
        .optional()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to query room_member: {}", e),
            )
        })?;

    match member_attempt_opt {
        //Dữ liệu Không tồn tại
        None => {
            return Err((
                StatusCode::FORBIDDEN,
                format!("User {} is not a member of room {}", user.id, req.room_id),
            ));
        }
        Some(Some(existing_id)) => {
            //already has an exam_attempt
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "Exam attempt already exists for this member: {}",
                    existing_id
                ),
            ));
        }
        Some(None) => {
            // create attempt using room.duration
            let time_start = Utc::now().naive_utc();
            let time_end = time_start + chrono::Duration::minutes(room_row.duration as i64);

            let exam_attempt_inserted =
                new_exam_attempt(room_row.exam_id, user.id, time_start, time_end, &mut conn)
                    .map_err(|e| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            format!("Error during create exam attempt: {}", e),
                        )
                    })?;

            // update room_member with exam_attempt_id
            diesel::update(
                room_member::table
                    .filter(room_member::room_id.eq(req.room_id))
                    .filter(room_member::user_id.eq(user.id)),
            )
            .set(room_member::exam_attempt_id.eq(Some(exam_attempt_inserted.id)))
            .execute(&mut conn)
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to update room_member: {}", e),
                )
            })?;

            let exam_content = exam::get_exam_content_by_id(room_row.exam_id, &mut conn)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Error during create exam attempt: {}", e),
                    )
                })?;

            Ok(Json(CreateExamAttemptResponse {
                exam_attempt_id: exam_attempt_inserted.id,
                exam_content,
            }))
        }
    }
}
