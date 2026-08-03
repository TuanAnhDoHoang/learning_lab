use diesel::Insertable;
use diesel::QueryableByName;
use crate::schema::answer_map; 
#[derive(Debug, Insertable, QueryableByName)]
#[table_name="answer_map"]
pub struct NewAnswerMap{
    pub question_id: i32,
    pub answer_id: i32 
}
