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
    pub duration: i32
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

#[derive(Debug, Clone, Queryable)]
pub struct Users {
    pub id: i32,
    pub email: String,
    pub name: String,
    pub password: String,
    pub role: ROLE,
}

#[derive(Debug, Queryable)]
pub struct RefeshToken {
    pub id: i32,
    pub token_hash: String,
    pub user_id: i32,
    pub device_info: Option<String>,
    pub user_agent: Option<String>,
    pub is_revoked: bool,
    pub expires_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
}
