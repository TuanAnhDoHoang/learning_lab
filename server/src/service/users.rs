use std::str::FromStr;

use crate::schema::users;
use diesel::Insertable;
use diesel::QueryableByName;
use diesel_derive_enum::DbEnum;
#[derive(Debug, Insertable, QueryableByName)]
#[diesel(table_name = users)]
pub struct NewUsers<'a> {
    pub email: &'a str,
    pub name: &'a str,
    pub password: &'a str,
    pub role: ROLE,
}

#[derive(Debug, Clone, PartialEq, DbEnum)]
#[ExistingTypePath = "crate::schema::sql_types::UserRole"]
pub enum ROLE {
    #[db_rename = "user"]
    USER,
    #[db_rename = "admin"]
    ADMIN,
}
impl std::fmt::Display for ROLE {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            ROLE::USER => "user",
            ROLE::ADMIN => "admin",
        })
    }
}
impl FromStr for ROLE {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "user" => Ok(ROLE::USER),
            "admin" => Ok(ROLE::ADMIN),
            _ => Err(format!("Unknown role: {}", s)),
        }
    }
}
