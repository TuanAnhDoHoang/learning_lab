// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "room_status"))]
    pub struct RoomStatus;

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
    answer_history (exam_attempt_id, question_id) {
        exam_attempt_id -> Int4,
        question_id -> Int4,
        answer_id -> Int4,
        time -> Timestamp,
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
    exam_attempt (id) {
        id -> Int4,
        exam_id -> Int4,
        user_id -> Int4,
        mark -> Nullable<Int4>,
        time_start -> Timestamp,
        time_end -> Timestamp,
        attempt_time -> Nullable<Timestamp>,
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
    use super::sql_types::RoomStatus;

    room (id) {
        id -> Int4,
        name -> Text,
        owner_id -> Int4,
        status -> RoomStatus,
        code -> Text,
        duration -> Int4,
        exam_id -> Int4,
    }
}

diesel::table! {
    room_member (room_id, user_id) {
        room_id -> Int4,
        user_id -> Int4,
        exam_attempt_id -> Nullable<Int4>,
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
diesel::joinable!(answer_history -> answer (answer_id));
diesel::joinable!(answer_history -> exam_attempt (exam_attempt_id));
diesel::joinable!(answer_history -> question (question_id));
diesel::joinable!(exam -> domain (domain_id));
diesel::joinable!(exam_attempt -> exam (exam_id));
diesel::joinable!(exam_attempt -> users (user_id));
diesel::joinable!(question -> exam (exam_id));
diesel::joinable!(refresh_tokens -> users (user_id));
diesel::joinable!(room -> exam (exam_id));
diesel::joinable!(room -> users (owner_id));
diesel::joinable!(room_member -> exam_attempt (exam_attempt_id));
diesel::joinable!(room_member -> room (room_id));
diesel::joinable!(room_member -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    answer,
    answer_history,
    answer_map,
    domain,
    exam,
    exam_attempt,
    question,
    refresh_tokens,
    room,
    room_member,
    users,
);
