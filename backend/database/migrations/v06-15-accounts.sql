CREATE TABLE IF NOT EXISTS account_archives (
  user_id INTEGER PRIMARY KEY,
  deleted_at VARCHAR(40) NOT NULL,
  deleted_by INTEGER NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(user_id),
  FOREIGN KEY(deleted_by) REFERENCES users(user_id)
);
