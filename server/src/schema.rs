// @generated automatically by Diesel CLI.

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
    }
}

diesel::table! {
    question (id) {
        id -> Int4,
        exam_id -> Int4,
        content -> Text,
    }
}

diesel::joinable!(answer -> question (question_id));
diesel::joinable!(exam -> domain (domain_id));
diesel::joinable!(question -> exam (exam_id));

diesel::allow_tables_to_appear_in_same_query!(answer, answer_map, domain, exam, question,);
