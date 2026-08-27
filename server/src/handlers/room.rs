use axum::{extract::State, http::StatusCode, Extension, Json};
use chrono::Utc;
use diesel::{
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, OptionalExtension, RunQueryDsl,
};
use validator::Validate;

use crate::service::score::{MemberScore, RoomScoresResponse, Score as ScoreResp};
use crate::{
    postgres::schema::{Room, Users},
    schema::room,
    service::{
        exam::check_exam_exist,
        room::{
            self as room_service, new_room, CloseRoomRequest, CloseRoomResponse, CreateRoomRequest,
            CreateRoomResponse, DeleteRoomRequest, DeleteRoomResponse, RoomStatus,
            StartRoomRequest, StartRoomResponse,
        },
    },
    AppState,
};
use serde::{Deserialize, Serialize};

pub async fn create_room(
    State(app_state): State<AppState>,
    Extension(owner): Extension<Users>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<CreateRoomResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    req.validate().map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Invalid room payload: {}", e),
        )
    })?;

    let code = format!(
        "ROOM-{}-{}",
        owner.id,
        Utc::now().timestamp_millis() % 1_000_000
    );

    let check_result = check_exam_exist(req.exam_id, &mut conn).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error checking exam: {}", e),
        )
    })?;

    if !check_result {
        return Err((StatusCode::BAD_REQUEST, format!("Invalid exam id")));
    }

    let created_room = new_room(
        &req.name,
        owner.id,
        RoomStatus::OPEN,
        &code,
        req.duration,
        req.exam_id,
        &mut conn,
    )
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not create room: {}", e),
        )
    })?;

    Ok(Json(CreateRoomResponse {
        room_id: created_room.id,
        room_code: created_room.code,
    }))
}

#[derive(Deserialize)]
pub struct RoomScoresRequest {
    pub room_id: i32,
}

#[derive(Deserialize)]
pub struct RoomMemberScoreRequest {
    pub room_id: i32,
    pub user_id: i32,
}

pub async fn room_scores(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<RoomScoresRequest>,
) -> Result<Json<RoomScoresResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_row = room::table
        .filter(room::id.eq(req.room_id))
        .first::<Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Room {} not found: {}", req.room_id, e),
            )
        })?;

    if user.id != room_row.owner_id {
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("You don't have permission"),
        ));
    }

    // collect member user ids
    let user_ids: Vec<i32> = crate::schema::room_member::table
        .filter(crate::schema::room_member::room_id.eq(req.room_id))
        .select(crate::schema::room_member::user_id)
        .load(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to load room members: {}", e),
            )
        })?;

    let mut members: Vec<MemberScore> = Vec::new();
    for uid in user_ids.iter() {
        match crate::service::exam_attempt::get_score_by_user_and_room(*uid, req.room_id, &mut conn)
        {
            Ok(Some((score, total))) => members.push(MemberScore {
                user_id: *uid,
                score: Some(ScoreResp {
                    score: score as u32,
                    sum_of_question: total as u32,
                }),
            }),
            Ok(None) => members.push(MemberScore {
                user_id: *uid,
                score: None,
            }),
            Err(e) => {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to get score for user {}: {}", uid, e),
                ))
            }
        }
    }

    Ok(Json(RoomScoresResponse {
        room_id: req.room_id,
        members,
    }))
}

pub async fn room_member_score(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<RoomMemberScoreRequest>,
) -> Result<Json<MemberScore>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_row = room::table
        .filter(room::id.eq(req.room_id))
        .first::<Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Room {} not found: {}", req.room_id, e),
            )
        })?;

    if user.id != room_row.owner_id {
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("You don't have permission"),
        ));
    }

    match crate::service::exam_attempt::get_score_by_user_and_room(
        req.user_id,
        req.room_id,
        &mut conn,
    ) {
        Ok(Some((score, total))) => Ok(Json(MemberScore {
            user_id: req.user_id,
            score: Some(ScoreResp {
                score: score as u32,
                sum_of_question: total as u32,
            }),
        })),
        Ok(None) => Ok(Json(MemberScore {
            user_id: req.user_id,
            score: None,
        })),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to get score: {}", e),
        )),
    }
}

