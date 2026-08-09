use axum::{extract::State, http::StatusCode, Json};
use axum_extra::extract::CookieJar;
use bcrypt::verify;
use chrono::{TimeDelta, Utc};
use std::str::FromStr;

use crate::{
    postgres::schema::Users,
    service::{
        token::{self, insert_token},
        users::{
            check_email_exist, check_username_exist, find_user_by_email, new_user, LoginRequest,
            LoginResponse, RegisterRequest, RegisterResponse, ROLE,
        },
    },
    utils::authentication::{default_cookie, Credentials, RegisterData},
    AppState,
};

pub async fn register(
    State(app_state): State<AppState>,
    Json(register_request): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let role = ROLE::from_str(&register_request.role).unwrap();
    let register_data = RegisterData {
        email: register_request.email,
        password: register_request.password,
        username: register_request.username,
        role,
    };

    let email_exists: bool = check_email_exist(&register_data.email, &mut conn).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    if email_exists {
        return Err((StatusCode::BAD_REQUEST, format!("Email has existed")));
    }

    let username_exists: bool =
        check_username_exist(&register_data.username, &mut conn).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?;

    if username_exists {
        return Err((StatusCode::BAD_REQUEST, format!("User name has existed")));
    }

    register_data.validate_credentials().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Invalid credentials: {}", e),
        )
    })?;

    let user_inserted = new_user(register_data, &mut conn).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error during create new user: {}", e),
        )
    })?;

    let register_response = RegisterResponse {
        userid: user_inserted.id,
        email: user_inserted.email,
        username: user_inserted.name,
    };

    Ok(Json(register_response))
}

pub async fn login(
    State(app_state): State<AppState>,
    jar: CookieJar,
    Json(login_request): Json<LoginRequest>,
) -> Result<(CookieJar, Json<LoginResponse>), (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    // Tìm user theo email — KHÔNG tiết lộ "email không tồn tại" vs "sai password"
    let user: Users = find_user_by_email(&login_request.email, &mut conn).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            "Invalid email or password".to_string(),
        )
    })?;

    // Verify password
    let is_valid = verify(login_request.password, &user.password).map_err(|_e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error verifying credentials".to_string(),
        )
    })?;

    if !is_valid {
        // Verify password
        return Err((
            StatusCode::UNAUTHORIZED,
            "Invalid email or password".to_string(),
        ));
    }

    //config expire time for tokens
    let now = Utc::now().naive_utc();
    let refesh_expires_time = now + TimeDelta::days(30);
    let access_expires_time = now + TimeDelta::hours(1);

    let refesh_token = token::new_token(
        user.id,
        &user.name,
        &user.email,
        "access",
        refesh_expires_time,
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error during create new refesh token".to_string(),
        )
    })?;
    let refesh_token_hash = token::hash_token(&refesh_token);

    insert_token(user.id, &refesh_token_hash, refesh_expires_time, &mut conn).map_err(|_e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error saving new refresh token".to_string(),
        )
    })?;

    let access_token = token::new_token(
        user.id,
        &user.name,
        &user.email,
        "access",
        access_expires_time,
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error during create new refesh token".to_string(),
        )
    })?;

    let access_max_age_hours = (access_expires_time - now).num_hours(); // = 1
    let refesh_max_age_hours = (refesh_expires_time - now).num_hours(); // = 720
    let cookie = jar
        .add(default_cookie(
            "access_token",
            access_token,
            access_max_age_hours,
        ))
        .add(default_cookie(
            "refesh_token",
            refesh_token,
            refesh_max_age_hours,
        ));

    let login_response = LoginResponse {
        email: user.email,
        userid: user.id,
        username: user.name,
    };
    Ok((cookie, Json(login_response)))
}
