use chrono::NaiveDateTime;
use diesel::{Insertable, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::{
    postgres::schema::ExamAttempt, schema::exam_attempt::{self}, service::exam::ExamContent,
};
use crate::schema::{question, answer_map, answer_history};
use chrono::Utc;
use diesel::prelude::*;

#[derive(Deserialize)]
pub struct CreateExamAttemptRequest {
    pub exam_id: i32,
}

#[derive(Serialize)]
pub struct CreateExamAttemptResponse {
    pub exam_attempt_id: i32,
    pub exam_content: ExamContent
}

#[derive(Deserialize)]
pub struct GetTimeAttemptEndRequest {
    pub exam_attempt_id: i32,
}

#[derive(Serialize)]
pub struct GetTimeAttemptEndResponse {
    pub now: i64,
    pub time_end: i64,
}

#[derive(Deserialize)]
pub struct GetAttemptRequest {
    pub exam_attempt_id: i32,
}

#[derive(Serialize)]
pub struct GetAttemptResponse {
    pub question: String,
    pub answers: Vec<String>,
    pub user_answer: Option<usize>,
}

#[derive(Deserialize)]
pub struct AttemptScoreRequest {
    pub exam_attempt_id: i32,
}

#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = exam_attempt)]
pub struct NewExamAttempt {
    pub exam_id: i32,
    pub user_id: i32,
    pub mark: Option<i32>,
    pub time_start: NaiveDateTime,
    pub time_end: NaiveDateTime,
    pub attempt_time: Option<NaiveDateTime>,
}

pub fn new_exam_attempt(
    exam_id: i32,
    user_id: i32,
    time_start: NaiveDateTime,
    time_end: NaiveDateTime,
    conn: &mut PgConnection,
) -> anyhow::Result<ExamAttempt> {
    let new_exam_attempt = NewExamAttempt {
        exam_id,
        user_id,
        mark: None,
        time_start,
        time_end,
        attempt_time: None,
    };

    let exam_attempt_inserted: ExamAttempt = diesel::insert_into(exam_attempt::table)
        .values(&new_exam_attempt)
        .get_result(conn)?;

    Ok(exam_attempt_inserted)
}

pub fn score_and_save_attempt(
    exam_attempt_id: i32,
    user_id: i32,
    conn: &mut PgConnection,
) -> Result<(u32, u32), diesel::result::Error> {
    conn.transaction::<(u32, u32), diesel::result::Error, _>(|conn| {
        // ensure the attempt belongs to the provided user
        let attempt = exam_attempt::table
            .filter(exam_attempt::id.eq(exam_attempt_id))
            .filter(exam_attempt::user_id.eq(user_id))
            .get_result::<ExamAttempt>(conn)?;

        let questions = question::table
            .filter(question::exam_id.eq(attempt.exam_id))
            .load::<crate::postgres::schema::Question>(conn)?;

        let total_questions = questions.len() as u32;
        let mut correct_count = 0u32;

        for q in questions {
            let right_answer_id = answer_map::table
                .filter(answer_map::question_id.eq(q.id))
                .select(answer_map::answer_id)
                .get_result::<i32>(conn)?;

            let user_answer_id = answer_history::table
                .filter(answer_history::exam_attempt_id.eq(exam_attempt_id))
                .filter(answer_history::question_id.eq(q.id))
                .order(answer_history::time.desc())
                .select(answer_history::answer_id)
                .first::<i32>(conn)
                .optional()?;

            if user_answer_id == Some(right_answer_id) {
                correct_count += 1;
            }
        }

        diesel::update(exam_attempt::table.filter(exam_attempt::id.eq(exam_attempt_id)))
            .set((
                exam_attempt::mark.eq(Some(correct_count as i32)),
                exam_attempt::attempt_time.eq(Some(Utc::now().naive_utc())),
            ))
            .execute(conn)?;

        Ok((correct_count, total_questions))
    })
}

pub fn get_score_by_user_and_room(
    user_id: i32,
    room_id: i32,
    conn: &mut PgConnection,
) -> anyhow::Result<Option<(i32, i32)>> {
    use crate::schema::{room, exam_attempt, question, room_member};

    // find room to get exam_id
    let room_row = room::table
        .filter(room::id.eq(room_id))
        .first::<crate::postgres::schema::Room>(conn)
        .map_err(|e| anyhow::anyhow!("Failed to find room {}: {}", room_id, e))?;

    // read exam_attempt_id from room_member for this user+room
    let attempt_id_opt = room_member::table
        .filter(room_member::room_id.eq(room_id))
        .filter(room_member::user_id.eq(user_id))
        .select(room_member::exam_attempt_id)
        .first::<Option<i32>>(conn)
        .optional()?;

    if let Some(Some(attempt_id)) = attempt_id_opt {
        // load mark for that attempt
        let mark = exam_attempt::table
            .filter(exam_attempt::id.eq(attempt_id))
            .select(exam_attempt::mark)
            .first::<Option<i32>>(conn)?;

        let total = question::table
            .filter(question::exam_id.eq(room_row.exam_id))
            .load::<crate::postgres::schema::Question>(conn)?
            .len() as i32;

        if let Some(m) = mark {
            return Ok(Some((m, total)));
        }
    }

    Ok(None)
}