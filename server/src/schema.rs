// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "user_role"))]
    pub struct UserRole;
}

diesel::table! {
    answer (id) {
        id -> Int4,
        question_id -> Int4,
        content -> Text,
    }
}

diesel::table! {
    answer_map (question_id, answer_id) {
        question_id -> Int4,
        answer_id -> Int4,
    }
}

diesel::table! {
    domain (id) {
        id -> Int4,
        #[max_length = 255]
        name -> Varchar,
    }
}

diesel::table! {
    exam (id) {
        id -> Int4,
        domain_id -> Int4,
        name -> Text,
        duration -> Int4,
    }
}

diesel::table! {
    question (id) {
        id -> Int4,
        exam_id -> Int4,
        content -> Text,
    }
}

diesel::table! {
    refresh_tokens (id) {
        id -> Int4,
        token_hash -> Text,
        user_id -> Int4,
        device_info -> Nullable<Text>,
        user_agent -> Nullable<Text>,
        is_revoked -> Bool,
        expires_at -> Timestamp,
        created_at -> Timestamp,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::UserRole;

    users (id) {
        id -> Int4,
        email -> Text,
        name -> Text,
        password -> Text,
        role -> UserRole,
    }
}

diesel::joinable!(answer -> question (question_id));
diesel::joinable!(exam -> domain (domain_id));
diesel::joinable!(question -> exam (exam_id));
diesel::joinable!(refresh_tokens -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    answer,
    answer_map,
    domain,
    exam,
    question,
    refresh_tokens,
    users,
);
