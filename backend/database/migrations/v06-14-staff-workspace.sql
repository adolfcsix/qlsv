CREATE TABLE IF NOT EXISTS group_settings (
  student_group_id INTEGER PRIMARY KEY,
  capacity INTEGER NOT NULL DEFAULT 50,
  FOREIGN KEY(student_group_id) REFERENCES student_groups(student_group_id),
  CHECK(capacity BETWEEN 1 AND 1000)
);
CREATE TABLE IF NOT EXISTS student_photos (
  student_id INTEGER PRIMARY KEY,
  data_url MEDIUMTEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER NOT NULL,
  FOREIGN KEY(student_id) REFERENCES students(student_id),
  FOREIGN KEY(updated_by) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS section_targets (
  class_id INTEGER NOT NULL,
  student_group_id INTEGER NOT NULL,
  PRIMARY KEY(class_id, student_group_id),
  FOREIGN KEY(class_id) REFERENCES classes(class_id),
  FOREIGN KEY(student_group_id) REFERENCES student_groups(student_group_id)
);
CREATE TABLE IF NOT EXISTS schedule_teachers (
  schedule_id INTEGER NOT NULL,
  lecturer_id INTEGER NOT NULL,
  PRIMARY KEY(schedule_id, lecturer_id),
  FOREIGN KEY(schedule_id) REFERENCES class_schedules(schedule_id),
  FOREIGN KEY(lecturer_id) REFERENCES lecturers(lecturer_id)
);
CREATE TABLE IF NOT EXISTS enrollment_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_at VARCHAR(40) NOT NULL,
  reviewed_at VARCHAR(40) NULL,
  reviewed_by INTEGER NULL,
  reason VARCHAR(1000) NULL,
  enrollment_id INTEGER NULL,
  FOREIGN KEY(student_id) REFERENCES students(student_id),
  FOREIGN KEY(class_id) REFERENCES classes(class_id),
  FOREIGN KEY(reviewed_by) REFERENCES users(user_id),
  FOREIGN KEY(enrollment_id) REFERENCES enrollments(enrollment_id),
  CHECK(status IN ('pending','approved','rejected','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_class_status ON enrollment_requests(class_id,status);
CREATE TABLE IF NOT EXISTS schedule_options (
  schedule_id INTEGER PRIMARY KEY,
  teacher_override INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(schedule_id) REFERENCES class_schedules(schedule_id)
);
CREATE TABLE IF NOT EXISTS schedule_audience_modes (
  schedule_id INTEGER PRIMARY KEY,
  FOREIGN KEY(schedule_id) REFERENCES class_schedules(schedule_id)
);
CREATE TABLE IF NOT EXISTS schedule_audiences (
  schedule_id INTEGER NOT NULL,
  student_group_id INTEGER NOT NULL,
  PRIMARY KEY(schedule_id,student_group_id),
  FOREIGN KEY(schedule_id) REFERENCES class_schedules(schedule_id),
  FOREIGN KEY(student_group_id) REFERENCES student_groups(student_group_id)
);
