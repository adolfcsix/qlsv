CREATE TABLE IF NOT EXISTS room_settings (
  room_id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(room_id) REFERENCES rooms(room_id),
  CHECK(enabled IN (0,1))
);
CREATE TABLE IF NOT EXISTS room_usage_history (
  room_id INTEGER PRIMARY KEY,
  FOREIGN KEY(room_id) REFERENCES rooms(room_id)
);
