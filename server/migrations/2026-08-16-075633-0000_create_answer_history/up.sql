CREATE TABLE answer_history (
    exam_attempt_id INT NOT NULL REFERENCES exam_attempt(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    answer_id INT NOT NULL REFERENCES answer(id) ON DELETE CASCADE,
    time TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (exam_attempt_id, question_id)
);
