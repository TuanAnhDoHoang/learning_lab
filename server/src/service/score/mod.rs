use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct QuestionScore {
    pub question_id: i32,
    pub answer_id: i32,
}

#[derive(Deserialize, Serialize)]
pub struct DoScoreRequest {
    pub exam_id: i32,
    pub questions: Vec<QuestionScore>,
}

#[derive(Serialize, Deserialize)]
pub struct Score {
    pub score: u32,
    pub sum_of_question: u32,
    pub question_no_answer: Vec<i32>,
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