CREATE TABLE exam (
    id SERIAL PRIMARY KEY,
    domain_id INT NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration INT NOT NULL --Tính theo phút
);
