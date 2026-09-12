use diesel::{query_dsl::methods::FilterDsl, ExpressionMethods, PgConnection, RunQueryDsl};

use crate::{
    postgres::schema::Answer,
    schema::answer,
};

pub fn new_answer(question_id: i32, content: &str, conn: &mut PgConnection) -> anyhow::Result<Answer> {
    let new_answer = super::types::NewAnswer { question_id, content };

    let inserted_answer: Answer = diesel::insert_into(answer::table)
        .values(&new_answer)
        .get_result(conn)?;
    Ok(inserted_answer)
}

pub fn get_answers_by_question(question_id: i32, conn: &mut PgConnection) -> anyhow::Result<Vec<Answer>> {
    let answers = answer::table
        .filter(answer::question_id.eq(question_id))
        .load::<Answer>(conn)?;
    Ok(answers)
}

#[allow(dead_code)]
pub fn get_one_answer(question_id: i32, content: &str, conn: &mut PgConnection) -> anyhow::Result<Answer> {
    let answer_exist = answer::table
        .filter(answer::question_id.eq(question_id))
        .filter(answer::content.eq(content))
        .first::<Answer>(conn)?;
    Ok(answer_exist)
}
