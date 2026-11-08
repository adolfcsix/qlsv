CREATE TABLE IF NOT EXISTS schedule_periods (
 schedule_id INTEGER PRIMARY KEY,
 first_period INTEGER,
 lesson_count INTEGER NOT NULL,
 lesson_minutes INTEGER NOT NULL,
 break_minutes INTEGER NOT NULL DEFAULT 0,
 activity VARCHAR(20) NOT NULL DEFAULT 'lecture',
 FOREIGN KEY(schedule_id) REFERENCES class_schedules(schedule_id) ON DELETE CASCADE,
 CHECK(lesson_count BETWEEN 1 AND 20),
 CHECK(lesson_minutes BETWEEN 15 AND 120),
 CHECK(break_minutes BETWEEN 0 AND 180),
 CHECK(first_period IS NULL OR first_period BETWEEN 1 AND 30)
);
