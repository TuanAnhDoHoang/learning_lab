CREATE TABLE room_member (
    room_id INT NOT NULL REFERENCES room(id) ON DELETE CASCADE, 
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_attempt_id  INT REFERENCES exam_attempt(id) ON DELETE CASCADE,
    PRIMARY KEY (room_id, user_id)
);
