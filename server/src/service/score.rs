use serde::{Deserialize, Serialize};

use crate::service::question::QuestionRequest;

#[derive(Deserialize, Serialize)]
pub struct DoScoreRequest {
    pub exam_id: i32,
    pub questions: Vec<QuestionRequest>,
}

#[derive(Serialize, Deserialize)]
pub struct Score {
    pub score: u32,
    pub sum_of_question: u32,
}

#[derive(Serialize, Deserialize)]
pub struct MemberScore {
    pub user_id: i32,
    pub score: Option<Score>,
}

#[derive(Serialize, Deserialize)]
pub struct RoomScoresResponse {
    pub room_id: i32,
    pub members: Vec<MemberScore>,
}