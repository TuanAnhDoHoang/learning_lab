CREATE TABLE answer (
    id SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    content TEXT NOT NULL
);
