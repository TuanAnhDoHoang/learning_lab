use diesel::{Insertable, QueryableByName};
use serde::{Deserialize, Serialize};

use crate::schema::question;

#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = question)]
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

#[derive(Serialize)]
pub struct GetQuestionResponse {
    pub questions: Vec<QuestionAnswer>,
}

#[derive(Serialize)]
pub struct QuestionAnswer {
    pub question: crate::postgres::schema::Question,
    pub answers: Vec<crate::postgres::schema::Answer>,
}

#[derive(Deserialize)]
pub struct QuestionQuery {
    pub exam_id: i32,
}
