use std::str::FromStr;

use chrono::Utc;
use diesel::{
    Connection, ExpressionMethods, Insertable, PgConnection, QueryableByName, RunQueryDsl,
    query_dsl::methods::{FilterDsl, SelectDsl},
};
use diesel_derive_enum::DbEnum;
use regex::Regex;
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};

use crate::{
    postgres::schema::Room,
    schema::{room, room_member},
    service::exam_attempt::new_exam_attempt,
};

#[derive(Deserialize, Validate)]
pub struct CreateRoomRequest {
    #[validate(custom(function = "validate_room_name"))]
    pub name: String,
    pub exam_id: i32,
    pub duration: i32,
}

#[derive(Serialize)]
pub struct CreateRoomResponse {
    pub room_id: i32,
    pub room_code: String
}

#[derive(Deserialize, Validate)]
pub struct StartRoomRequest {
    pub room_id: i32,
}

#[derive(Serialize)]
pub struct StartRoomResponse {
    pub room_id: i32,
    pub status: String,
    pub mems: Vec<i32>,
}

#[derive(Deserialize, Validate)]
pub struct CloseRoomRequest {
    pub room_id: i32,
}

#[derive(Serialize)]
pub struct CloseRoomResponse {
    pub room_id: i32,
    pub status: String,
}

#[derive(Deserialize)]
pub struct DeleteRoomRequest {
    pub room_id: i32,
}

#[derive(Serialize)]
pub struct DeleteRoomResponse {
    pub room_id: i32,
}

/*
CREATE TYPE room_status AS ENUM ('open', 'ongoing', 'closed');

CREATE TABLE room (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status room_status NOT NULL DEFAULT 'open',
    code TEXT NOT NULL UNIQUE,
    duration INT NOT NULL, --Tính theo phút
    exam_id INT NOT NULL REFERENCES exam(id) ON DELETE CASCADE
);
*/
#[derive(Debug, Clone, PartialEq, DbEnum)]
#[ExistingTypePath = "crate::schema::sql_types::RoomStatus"]
pub enum RoomStatus {
    #[db_rename = "open"]
    OPEN,
    #[db_rename = "ongoing"]
    ONGOING,
    #[db_rename = "closed"]
    CLOSED,
}

impl std::fmt::Display for RoomStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            RoomStatus::OPEN => "open",
            RoomStatus::ONGOING => "ongoing",
            RoomStatus::CLOSED => "closed",
        })
    }
}

impl FromStr for RoomStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "open" => Ok(RoomStatus::OPEN),
            "ongoing" => Ok(RoomStatus::ONGOING),
            "closed" => Ok(RoomStatus::CLOSED),
            _ => Err(format!("Unknown room status: {}", s)),
        }
    }
}

#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = room)]
pub struct NewRoom {
    pub name: String,
    pub owner_id: i32,
    pub status: RoomStatus,
    pub code: String,
    pub duration: i32,
    pub exam_id: i32,
}

pub fn validate_room_name(name: &str) -> Result<(), ValidationError> {
    if name.len() < 3 || name.len() > 32 {
        return Err(ValidationError::new("invalid_username_length"));
    }

    let name_regex = Regex::new(r"^[a-zA-Z0-9 ]+$").unwrap();

    if !name_regex.is_match(name) {
        return Err(ValidationError::new("invalid_username_format"));
    }

    Ok(())
}

pub fn new_room(
    name: &str,
    owner_id: i32,
    status: RoomStatus,
    code: &str,
    duration: i32,
    exam_id: i32,
    conn: &mut PgConnection,
) -> anyhow::Result<Room> {
    let new_room = NewRoom {
        name: name.to_string(),
        owner_id,
        status,
        code: code.to_string(),
        duration,
        exam_id,
    };

    let created: Room = diesel::insert_into(room::table)
        .values(&new_room)
        .get_result(conn)?;

    Ok(created)
}

pub fn ongoing(room: &Room, conn: &mut PgConnection) -> anyhow::Result<Vec<i32>> {
    let duration_minutes = room.duration;
    let time_start = Utc::now().naive_utc();
    let time_end = time_start + chrono::Duration::minutes(i64::from(duration_minutes));

    let user_ids: Vec<i32> = room_member::table
        .filter(room_member::room_id.eq(room.id))
        .select(room_member::user_id)
        .load(conn)?;

    for user_id in user_ids.iter() {
        new_exam_attempt(room.exam_id, user_id.to_owned(), time_start, time_end, conn)?;
    }

    Ok(user_ids)
}

pub fn delete_room(room_id: i32, conn: &mut PgConnection) -> anyhow::Result<i32> {
    conn.transaction(|conn| {
        let deleted_members = diesel::delete(
            room_member::table.filter(room_member::room_id.eq(room_id)),
        )
        .execute(conn)?;

        let deleted_room = diesel::delete(room::table.filter(room::id.eq(room_id)))
            .execute(conn)?;

        if deleted_room == 0 {
            return Err(anyhow::anyhow!("Room {} not found", room_id));
        }

        let _ = deleted_members;
        Ok(room_id)
    })
}
