use axum::{extract::State, http::StatusCode, Json};
use chrono::{TimeDelta, Utc};
use diesel::{query_dsl::methods::FilterDsl, ExpressionMethods, RunQueryDsl};

use crate::{
    AppState, postgres::schema::RefeshToken, schema::refresh_tokens, service::{token::{self, RefeshRequest, RefeshResponse}, users::find_user_by_id},
};

pub async fn refresh(
    State(app_state): State<AppState>,
    Json(req): Json<RefeshRequest>,
) -> Result<Json<RefeshResponse>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let refresh_token_hash = token::hash_token(&req.refresh_token);

    let refresh_token_stored = refresh_tokens::table
        .filter(refresh_tokens::token_hash.eq(refresh_token_hash))
        .filter(refresh_tokens::is_revoked.eq(false))
        .get_result::<RefeshToken>(&mut conn)
        .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid refresh token 1")))?;

    if refresh_token_stored.expires_at < chrono::Utc::now().naive_utc() {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Refresh token đã hết hạn".to_string(),
        ));
    }

    let user = find_user_by_id(refresh_token_stored.user_id, &mut conn)
        .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid refresh token 2")))?;

    let now = Utc::now().naive_utc();
    let refesh_expires_time = now + TimeDelta::days(30);
    let access_expires_time = now + TimeDelta::hours(1);

    let new_access_token = token::new_token(
        user.id,
        &user.name,
        &user.email,
        "access",
        access_expires_time,
    )
    .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid refresh token 3")))?;

    diesel::update(refresh_tokens::table.filter(refresh_tokens::id.eq(refresh_token_stored.id)))
        .set(refresh_tokens::is_revoked.eq(true))
        .execute(&mut conn)
        .ok();


    let refesh_token = token::new_token(
        user.id,
        &user.name,
        &user.email,
        "refresh",
        refesh_expires_time,
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error during create new refesh token".to_string(),
        )
    })?;
    let refesh_token_hash = token::hash_token(&refesh_token);

    token::insert_token(user.id, &refesh_token_hash, refesh_expires_time, &mut conn).map_err(|_e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error saving new refresh token".to_string(),
        )
    })?;

    let response = RefeshResponse{
        access_token: new_access_token,
        refresh_token: refesh_token
    };

    Ok(Json(response))
}
