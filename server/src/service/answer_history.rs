use chrono::{NaiveDateTime, Utc};
use diesel::{ExpressionMethods, Insertable, PgConnection, RunQueryDsl, query_dsl::methods::FilterDsl};

use crate::{
    postgres::schema::{AnswerHistory, ExamAttempt},
    schema::{answer_history, exam_attempt},
};

#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = answer_history)]
pub struct NewAnswerHistory {
    pub exam_attempt_id: i32,
    pub question_id: i32,
    pub answer_id: i32,
    pub time: NaiveDateTime,
}

pub fn new_answer_history(
    exam_attempt_id: i32,
    question_id: i32,
    answer_id: i32,
    conn: &mut PgConnection,
) -> anyhow::Result<AnswerHistory> {
    let attempt: ExamAttempt = exam_attempt::table
        .filter(exam_attempt::id.eq(exam_attempt_id))
        .first(conn)?;

    let now = Utc::now().naive_utc();

    if now > attempt.time_end {
        anyhow::bail!("Exam time is over, cannot save answer");
    }

    let existing = answer_history::table
        .filter(answer_history::exam_attempt_id.eq(exam_attempt_id))
        .filter(answer_history::question_id.eq(question_id))
        .first::<AnswerHistory>(conn)
        .ok();

    match existing {
        Some(existing_row) => {
            if existing_row.answer_id == answer_id {
                return Ok(existing_row);
            }

            let updated = diesel::update(
                answer_history::table
                    .filter(answer_history::exam_attempt_id.eq(exam_attempt_id))
                    .filter(answer_history::question_id.eq(question_id)),
            )
            .set((
                answer_history::answer_id.eq(answer_id),
                answer_history::time.eq(now),
            ))
            .get_result::<AnswerHistory>(conn)?;

            Ok(updated)
        }
        None => {
            let inserted = NewAnswerHistory {
                exam_attempt_id,
                question_id,
                answer_id,
                time: now,
            };

            let saved: AnswerHistory = diesel::insert_into(answer_history::table)
                .values(&inserted)
                .get_result(conn)?;

            Ok(saved)
        }
    }
}