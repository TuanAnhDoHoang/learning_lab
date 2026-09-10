use diesel::{query_dsl::methods::FilterDsl, ExpressionMethods, Insertable, PgConnection, QueryableByName, RunQueryDsl};

use crate::{
    postgres::schema::{Answer, Question},
    schema::question,
};

pub fn new_question(exam_id: i32, content: &str, conn: &mut PgConnection) -> anyhow::Result<Question> {
    let new_question = super::types::NewQuestion { exam_id, content };

    let inserted_question: Question = diesel::insert_into(question::table)
        .values(&new_question)
        .get_result(conn)?;

    Ok(inserted_question)
}

pub fn get_questions_by_exam(exam_id: i32, conn: &mut PgConnection) -> anyhow::Result<Vec<Question>> {
    let questions = question::table
        .filter(question::exam_id.eq(exam_id.to_owned()))
        .load::<Question>(conn)?;

    Ok(questions)
}

pub fn get_one_question(exam_id: i32, question_content: &str, conn: &mut PgConnection) -> anyhow::Result<Question> {
    let question_exist = question::table
        .filter(question::exam_id.eq(exam_id))
        .filter(question::content.eq(question_content))
        .first::<Question>(conn)?;
    Ok(question_exist)
}
