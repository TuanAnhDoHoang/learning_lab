use diesel::Insertable;
use diesel::QueryableByName;
use crate::schema::question; 
#[derive(Debug, Insertable, QueryableByName)]
#[table_name="question"]
pub struct NewQuestion<'a> {
    pub exam_id: i32,
    pub content: &'a str
}
