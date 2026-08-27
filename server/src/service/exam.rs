use crate::postgres::schema::Answer;
use crate::postgres::schema::Exam;
use crate::postgres::schema::Question;
use crate::schema::answer;
use crate::schema::exam;
use crate::schema::question;
use crate::service::question::QuestionAnswer;
use crate::service::question::QuestionRequest;
use diesel::dsl::exists;
use diesel::query_dsl::methods::FilterDsl;
use diesel::ExpressionMethods;
use diesel::Insertable;
use diesel::PgConnection;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use diesel::sql_query;
use serde::Deserialize;
use serde::Serialize;
#[derive(Debug, Insertable, QueryableByName)]
#[table_name = "exam"]
pub struct NewExam {
    pub domain_id: i32,
    pub name: String,
    pub duration: i32
}

#[derive(Deserialize)]
pub struct CreateExamRequest {
    pub exam_name: String,
    pub domain: String,
    pub questions: Vec<QuestionRequest>,
    pub duration: i32
}

#[derive(Serialize)]
pub struct CreateExamResponse {
    pub exam_id: i32,
}

pub fn new_exam(domain_id: i32, exam_name: &str, test_duration: i32, conn: &mut PgConnection) -> anyhow::Result<Exam> {
    let new_exam: NewExam = NewExam {
        domain_id,
        name: exam_name.to_string(),
        duration: test_duration
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

pub fn get_exam_by_id(exam_id: i32, conn: &mut PgConnection) -> anyhow::Result<Exam>{
    let exam = exam::table.filter(exam::id.eq(exam_id)).first::<Exam>(conn)?;
   Ok(exam) 
}

#[derive(Serialize)]
pub struct ExamContent{
    exam_id: i32,
    questions: Vec<QuestionAnswer>
}

pub async fn get_exam_content_by_id(exam_id:i32, conn: &mut PgConnection) -> anyhow::Result<ExamContent>{
    let questions = question::table
        .filter(question::exam_id.eq(exam_id))
        .load::<Question>(conn)?;

    let mut exam_content = ExamContent {
        exam_id,
        questions: Vec::new()
    };

    for question in questions {
        let answers = answer::table
            .filter(answer::question_id.eq(question.id))
            .load::<Answer>(conn)?;

        exam_content.questions.push(QuestionAnswer { question, answers });
    }

    Ok(exam_content)
}
