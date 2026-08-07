use crate::service::users::ROLE;
use chrono::NaiveDateTime;
use diesel::Queryable;
use serde::Serialize;
#[derive(Debug, Queryable)]
pub struct Domain {
    pub id: i32,
    pub name: String,
}

#[derive(Debug, Queryable, Serialize)]
pub struct Exam {
    pub id: i32,
    pub domain_id: i32,
    pub name: String,
}

#[derive(Debug, Queryable, Serialize)]
pub struct Question {
    pub id: i32,
    pub exam_id: i32,
    pub content: String,
}

#[derive(Debug, Queryable, Serialize)]
pub struct Answer {
    pub id: i32,
    pub question_id: i32,
    pub content: String,
}

#[derive(Debug, Queryable)]
pub struct AnswerMap {
    pub question_id: i32,
    pub answer_id: i32,
}

#[derive(Debug, Queryable)]
pub struct Users {
    pub id: i32,
    pub email: String,
    pub name: String,
    pub password: String,
    pub role: ROLE,
}

#[derive(Debug, Queryable)]
pub struct RefeshToken {
    id: i32,
    token_hash: String,
    user_id: i32,
    device_info: Option<String>,
    user_agent: Option<String>,
    is_revoked: bool,
    expires_at: NaiveDateTime,
    created_at: NaiveDateTime,
}
