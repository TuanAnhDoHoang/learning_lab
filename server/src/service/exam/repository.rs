use anyhow::anyhow;
use diesel::PgConnection;

use crate::{
    service::{
        answer::new_answer,
        answer_map::new_answer_map,
        domain::{get_existed_domain, new_domain},
        question::new_question,
    },
    utils::ocr::ParsedQuestion,
};

use super::{crud::new_exam, types::CreateExamByImageRequest};

/// Creates a full exam record including domain, questions, answers, and answer mapping.
///
/// This function keeps the current business behavior unchanged: it ensures the domain exists,
/// creates the exam, inserts each OCR-extracted question, persists all answer options, and records
/// the correct answer map for each question.
///
/// # Arguments
/// - `conn`: mutable PostgreSQL connection used for the whole transaction.
/// - `payload`: the request data containing `exam_name`, `domain`, `duration`, and correct answer indices.
/// - `parsed_questions`: OCR-extracted questions and their multiple choices.
///
/// # Returns
/// - `Ok(i32)`: the created exam ID.
/// - `Err(anyhow::Error)`: database/write error or invalid correct-answer index.
pub fn create_exam_from_parsed_questions(
    conn: &mut PgConnection,
    owner_id: i32,
    payload: &CreateExamByImageRequest,
    parsed_questions: &[ParsedQuestion],
) -> anyhow::Result<i32> {
    let domain_existed = get_existed_domain(&payload.domain, conn)?;
    let domain_id = match domain_existed {
        Some(domain) => domain.id,
        None => {
            let domain = new_domain(&payload.domain, conn)?;
            domain.id
        }
    };

    let created_exam = new_exam(owner_id, domain_id, &payload.exam_name, payload.duration, conn)?;

    for (question_index, question) in parsed_questions.iter().enumerate() {
        let created_question = new_question(created_exam.id, question.question.as_str(), conn)?;

        let mut answer_ids = Vec::new();
        for answer_str in &question.answers {
            let created_answer = new_answer(created_question.id, answer_str.as_str(), conn)?;
            answer_ids.push(created_answer.id);
        }

        let Some(right_index) = payload.answers.get(question_index).copied() else {
            continue;
        };

        let right_index = right_index as usize;
        let Some(right_answer_id) = answer_ids.get(right_index).copied() else {
            continue;
        };

        new_answer_map(created_question.id, right_answer_id, conn)?;
    }

    Ok(created_exam.id)
}
