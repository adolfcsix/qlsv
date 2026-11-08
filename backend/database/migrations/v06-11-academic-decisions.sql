-- V06.11: Three extension tables. Original 36-table QLSV schema is unchanged.
-- SQLite syntax; the database initializer translates the auto-increment type for MySQL.
CREATE TABLE IF NOT EXISTS curriculum_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_curriculum_id INTEGER NOT NULL,
  target_curriculum_id INTEGER NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  note VARCHAR(500) NOT NULL,
  created_by INTEGER NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  approved_by INTEGER NULL,
  approved_at VARCHAR(40) NULL,
  FOREIGN KEY (source_curriculum_id) REFERENCES curricula(curriculum_id),
  FOREIGN KEY (target_curriculum_id) REFERENCES curricula(curriculum_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  CHECK (status IN ('draft','approved'))
);
CREATE TABLE IF NOT EXISTS credit_recognitions (
  recognition_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  target_assignment_id INTEGER NOT NULL,
  source_result_id INTEGER NOT NULL,
  decision_number VARCHAR(100) NOT NULL,
  decision_date DATE NOT NULL,
  explanation VARCHAR(500) NOT NULL,
  approved_by INTEGER NOT NULL,
  approved_at VARCHAR(40) NOT NULL,
  revoked_by INTEGER NULL,
  revoked_at VARCHAR(40) NULL,
  revoke_reason VARCHAR(500) NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (target_assignment_id) REFERENCES curriculum_subjects(curriculum_subject_id),
  FOREIGN KEY (source_result_id) REFERENCES course_results(result_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  FOREIGN KEY (revoked_by) REFERENCES users(user_id),
  CHECK ((revoked_by IS NULL AND revoked_at IS NULL AND revoke_reason IS NULL) OR
         (revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND revoke_reason IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS graduation_reviews (
  review_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  curriculum_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  academic_snapshot TEXT NOT NULL,
  external_checks TEXT NULL,
  review_note VARCHAR(1000) NULL,
  created_by INTEGER NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  approved_by INTEGER NULL,
  approved_at VARCHAR(40) NULL,
  decision_id INTEGER NULL UNIQUE,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (curriculum_id) REFERENCES curricula(curriculum_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  FOREIGN KEY (decision_id) REFERENCES student_decisions(decision_id),
  CHECK (status IN ('draft','approved','rejected'))
);
