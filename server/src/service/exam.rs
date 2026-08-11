use crate::postgres::schema::Exam;
use crate::schema::exam;
use crate::service::question::QuestionRequest;
use diesel::dsl::exists;
use diesel::query_dsl::methods::FilterDsl;
use diesel::ExpressionMethods;
use diesel::Insertable;
use diesel::PgConnection;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
#[derive(Debug, Insertable, QueryableByName)]
#[table_name = "exam"]
pub struct NewExam {
    pub domain_id: i32,
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateExamRequest {
    pub exam_name: String,
    pub domain: String,
    pub questions: Vec<QuestionRequest>,
}

#[derive(Serialize)]
pub struct CreateExamResponse {
    pub exam_id: i32,
}

pub fn new_exam(domain_id: i32, exam_name: &str, conn: &mut PgConnection) -> anyhow::Result<Exam> {
    let new_exam: NewExam = NewExam {
        domain_id,
        name: exam_name.to_string(),
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
