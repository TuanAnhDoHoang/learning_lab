use axum::{
    body::Body,
    extract::{Request, State},
    http::{self, Response, StatusCode},
    middleware::Next,
};
use axum_extra::extract::cookie::Cookie;
use regex::Regex;
use time::Duration;
use validator::{Validate, ValidationError};

use crate::{
    service::{
        token::{self},
        users::{find_user_by_email, ROLE},
    },
    AppState,
};

pub(crate) fn default_cookie<'a>(key: &str, token: String, duration_hrs: i64) -> Cookie<'a> {
    Cookie::build((key.to_string(), token))
        .path("/")
        .http_only(true)
        .max_age(Duration::hours(duration_hrs))
        .secure(if cfg!(debug_assertions) {
            // Safari won't allow secure cookies
            // coming from localhost in debug mode
            false
        } else {
            // Secure cookies in release mode
            true
        })
        .build()
}

type Email = String;
type Password = String;
type Username = String;

#[derive(Debug, Validate)]
pub struct LoginData {
    #[validate(email(message = "Invalid Email"))]
    email: Email,
    #[validate(custom(function = "validate_password"))]
    password: Password,
}

#[derive(Validate)]
pub struct RegisterData {
    #[validate(custom(function = "validate_username"))]
    pub username: Username,
    #[validate(custom(function = "validate_password"))]
    pub password: Password,
    #[validate(email(message = "Invalid Email"))]
    pub email: Email,
    pub role: ROLE,
}

pub trait Credentials {
    fn validate_credentials(&self) -> Result<(), String>;
    fn username(&self) -> Option<Username>;
    fn email(&self) -> Email;
    fn password(&self) -> Password;
}

impl Credentials for RegisterData {
    fn validate_credentials(&self) -> Result<(), String> {
        self.validate().map_err(|e| e.to_string())
    }
    fn username(&self) -> Option<Username> {
        Some(self.username.clone())
    }
    fn email(&self) -> Email {
        self.email.clone()
    }
    fn password(&self) -> Email {
        self.password.clone()
    }
}
impl Credentials for LoginData {
    fn validate_credentials(&self) -> Result<(), String> {
        self.validate().map_err(|e| e.to_string())
    }
    fn username(&self) -> Option<Username> {
        None
    }
    fn email(&self) -> Email {
        self.email.clone()
    }
    fn password(&self) -> Email {
        self.password.clone()
    }
}

const PASSWORD_MIN_LENGHT: usize = 9;

fn validate_password(password: &Password) -> Result<(), ValidationError> {
    if password.len() < PASSWORD_MIN_LENGHT {
        return Err(ValidationError::new("Invalid Password"));
    }

    let has_uppercase = Regex::new(r"[A-Z]").unwrap();
    let has_lowercase = Regex::new(r"[a-z]").unwrap();
    let has_digit = Regex::new(r"\d").unwrap();
    let has_special = Regex::new(r"[@$!%*?&#]").unwrap();

    if has_uppercase.is_match(password)
        && has_lowercase.is_match(password)
        && has_digit.is_match(password)
        && has_special.is_match(password)
    {
        Ok(())
    } else {
        return Err(ValidationError::new("Invalid Password"));
    }
}

const USERNAME_MIN_LENGTH: usize = 3;
const USERNAME_MAX_LENGTH: usize = 32;

fn validate_username(username: &str) -> Result<(), ValidationError> {
    if username.len() < USERNAME_MIN_LENGTH || username.len() > USERNAME_MAX_LENGTH {
        return Err(ValidationError::new("invalid_username_length"));
    }

    let username_regex = Regex::new(r"^[a-zA-Z0-9]+$").unwrap();

    if !username_regex.is_match(username) {
        return Err(ValidationError::new("invalid_username_format"));
    }

    Ok(())
}

pub async fn authorization_middleware(
    State(app_state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response<Body>, (StatusCode, String)> {
    let mut conn = app_state.db_pool.get().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Can not connect to database: {}", e),
        )
    })?;

    let auth_header = req.headers_mut().get(http::header::AUTHORIZATION);
    let auth_header = match auth_header {
        Some(header) => header.to_str().map_err(|_| {
            (
                StatusCode::FORBIDDEN,
                "Empty header is not allowed".to_string(),
            )
        })?,
        None => {
            return Err((
                StatusCode::FORBIDDEN,
                "Please add the JWT token to the header".to_string(),
            ))
        }
    };
    let mut header = auth_header.split_whitespace();
    let (bearer, token) = (header.next(), header.next());

    let bearer = bearer.ok_or((StatusCode::FORBIDDEN, "Missing token".to_string()))?;
    if bearer != "Bearer" {
        return Err((StatusCode::FORBIDDEN, "Missing Bearer".to_string()));
    }

    let token = token.ok_or((StatusCode::FORBIDDEN, "Missing token".to_string()))?;

    let token_data = match token::verify_token(token, "access") {
        Ok(data) => data,
        Err(_) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Unable to decode token".to_string(),
            ))
        }
    };
    // Fetch the user details from the database
    let current_user = match find_user_by_email(&token_data.email, &mut conn) {
        Ok(user) => user,
        Err(_) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "You are not an authorized user".to_string(),
            ))
        }
    };
    req.extensions_mut().insert(current_user);
    Ok(next.run(req).await)
}
