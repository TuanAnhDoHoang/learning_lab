use diesel::Insertable;
use diesel::QueryableByName;
use crate::schema::exam; 
#[derive(Debug, Insertable, QueryableByName)]
#[table_name="exam"]
pub struct NewExam {
    pub domain_id: i32,
    pub name: String,
}
