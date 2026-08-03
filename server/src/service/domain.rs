use diesel::Insertable;
use diesel::QueryableByName;
use crate::schema::domain; 
#[derive(Debug, Insertable, QueryableByName)]
#[table_name="domain"]
pub struct NewDomain<'a> {
    pub name: &'a str,
}
