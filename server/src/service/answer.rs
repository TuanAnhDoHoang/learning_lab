use diesel::Insertable;
use diesel::QueryableByName;
use crate::schema::answer; 
#[derive(Debug, Insertable, QueryableByName)]
#[table_name="answer"]
pub struct NewAnswer<'a> {
    pub question_id: i32,
    pub content: &'a str
}
