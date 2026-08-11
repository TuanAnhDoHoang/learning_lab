use std::env;

use crate::schema::refresh_tokens;
use anyhow::anyhow;
use anyhow::Context;
use chrono::NaiveDateTime;
use chrono::Utc;
use diesel::Insertable;
use diesel::PgConnection;
use diesel::QueryableByName;
#[derive(Debug, Insertable, QueryableByName)]
#[table_name = "refresh_tokens"]
pub struct NewRefeshToken<'a> {
    pub token_hash: &'a str,
    pub user_id: i32,
    pub device_info: &'a str,
    pub user_agent: &'a str,
    pub is_revoked: bool,
    pub expires_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
}

use diesel::RunQueryDsl;
use jsonwebtoken::decode;
use jsonwebtoken::encode;
use jsonwebtoken::Algorithm;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::Validation;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use sha2::Sha256;
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i32, // user_id — đủ để identify, các thông tin khác query lại DB nếu cần
    pub name: String,
    pub email: String,
    pub typ: String, // "access" | "refresh" — phân biệt loại token
    pub exp: usize,
}

pub fn new_token(
    userid: i32,
    username: &str,
    email: &str,
    typ: &str,
    expires_time: NaiveDateTime,
) -> anyhow::Result<String> {
    let claims = Claims {
        sub: userid,
        name: username.to_string(),
        email: email.to_string(),
        typ: typ.to_string(),
        exp: expires_time.and_utc().timestamp() as usize,
    };
    let secret_key = env::var("SECRET")?;
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret_key.as_ref()),
    )?;
    Ok(token)
}

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Verify token, chỉ cần secret + expected type — KHÔNG cần biết trước userid/username/email.
/// Trả về Claims đã decode để caller tự lấy thông tin user ra dùng.
pub fn verify_token(token: &str, expected_typ: &str) -> anyhow::Result<Claims> {
    let secret = env::var("SECRET")?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .context(format!("Error during decoding token {}", expected_typ))?;

    if token_data.claims.typ != expected_typ {
        return Err(anyhow!("Invalid token type"));
    }

    Ok(token_data.claims)
}

pub fn insert_token(userid: i32, hash_token: &str, expires_time: NaiveDateTime, conn: &mut PgConnection) -> anyhow::Result<()> {
    let new_refresh_token_row = NewRefeshToken {
        user_id: userid,
        token_hash: hash_token,
        is_revoked: false,
        device_info: "",
        user_agent: "",
        expires_at: expires_time,
        created_at: Utc::now().naive_utc(),
    };

    diesel::insert_into(refresh_tokens::table)
        .values(&new_refresh_token_row)
        .execute(conn)?;
    Ok(())
}


#[derive(Deserialize)]
pub struct RefeshRequest {
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct RefeshResponse {
    pub refresh_token: String,
    pub access_token: String,
}
