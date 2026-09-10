use diesel::{
    dsl::exists, query_dsl::methods::FilterDsl, ExpressionMethods, Insertable, PgConnection,
    QueryableByName, RunQueryDsl,
};

use crate::{
    postgres::schema::{Answer, Exam, Question},
    schema::{answer, exam, question},
    service::question::QuestionAnswer,
};

#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = exam)]
pub struct NewExam {
    pub domain_id: i32,
    pub name: String,
    pub duration: i32,
}

pub fn new_exam(domain_id: i32, exam_name: &str, test_duration: i32, conn: &mut PgConnection) -> anyhow::Result<Exam> {
    let new_exam = NewExam {
        domain_id,
        name: exam_name.to_string(),
        duration: test_duration,
    };

    let inserted_exam: Exam = diesel::insert_into(exam::table)
        .values(&new_exam)
        .get_result(conn)?;
    Ok(inserted_exam)
}

pub fn check_exam_exist(exam_id: i32, conn: &mut PgConnection) -> anyhow::Result<bool> {
    let exam_exist = diesel::select(exists(exam::table.filter(exam::id.eq(exam_id))))
        .get_result::<bool>(conn)?;
    Ok(exam_exist)
}

pub fn get_exam_by_id(exam_id: i32, conn: &mut PgConnection) -> anyhow::Result<Exam> {
    let exam = exam::table.filter(exam::id.eq(exam_id)).first::<Exam>(conn)?;
    Ok(exam)
}

pub async fn get_exam_content_by_id(exam_id: i32, conn: &mut PgConnection) -> anyhow::Result<super::types::ExamContent> {
    let questions = question::table
        .filter(question::exam_id.eq(exam_id))
        .load::<Question>(conn)?;

    let mut exam_content = super::types::ExamContent {
        exam_id,
        questions: Vec::new(),
    };

    for question in questions {
        let answers = answer::table
            .filter(answer::question_id.eq(question.id))
            .load::<Answer>(conn)?;

        exam_content.questions.push(QuestionAnswer { question, answers });
    }

    Ok(exam_content)
}
