CREATE TABLE answer_map (
    question_id INTEGER NOT NULL,
    answer_id INTEGER NOT NULL,
    PRIMARY KEY (question_id, answer_id) -- Khóa chính hỗn hợp
);

