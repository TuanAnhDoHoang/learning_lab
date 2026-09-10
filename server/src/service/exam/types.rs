use serde::{Deserialize, Serialize};

use crate::service::question::QuestionRequest;

#[derive(Deserialize)]
pub struct CreateExamByImageRequest {
    pub exam_name: String,
    pub domain: String,
    pub answers: Vec<u8>,
    pub duration: i32,
}

#[derive(Deserialize)]
pub struct CreateExamRequest {
    pub exam_name: String,
    pub domain: String,
    pub questions: Vec<QuestionRequest>,
    pub duration: i32,
}

#[derive(Serialize)]
pub struct CreateExamResponse {
    pub exam_id: i32,
}

#[derive(Serialize)]
pub struct ExamContent {
    pub exam_id: i32,
    pub questions: Vec<crate::service::question::QuestionAnswer>,
}
