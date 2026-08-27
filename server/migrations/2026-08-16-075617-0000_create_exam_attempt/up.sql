CREATE TABLE exam_attempt (
    id SERIAL PRIMARY KEY,
    exam_id INT NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mark INT,
    time_start TIMESTAMP NOT NULL,
    time_end TIMESTAMP NOT NULL,
    attempt_time TIMESTAMP
);