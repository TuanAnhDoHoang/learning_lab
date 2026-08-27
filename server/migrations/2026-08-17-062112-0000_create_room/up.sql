CREATE TYPE room_status AS ENUM ('open', 'ongoing', 'closed');

CREATE TABLE room (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status room_status NOT NULL DEFAULT 'open',
    code TEXT NOT NULL UNIQUE,
    duration INT NOT NULL, --Tính theo phút 
    exam_id INT NOT NULL REFERENCES exam(id) ON DELETE CASCADE
);