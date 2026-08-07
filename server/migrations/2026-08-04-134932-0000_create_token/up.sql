-- Your SQL goes here
CREATE TABLE refresh_tokens (
    id            SERIAL PRIMARY KEY,
    token_hash    TEXT NOT NULL UNIQUE,   -- lưu hash, không lưu token gốc
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info   TEXT,
    user_agent    TEXT,
    is_revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at    TIMESTAMP NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);