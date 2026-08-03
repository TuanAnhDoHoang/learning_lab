use diesel::Queryable;
#[derive(Debug, Queryable)]
pub struct Domain {
    pub id: i32,
    pub name: String,
}

#[derive(Debug, Queryable)]
pub struct Exam {
    pub id: i32,
    pub domain_id: i32,
    pub name: String
}

#[derive(Debug, Queryable)]
pub struct Question {
    pub id: i32,
    pub exam_id: i32,
    pub content: String,
}

#[derive(Debug, Queryable)]
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
