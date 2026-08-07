use axum_extra::extract::cookie::Cookie;
use regex::Regex;
use time::Duration;
use validator::{Validate, ValidationError};

use crate::service::users::ROLE;

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