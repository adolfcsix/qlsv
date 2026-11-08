CREATE TABLE IF NOT EXISTS ai_action_proposals (
 proposal_id VARCHAR(64) PRIMARY KEY,
 user_id INTEGER NOT NULL,
 actor_role VARCHAR(30) NOT NULL,
 session_hash VARCHAR(128) NOT NULL,
 conversation_id INTEGER,
 action_name VARCHAR(80) NOT NULL,
 payload_json TEXT NOT NULL,
 preview_json TEXT NOT NULL,
 revision INTEGER NOT NULL,
 status VARCHAR(20) NOT NULL,
 expires_at VARCHAR(32) NOT NULL,
 result_json TEXT,
 created_at VARCHAR(32) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(user_id)
);
