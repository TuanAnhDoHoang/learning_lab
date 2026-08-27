use crate::{
    postgres::schema::RoomMember,
    schema::room_member,
};
use diesel::{
    ExpressionMethods, Insertable, PgConnection, QueryableByName, RunQueryDsl,
    query_dsl::methods::FilterDsl,
    query_dsl::methods::SelectDsl,
};

#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = room_member)]
pub struct NewRoomMember {
    pub room_id: i32,
    pub user_id: i32,
    pub exam_attempt_id: Option<i32>,
}

pub fn add_member_to_room(
    room_id: i32,
    user_id: i32,
    conn: &mut PgConnection,
) -> anyhow::Result<RoomMember> {

    let new_member = NewRoomMember { room_id, user_id, exam_attempt_id: None };

    let inserted: RoomMember = diesel::insert_into(room_member::table)
        .values(&new_member)
        .get_result(conn)?;

    Ok(inserted)
}

pub fn get_room_by_userid(user_id: i32, conn: &mut PgConnection) -> anyhow::Result<Vec<i32>> {
    let room_ids = room_member::table
        .filter(room_member::user_id.eq(user_id))
        .select(room_member::room_id)
        .load::<i32>(conn)?;

    Ok(room_ids)
}
