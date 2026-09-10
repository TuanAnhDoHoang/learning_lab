use crate::postgres::schema::AnswerMap;
use crate::schema::answer_map;
use diesel::ExpressionMethods;
use diesel::Insertable;
use diesel::PgConnection;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use diesel::query_dsl::methods::FilterDsl;
#[derive(Debug, Insertable, QueryableByName)]
#[table_name = "answer_map"]
pub struct NewAnswerMap {
    pub question_id: i32,
    pub answer_id: i32,
}

pub fn new_answer_map(
    question_id: i32,
    answer_id: i32,
    conn: &mut PgConnection,
) -> anyhow::Result<()> {
    let new_answer_map = NewAnswerMap {
        question_id,
        answer_id,
    };

    // Dùng .execute() thay vì .get_result()
    diesel::insert_into(answer_map::table)
        .values(&new_answer_map)
        .execute(conn)?;
    Ok(())
}

pub fn get_answer_map(question_id: i32, conn: &mut PgConnection) -> anyhow::Result<AnswerMap> {
    let answer_map = answer_map::table
        .filter(answer_map::question_id.eq(question_id))
        .first::<AnswerMap>(conn)?;
    Ok(answer_map)
}