pub async fn my_room_score(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<RoomScoresRequest>,
) -> Result<Json<MemberScore>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;
    match crate::service::exam_attempt::get_score_by_user_and_room(user.id, req.room_id, &mut conn)
    {
        Ok(Some((score, total))) => Ok(Json(MemberScore {
            user_id: user.id,
            score: Some(ScoreResp {
                score: score as u32,
                sum_of_question: total as u32,
            }),
        })),
        Ok(None) => Ok(Json(MemberScore {
            user_id: user.id,
            score: None,
        })),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to get score: {}", e),
        )),
    }
}

pub async fn start_room(
    State(app_state): State<AppState>,
    Json(req): Json<StartRoomRequest>,
) -> Result<Json<StartRoomResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_updated = diesel::update(room::table.filter(room::id.eq(req.room_id)))
        .set(room::status.eq(RoomStatus::ONGOING))
        .get_result::<Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Can not start room: {}", e),
            )
        })?;

    let mems = room_service::ongoing(&room_updated, &mut conn).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    Ok(Json(StartRoomResponse {
        room_id: room_updated.id,
        status: room_updated.status.to_string(),
        mems,
    }))
}

pub async fn close_room(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<CloseRoomRequest>,
) -> Result<Json<CloseRoomResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    // load room to get exam_id
    let room_row = room::table
        .filter(room::id.eq(req.room_id))
        .first::<Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Room {} not found: {}", req.room_id, e),
            )
        })?;

    if user.id != room_row.owner_id {
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("You don't have permission"),
        ));
    }

    // get all member user ids
    let user_ids: Vec<i32> = crate::schema::room_member::table
        .filter(crate::schema::room_member::room_id.eq(room_row.id))
        .select(crate::schema::room_member::user_id)
        .load(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to load room members: {}", e),
            )
        })?;

    // For each member, if room_member has an exam_attempt_id, and that attempt has no mark yet,
    // score and save it.
    for uid in user_ids.iter() {
        // read exam_attempt_id from room_member for this user+room
        let rm_attempt_opt = crate::schema::room_member::table
            .filter(crate::schema::room_member::room_id.eq(room_row.id))
            .filter(crate::schema::room_member::user_id.eq(uid))
            .select(crate::schema::room_member::exam_attempt_id)
            .first::<Option<i32>>(&mut conn)
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to query room_member: {}", e),
                )
            })?;

        if let Some(attempt_id) = rm_attempt_opt {
            // check if the attempt already has a mark
            let mark_opt = crate::schema::exam_attempt::table
                .filter(crate::schema::exam_attempt::id.eq(attempt_id))
                .select(crate::schema::exam_attempt::mark)
                .first::<Option<i32>>(&mut conn)
                .optional()
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to query exam_attempt mark: {}", e),
                    )
                })?;

            // if mark is None (i.e., not yet scored), perform scoring
            if let Some(None) = mark_opt {
                crate::service::exam_attempt::score_and_save_attempt(attempt_id, *uid, &mut conn)
                    .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Scoring failed for user {}: {}", uid, e),
                    )
                })?;
            }
        } else {
            let deleted_rows = diesel::delete(
                crate::schema::room_member::table
                    .filter(crate::schema::room_member::room_id.eq(room_row.id))
                    .filter(crate::schema::room_member::user_id.eq(uid)),
            )
            .execute(&mut conn)
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Can not force user leave room: {}", e),
                )
            })?;

            if deleted_rows == 0 {
                return Err((
                    StatusCode::NOT_FOUND,
                    format!("User {} is not a member of room {}", uid, room_row.id),
                ));
            }
        }
    }

    // finally set room status to CLOSED
    let room_updated = diesel::update(room::table.filter(room::id.eq(req.room_id)))
        .set(room::status.eq(RoomStatus::CLOSED))
        .get_result::<Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Can not close room: {}", e),
            )
        })?;

    Ok(Json(CloseRoomResponse {
        room_id: room_updated.id,
        status: room_updated.status.to_string(),
    }))
}

pub async fn delete_room(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<DeleteRoomRequest>,
) -> Result<Json<DeleteRoomResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_row = room::table
        .filter(room::id.eq(req.room_id))
        .first::<Room>(&mut conn)
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Room {} not found: {}", req.room_id, e),
            )
        })?;

    if user.id != room_row.owner_id {
        return Err((
            StatusCode::UNAUTHORIZED,
            format!("You don't have permission"),
        ));
    }

    room_service::delete_room(req.room_id, &mut conn).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Can not delete room {}: {}", req.room_id, e),
        )
    })?;

    Ok(Json(DeleteRoomResponse {
        room_id: req.room_id,
    }))
}
