use std::str::FromStr;

use crate::postgres::schema::Users;
use crate::schema::users;
use crate::utils::authentication::RegisterData;
use bcrypt::DEFAULT_COST;
use bcrypt::hash;
use diesel::dsl::exists;
use diesel::query_dsl::methods::FilterDsl;
use diesel::ExpressionMethods;
use diesel::Insertable;
use diesel::PgConnection;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use diesel_derive_enum::DbEnum;
use serde::Deserialize;
use serde::Serialize;
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

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub userid: i32,
    pub username: String,
    pub email: String,
}

pub fn check_email_exist(email: &str, conn: &mut PgConnection) -> anyhow::Result<bool> {
    let email_exists: bool =
        diesel::select(exists(users::table.filter(users::email.eq(email)))).get_result(conn)?;
    Ok(email_exists)
}

pub fn check_username_exist(username: &str, conn: &mut PgConnection) -> anyhow::Result<bool> {
    let username_exist =
        diesel::select(exists(users::table.filter(users::name.eq(username)))).get_result(conn)?;
    Ok(username_exist)
}

pub fn new_user(register_data: RegisterData, conn: &mut PgConnection) -> anyhow::Result<Users> {
    let password_hash = hash(&register_data.password, DEFAULT_COST)?;
    let new_user = NewUsers {
        email: &register_data.email,
        name: &register_data.username,
        password: &password_hash,
        role: register_data.role,
    };

    let user_inserted: Users = diesel::insert_into(users::table)
        .values(new_user)
        .get_result(conn)?;
    Ok(user_inserted)
}


#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub userid: i32,
    pub username: String,
    pub email: String,
    pub refresh_token: String,
    pub access_token: String
}

pub fn find_user_by_email(email: &str, conn: &mut PgConnection) -> anyhow::Result<Users>{
    let user: Users = users::table
        .filter(users::email.eq(email))
        .first(conn)?;
    Ok(user)
}

pub fn find_user_by_id(id: i32, conn: &mut PgConnection) -> anyhow::Result<Users>{
    let user: Users = users::table
        .filter(users::id.eq(id))
        .first(conn)?;
    Ok(user)
}

#[derive(Serialize)]
pub struct ProvidePriviligedResponse{
    pub userid: i32,
    pub role: String
}