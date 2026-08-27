use axum::{extract::State, http::StatusCode, Extension, Json};
use diesel::{query_dsl::methods::FilterDsl, ExpressionMethods, OptionalExtension, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::{
    postgres::schema::{Room, Users},
    schema::room,
    service::{room::RoomStatus, room_member::add_member_to_room},
    AppState,
};

#[derive(Deserialize)]
pub struct JoinRoomRequest {
    pub room_code: String,
}

#[derive(Serialize)]
pub struct JoinRoomResponse {
    pub room_id: i32,
}

pub async fn join_room(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_data: Room = room::table
        .filter(room::code.eq(&req.room_code))
        .first(&mut conn)
        .optional()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Can not query room: {}", e),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                format!("Room code {} not found", req.room_code),
            )
        })?;

    if room_data.status != RoomStatus::OPEN {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Room {} is not open; current status is {}",
                room_data.id,
                room_data.status.to_string()
            ),
        ));
    }

    add_member_to_room(room_data.id, user.id, &mut conn)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Can not join room: {}", e)))?;

    Ok(Json(JoinRoomResponse {
        room_id: room_data.id,
    }))
}

#[derive(Deserialize)]
pub struct LeaveRoomRequest {
    pub room_code: String,
}

#[derive(Serialize)]
pub struct LeaveRoomResponse {
    pub room_id: i32,
}

pub async fn leave_room(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
    Json(req): Json<LeaveRoomRequest>,
) -> Result<Json<LeaveRoomResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_data: Room = room::table
        .filter(room::code.eq(&req.room_code))
        .first(&mut conn)
        .optional()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Can not query room: {}", e),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                format!("Room code {} not found", req.room_code),
            )
        })?;

    if room_data.status != RoomStatus::OPEN {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Can not leave room"),
        ));
    }

    let deleted_rows = diesel::delete(
        crate::schema::room_member::table
            .filter(crate::schema::room_member::room_id.eq(room_data.id))
            .filter(crate::schema::room_member::user_id.eq(user.id)),
    )
    .execute(&mut conn)
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not leave room: {}", e),
        )
    })?;

    if deleted_rows == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            format!("User {} is not a member of room {}", user.id, room_data.id),
        ));
    }

    Ok(Json(LeaveRoomResponse {
        room_id: room_data.id,
    }))
}

#[derive(Serialize)]
pub struct GetRoomByUserIdResponse {
    pub room_ids: Vec<i32>,
}

pub async fn get_room_by_userid(
    State(app_state): State<AppState>,
    Extension(user): Extension<Users>,
) -> Result<Json<GetRoomByUserIdResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let room_ids =
        crate::service::room_member::get_room_by_userid(user.id, &mut conn).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Can not get room list for user {}: {}", user.id, e),
            )
        })?;

    Ok(Json(GetRoomByUserIdResponse { room_ids }))
}
