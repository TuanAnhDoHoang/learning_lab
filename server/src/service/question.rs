use crate::postgres::schema::Answer;
use crate::postgres::schema::Question;
use crate::schema::question;
use diesel::query_dsl::methods::FilterDsl;
use diesel::ExpressionMethods;
use diesel::Insertable;
use diesel::PgConnection;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
#[derive(Debug, Insertable, QueryableByName)]
#[table_name = "question"]
pub struct NewQuestion<'a> {
    pub exam_id: i32,
    pub content: &'a str,
}

#[derive(Deserialize, Clone, Serialize)]
pub struct QuestionRequest {
    pub question: String,
    pub answers: Vec<String>,
    pub right_answer: usize,
}

pub fn new_question(
    exam_id: i32,
    content: &str,
    conn: &mut PgConnection,
) -> anyhow::Result<Question> {
    let new_question = NewQuestion {
        exam_id: exam_id,
        content,
    };

    let inserted_question: Question = diesel::insert_into(question::table)
        .values(&new_question)
        .get_result(conn)?;

    Ok(inserted_question)
}

#[derive(Serialize)]
pub struct GetQuestionResponse {
    pub questions: Vec<QuestionAnswer>,
}

#[derive(Serialize)]
pub struct QuestionAnswer {
    pub question: Question,
    pub answers: Vec<Answer>,
}

#[derive(Deserialize)]
pub struct QuestionQuery {
    pub exam_id: i32, // Axum sẽ tự parse string trên URL sang kiểu i32
}

pub fn get_questions_by_exam(
    exam_id: i32,
    conn: &mut PgConnection,
) -> anyhow::Result<Vec<Question>> {
    let questions = question::table
        .filter(question::exam_id.eq(exam_id.to_owned()))
        .load::<Question>(conn)?;

    Ok(questions)
}
pub fn get_one_question(exam_id: i32, question_content: &str, conn:&mut PgConnection) -> anyhow::Result<Question> {
    let question_exist = question::table
        .filter(question::exam_id.eq(exam_id))
        .filter(question::content.eq(question_content))
        .first::<Question>(conn)?;
    Ok(question_exist)
}
