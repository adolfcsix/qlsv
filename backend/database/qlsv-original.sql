
CREATE DATABASE IF NOT EXISTS qlsv
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE qlsv;

SET NAMES utf8mb4;

-- 1. ROLES - VAI TRÒ

CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,

    CONSTRAINT uq_roles_name UNIQUE (name)
) ENGINE = InnoDB;

-- 2. USERS - TÀI KHOẢN

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    status ENUM('active', 'locked') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
) ENGINE = InnoDB;

-- 3. DEPARTMENTS - KHOA

CREATE TABLE departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,

    CONSTRAINT uq_departments_code UNIQUE (department_code)
) ENGINE = InnoDB;

-- 4. MAJORS - NGÀNH

CREATE TABLE majors (
    major_id INT AUTO_INCREMENT PRIMARY KEY,
    major_code VARCHAR(30) NOT NULL,
    name VARCHAR(200) NOT NULL,
    department_id INT NOT NULL,

    CONSTRAINT uq_majors_code UNIQUE (major_code),

    CONSTRAINT fk_majors_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
) ENGINE = InnoDB;

-- 5. ACADEMIC_YEARS - NĂM HỌC

CREATE TABLE academic_years (
    academic_year_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    CONSTRAINT uq_academic_years_name UNIQUE (name),

    CONSTRAINT chk_academic_years_dates
        CHECK (end_date > start_date)
) ENGINE = InnoDB;

-- 6. SEMESTERS - HỌC KỲ

CREATE TABLE semesters (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    academic_year_id INT NOT NULL,
    name VARCHAR(60) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_start DATETIME NULL,
    registration_end DATETIME NULL,

    CONSTRAINT uq_semesters_year_name
        UNIQUE (academic_year_id, name),

    CONSTRAINT fk_semesters_year
        FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(academic_year_id),

    CONSTRAINT chk_semesters_dates
        CHECK (end_date > start_date),

    CONSTRAINT chk_semesters_registration
        CHECK (
            (
                registration_start IS NULL
                AND registration_end IS NULL
            )
            OR
            (
                registration_start IS NOT NULL
                AND registration_end IS NOT NULL
                AND registration_end > registration_start
            )
        )
) ENGINE = InnoDB;

-- 7. ACADEMIC_POLICIES - PHIÊN BẢN QUY TẮC ĐÀO TẠO
-- Mỗi phiên bản sử dụng một code riêng.
-- Không sửa phiên bản đã được sử dụng để chốt kết quả.

CREATE TABLE academic_policies (
    policy_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    rules JSON NOT NULL,
    approved_by INT NULL,
    approved_at DATETIME NULL,

    CONSTRAINT uq_academic_policies_code UNIQUE (code),

    CONSTRAINT fk_academic_policies_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_academic_policies_rules
        CHECK (JSON_TYPE(rules) = 'OBJECT'),

    CONSTRAINT chk_academic_policies_approval
        CHECK (
            (
                approved_by IS NULL
                AND approved_at IS NULL
            )
            OR
            (
                approved_by IS NOT NULL
                AND approved_at IS NOT NULL
            )
        )
) ENGINE = InnoDB;

-- 8. CURRICULA - CHƯƠNG TRÌNH ĐÀO TẠO

CREATE TABLE curricula (
    curriculum_id INT AUTO_INCREMENT PRIMARY KEY,
    major_id INT NOT NULL,
    policy_id INT NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    admission_year SMALLINT NOT NULL,
    required_credits SMALLINT NOT NULL,

    CONSTRAINT uq_curricula_code UNIQUE (code),

    CONSTRAINT fk_curricula_major
        FOREIGN KEY (major_id)
        REFERENCES majors(major_id),

    CONSTRAINT fk_curricula_policy
        FOREIGN KEY (policy_id)
        REFERENCES academic_policies(policy_id),

    CONSTRAINT chk_curricula_admission_year
        CHECK (admission_year > 0),

    CONSTRAINT chk_curricula_credits
        CHECK (required_credits > 0)
) ENGINE = InnoDB;

-- 9. LECTURERS - GIẢNG VIÊN

CREATE TABLE lecturers (
    lecturer_id INT AUTO_INCREMENT PRIMARY KEY,
    lecturer_code VARCHAR(30) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    department_id INT NOT NULL,
    user_id INT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,

    CONSTRAINT uq_lecturers_code UNIQUE (lecturer_code),
    CONSTRAINT uq_lecturers_user UNIQUE (user_id),

    CONSTRAINT fk_lecturers_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id),

    CONSTRAINT fk_lecturers_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
) ENGINE = InnoDB;

-- 10. STUDENT_GROUPS - LỚP HÀNH CHÍNH

CREATE TABLE student_groups (
    student_group_id INT AUTO_INCREMENT PRIMARY KEY,
    group_code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    curriculum_id INT NOT NULL,
    advisor_lecturer_id INT NULL,

    CONSTRAINT uq_student_groups_code UNIQUE (group_code),

    CONSTRAINT fk_student_groups_curriculum
        FOREIGN KEY (curriculum_id)
        REFERENCES curricula(curriculum_id),

    CONSTRAINT fk_student_groups_advisor
        FOREIGN KEY (advisor_lecturer_id)
        REFERENCES lecturers(lecturer_id)
) ENGINE = InnoDB;

-- 11. STUDENTS - HỒ SƠ SINH VIÊN

CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    student_code VARCHAR(30) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(30) NULL,
    birthplace VARCHAR(200) NULL,
    hometown VARCHAR(255) NULL,
    nationality VARCHAR(80) NULL,
    ethnicity VARCHAR(80) NULL,
    identity_number VARCHAR(30) NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,
    permanent_address VARCHAR(500) NULL,
    current_address VARCHAR(500) NULL,
    avatar_url VARCHAR(500) NULL,
    admission_date DATE NOT NULL,
    student_group_id INT NOT NULL,
    user_id INT NULL,
    status ENUM(
        'studying',
        'on_leave',
        'suspended',
        'withdrawn',
        'graduated'
    ) NOT NULL DEFAULT 'studying',

    CONSTRAINT uq_students_code UNIQUE (student_code),
    CONSTRAINT uq_students_user UNIQUE (user_id),

    CONSTRAINT fk_students_group
        FOREIGN KEY (student_group_id)
        REFERENCES student_groups(student_group_id),

    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_students_birth_date
        CHECK (
            date_of_birth IS NULL
            OR date_of_birth < admission_date
        ),

    INDEX idx_students_full_name (full_name),
    INDEX idx_students_group_status (student_group_id, status)
) ENGINE = InnoDB;

-- 12. STUDENT_CONTACTS - NGƯỜI LIÊN HỆ SINH VIÊN

CREATE TABLE student_contacts (
    contact_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    relationship VARCHAR(60) NOT NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(500) NULL,
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_student_contacts_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT chk_student_contacts_emergency
        CHECK (is_emergency IN (0, 1))
) ENGINE = InnoDB;

-- 13. STUDENT_STATUS_HISTORY - LỊCH SỬ HỌC VỤ SINH VIÊN

CREATE TABLE student_status_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    effective_date DATE NOT NULL,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    old_group_id INT NULL,
    new_group_id INT NULL,
    decision_number VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    approved_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_student_history_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT fk_student_history_old_group
        FOREIGN KEY (old_group_id)
        REFERENCES student_groups(student_group_id),

    CONSTRAINT fk_student_history_new_group
        FOREIGN KEY (new_group_id)
        REFERENCES student_groups(student_group_id),

    CONSTRAINT fk_student_history_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_student_history_old_status
        CHECK (
            old_status IS NULL
            OR old_status IN (
                'studying', 'on_leave', 'suspended',
                'withdrawn', 'graduated'
            )
        ),

    CONSTRAINT chk_student_history_new_status
        CHECK (
            new_status IN (
                'studying', 'on_leave', 'suspended',
                'withdrawn', 'graduated'
            )
        ),

    INDEX idx_student_history_effective (student_id, effective_date)
) ENGINE = InnoDB;

-- 14. SUBJECTS - HỌC PHẦN

CREATE TABLE subjects (
    subject_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(40) NOT NULL,
    name VARCHAR(200) NOT NULL,
    department_id INT NOT NULL,
    credits SMALLINT NOT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    CONSTRAINT uq_subjects_code UNIQUE (subject_code),

    CONSTRAINT fk_subjects_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id),

    CONSTRAINT chk_subjects_credits CHECK (credits > 0)
) ENGINE = InnoDB;

-- 15. ELECTIVE_GROUPS - NHÓM HỌC PHẦN TỰ CHỌN
-- Tạo trước curriculum_subjects để có thể khai báo FK.

CREATE TABLE elective_groups (
    elective_group_id INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id INT NOT NULL,
    code VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    minimum_credits SMALLINT NOT NULL,

    CONSTRAINT uq_elective_groups_code
        UNIQUE (curriculum_id, code),

    CONSTRAINT uq_elective_groups_curriculum_id
        UNIQUE (curriculum_id, elective_group_id),

    CONSTRAINT fk_elective_groups_curriculum
        FOREIGN KEY (curriculum_id)
        REFERENCES curricula(curriculum_id),

    CONSTRAINT chk_elective_groups_credits
        CHECK (minimum_credits > 0)
) ENGINE = InnoDB;

-- 16. CURRICULUM_SUBJECTS - HỌC PHẦN TRONG CHƯƠNG TRÌNH
-- FK ghép bảo đảm nhóm tự chọn thuộc đúng chương trình.

CREATE TABLE curriculum_subjects (
    curriculum_subject_id INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id INT NOT NULL,
    subject_id INT NOT NULL,
    recommended_semester SMALLINT NULL,
    requirement_type ENUM('required', 'elective') NOT NULL,
    elective_group_id INT NULL,

    CONSTRAINT uq_curriculum_subjects
        UNIQUE (curriculum_id, subject_id),

    CONSTRAINT fk_curriculum_subjects_curriculum
        FOREIGN KEY (curriculum_id)
        REFERENCES curricula(curriculum_id),

    CONSTRAINT fk_curriculum_subjects_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id),

    CONSTRAINT fk_curriculum_subjects_elective_group
        FOREIGN KEY (curriculum_id, elective_group_id)
        REFERENCES elective_groups(curriculum_id, elective_group_id),

    CONSTRAINT chk_curriculum_subjects_semester
        CHECK (
            recommended_semester IS NULL
            OR recommended_semester > 0
        ),

    CONSTRAINT chk_curriculum_subjects_requirement
        CHECK (
            (
                requirement_type = 'required'
                AND elective_group_id IS NULL
            )
            OR
            (
                requirement_type = 'elective'
                AND elective_group_id IS NOT NULL
            )
        )
) ENGINE = InnoDB;

-- 17. SUBJECT_PREREQUISITES - HỌC PHẦN TIÊN QUYẾT
-- Backend phải kiểm tra thêm chu trình nhiều học phần.

CREATE TABLE subject_prerequisites (
    subject_id INT NOT NULL,
    prerequisite_subject_id INT NOT NULL,

    PRIMARY KEY (subject_id, prerequisite_subject_id),

    CONSTRAINT fk_prerequisites_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id),

    CONSTRAINT fk_prerequisites_required_subject
        FOREIGN KEY (prerequisite_subject_id)
        REFERENCES subjects(subject_id),

    CONSTRAINT chk_prerequisites_not_self
        CHECK (subject_id <> prerequisite_subject_id)
) ENGINE = InnoDB;

-- 18. ROOMS - PHÒNG HỌC, PHÒNG THI

CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(40) NOT NULL,
    capacity SMALLINT NOT NULL,
    room_type VARCHAR(80) NULL,

    CONSTRAINT uq_rooms_code UNIQUE (room_code),
    CONSTRAINT chk_rooms_capacity CHECK (capacity > 0)
) ENGINE = InnoDB;

-- 19. CLASSES - LỚP HỌC PHẦN

CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    class_code VARCHAR(50) NOT NULL,
    subject_id INT NOT NULL,
    lecturer_id INT NULL,
    semester_id INT NOT NULL,
    capacity SMALLINT NOT NULL,
    status ENUM(
        'open', 'closed', 'teaching', 'completed', 'cancelled'
    ) NOT NULL DEFAULT 'open',

    CONSTRAINT uq_classes_code UNIQUE (class_code),

    CONSTRAINT fk_classes_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id),

    CONSTRAINT fk_classes_lecturer
        FOREIGN KEY (lecturer_id)
        REFERENCES lecturers(lecturer_id),

    CONSTRAINT fk_classes_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id),

    CONSTRAINT chk_classes_capacity CHECK (capacity > 0),

    INDEX idx_classes_semester_subject (semester_id, subject_id)
) ENGINE = InnoDB;

-- 20. CLASS_SCHEDULES - LỊCH HỌC
-- day_of_week: 1 = Thứ Hai, ..., 7 = Chủ nhật.

CREATE TABLE class_schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    room_id INT NOT NULL,
    day_of_week TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    CONSTRAINT fk_class_schedules_class
        FOREIGN KEY (class_id)
        REFERENCES classes(class_id),

    CONSTRAINT fk_class_schedules_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(room_id),

    CONSTRAINT chk_class_schedules_day
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT chk_class_schedules_time
        CHECK (
            start_time >= '00:00:00'
            AND end_time < '24:00:00'
            AND end_time > start_time
        ),

    CONSTRAINT chk_class_schedules_dates
        CHECK (end_date >= start_date),

    INDEX idx_class_schedules_room_day (room_id, day_of_week)
) ENGINE = InnoDB;

-- 21. ENROLLMENTS - ĐĂNG KÝ VÀ TỪNG LẦN HỌC
-- first: lần đầu; repeat: học lại; improve: cải thiện.

CREATE TABLE enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    previous_enrollment_id INT NULL,
    enrollment_type ENUM('first', 'repeat', 'improve')
        NOT NULL DEFAULT 'first',
    status ENUM(
        'registered', 'studying', 'completed',
        'cancelled', 'withdrawn'
    ) NOT NULL DEFAULT 'registered',
    registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NOT NULL,

    CONSTRAINT uq_enrollments_student_class
        UNIQUE (student_id, class_id),

    CONSTRAINT uq_enrollments_class_id
        UNIQUE (class_id, enrollment_id),

    CONSTRAINT uq_enrollments_student_id
        UNIQUE (student_id, enrollment_id),

    CONSTRAINT fk_enrollments_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT fk_enrollments_class
        FOREIGN KEY (class_id)
        REFERENCES classes(class_id),

    CONSTRAINT fk_enrollments_previous
        FOREIGN KEY (student_id, previous_enrollment_id)
        REFERENCES enrollments(student_id, enrollment_id),

    CONSTRAINT fk_enrollments_creator
        FOREIGN KEY (created_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_enrollments_type
        CHECK (
            (
                enrollment_type = 'first'
                AND previous_enrollment_id IS NULL
            )
            OR
            (
                enrollment_type IN ('repeat', 'improve')
                AND previous_enrollment_id IS NOT NULL
            )
        ),

    INDEX idx_enrollments_class_status (class_id, status)
) ENGINE = InnoDB;

-- 22. ASSESSMENTS - ĐẦU ĐIỂM
-- weight tính theo phần trăm.

CREATE TABLE assessments (
    assessment_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    assessment_type ENUM('process', 'midterm', 'final') NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL DEFAULT 10.00,

    CONSTRAINT uq_assessments_class_name
        UNIQUE (class_id, name),

    CONSTRAINT uq_assessments_class_id
        UNIQUE (class_id, assessment_id),

    CONSTRAINT fk_assessments_class
        FOREIGN KEY (class_id)
        REFERENCES classes(class_id),

    CONSTRAINT chk_assessments_weight
        CHECK (weight > 0 AND weight <= 100),

    CONSTRAINT chk_assessments_max_score
        CHECK (max_score > 0)
) ENGINE = InnoDB;

-- 23. GRADES - ĐIỂM THÀNH PHẦN KHÔNG QUA LỊCH THI
-- FK ghép ngăn gắn đầu điểm và đăng ký khác lớp.

CREATE TABLE grades (
    grade_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    assessment_id INT NOT NULL,
    score DECIMAL(5,2) NULL,
    recorded_by INT NOT NULL,
    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_grades_enrollment_assessment
        UNIQUE (enrollment_id, assessment_id),

    CONSTRAINT uq_grades_source
        UNIQUE (enrollment_id, assessment_id, grade_id),

    CONSTRAINT fk_grades_enrollment
        FOREIGN KEY (class_id, enrollment_id)
        REFERENCES enrollments(class_id, enrollment_id),

    CONSTRAINT fk_grades_assessment
        FOREIGN KEY (class_id, assessment_id)
        REFERENCES assessments(class_id, assessment_id),

    CONSTRAINT fk_grades_recorder
        FOREIGN KEY (recorded_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_grades_score
        CHECK (score IS NULL OR score >= 0)
) ENGINE = InnoDB;

-- 24. EXAM_SESSIONS - LỊCH THI
-- regular: chính thức; resit: thi lại; deferred: thi bù.

CREATE TABLE exam_sessions (
    exam_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    assessment_id INT NOT NULL,
    exam_type ENUM('regular', 'resit', 'deferred') NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_id INT NOT NULL,
    status ENUM(
        'draft', 'published', 'completed', 'cancelled'
    ) NOT NULL DEFAULT 'draft',

    CONSTRAINT uq_exam_sessions_context
        UNIQUE (exam_id, class_id, assessment_id),

    CONSTRAINT fk_exam_sessions_assessment
        FOREIGN KEY (class_id, assessment_id)
        REFERENCES assessments(class_id, assessment_id),

    CONSTRAINT fk_exam_sessions_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(room_id),

    CONSTRAINT chk_exam_sessions_time
        CHECK (
            start_time >= '00:00:00'
            AND end_time < '24:00:00'
            AND end_time > start_time
        ),

    INDEX idx_exam_sessions_room_date (room_id, exam_date)
) ENGINE = InnoDB;

-- 25. EXAM_REGISTRATIONS - DANH SÁCH VÀ KẾT QUẢ DỰ THI

CREATE TABLE exam_registrations (
    exam_registration_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    class_id INT NOT NULL,
    assessment_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    attempt_no SMALLINT NOT NULL,
    status ENUM(
        'registered', 'attended', 'absent',
        'deferred', 'disqualified', 'cancelled'
    ) NOT NULL DEFAULT 'registered',
    score DECIMAL(5,2) NULL,
    candidate_number VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    approved_by INT NULL,

    CONSTRAINT uq_exam_registrations_attempt
        UNIQUE (enrollment_id, assessment_id, attempt_no),

    CONSTRAINT uq_exam_registrations_candidate
        UNIQUE (exam_id, candidate_number),

    CONSTRAINT uq_exam_registrations_enrollment
        UNIQUE (exam_id, enrollment_id),

    CONSTRAINT uq_exam_registrations_source
        UNIQUE (
            enrollment_id,
            assessment_id,
            exam_registration_id
        ),

    CONSTRAINT fk_exam_registrations_session
        FOREIGN KEY (exam_id, class_id, assessment_id)
        REFERENCES exam_sessions(exam_id, class_id, assessment_id),

    CONSTRAINT fk_exam_registrations_enrollment
        FOREIGN KEY (class_id, enrollment_id)
        REFERENCES enrollments(class_id, enrollment_id),

    CONSTRAINT fk_exam_registrations_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_exam_registrations_attempt
        CHECK (attempt_no > 0),

    CONSTRAINT chk_exam_registrations_score
        CHECK (score IS NULL OR score >= 0)
) ENGINE = InnoDB;

-- 26. COURSE_RESULTS - KẾT QUẢ CHỐT CỦA TỪNG LẦN HỌC

CREATE TABLE course_results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    policy_id INT NOT NULL,
    credits_snapshot SMALLINT NOT NULL,
    total_score DECIMAL(4,2) NULL,
    grade_point DECIMAL(3,2) NULL,
    letter_grade VARCHAR(5) NULL,
    outcome ENUM(
        'pending', 'passed', 'failed', 'incomplete', 'exempt'
    ) NOT NULL DEFAULT 'pending',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_by INT NULL,
    finalized_at DATETIME NULL,

    CONSTRAINT uq_course_results_context UNIQUE (result_id, enrollment_id),

    CONSTRAINT uq_course_results_enrollment
        UNIQUE (enrollment_id),

    CONSTRAINT fk_course_results_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES enrollments(enrollment_id),

    CONSTRAINT fk_course_results_policy
        FOREIGN KEY (policy_id)
        REFERENCES academic_policies(policy_id),

    CONSTRAINT fk_course_results_finalizer
        FOREIGN KEY (finalized_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_course_results_credits
        CHECK (credits_snapshot > 0),

    CONSTRAINT chk_course_results_total
        CHECK (
            total_score IS NULL
            OR total_score BETWEEN 0 AND 10
        ),

    CONSTRAINT chk_course_results_grade_point
        CHECK (
            grade_point IS NULL
            OR grade_point BETWEEN 0 AND 4
        ),

    CONSTRAINT chk_course_results_published
        CHECK (is_published IN (0, 1)),

    CONSTRAINT chk_course_results_finalizer
        CHECK (
            (
                finalized_by IS NULL
                AND finalized_at IS NULL
            )
            OR
            (
                finalized_by IS NOT NULL
                AND finalized_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_course_results_publication
        CHECK (
            is_published = 0
            OR (
                finalized_by IS NOT NULL
                AND finalized_at IS NOT NULL
                AND outcome <> 'pending'
            )
        )
) ENGINE = InnoDB;

-- 27. SEMESTER_SUMMARIES - TỔNG KẾT HỌC KỲ CÓ PHIÊN BẢN
-- is_current đánh dấu bản được công nhận hiện hành.
-- Cột sinh current_marker giúp ngăn hai bản hiện hành.

CREATE TABLE semester_summaries (
    summary_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    semester_id INT NOT NULL,
    policy_id INT NOT NULL,
    attempted_credits INT NOT NULL DEFAULT 0,
    earned_credits INT NOT NULL DEFAULT 0,
    cumulative_earned_credits INT NOT NULL DEFAULT 0,
    failed_credits INT NOT NULL DEFAULT 0,
    semester_gpa DECIMAL(3,2) NULL,
    cumulative_gpa DECIMAL(3,2) NULL,
    calculation_details JSON NOT NULL,
    revision_no INT NOT NULL DEFAULT 1,
    status ENUM('draft', 'approved') NOT NULL DEFAULT 'draft',
    approved_by INT NULL,
    approved_at DATETIME NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,

    current_marker TINYINT
        GENERATED ALWAYS AS (
            CASE WHEN is_current = 1 THEN 1 ELSE NULL END
        ) STORED,

    CONSTRAINT uq_semester_summaries_revision
        UNIQUE (student_id, semester_id, revision_no),

    CONSTRAINT uq_semester_summaries_current
        UNIQUE (student_id, semester_id, current_marker),

    CONSTRAINT fk_semester_summaries_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT fk_semester_summaries_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id),

    CONSTRAINT fk_semester_summaries_policy
        FOREIGN KEY (policy_id)
        REFERENCES academic_policies(policy_id),

    CONSTRAINT fk_semester_summaries_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_semester_summaries_credits
        CHECK (
            attempted_credits >= 0
            AND earned_credits >= 0
            AND cumulative_earned_credits >= 0
            AND failed_credits >= 0
        ),

    CONSTRAINT chk_semester_summaries_gpa
        CHECK (
            (semester_gpa IS NULL OR semester_gpa BETWEEN 0 AND 4)
            AND
            (cumulative_gpa IS NULL OR cumulative_gpa BETWEEN 0 AND 4)
        ),

    CONSTRAINT chk_semester_summaries_revision
        CHECK (revision_no > 0),

    CONSTRAINT chk_semester_summaries_current
        CHECK (
            is_current IN (0, 1)
            AND (is_current = 0 OR status = 'approved')
        ),

    CONSTRAINT chk_semester_summaries_approval
        CHECK (
            (
                status = 'draft'
                AND approved_by IS NULL
                AND approved_at IS NULL
            )
            OR
            (
                status = 'approved'
                AND approved_by IS NOT NULL
                AND approved_at IS NOT NULL
            )
        )
) ENGINE = InnoDB;

-- 28. ACADEMIC_WARNINGS - CẢNH BÁO HỌC TẬP

CREATE TABLE academic_warnings (
    warning_id INT AUTO_INCREMENT PRIMARY KEY,
    summary_id INT NOT NULL,
    warning_level SMALLINT NOT NULL,
    consecutive_count SMALLINT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('draft', 'approved', 'revoked')
        NOT NULL DEFAULT 'draft',
    decision_number VARCHAR(100) NULL,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    notified_at DATETIME NULL,
    revoke_reason TEXT NULL,

    CONSTRAINT uq_academic_warnings_summary UNIQUE (summary_id),

    CONSTRAINT fk_academic_warnings_summary
        FOREIGN KEY (summary_id)
        REFERENCES semester_summaries(summary_id),

    CONSTRAINT fk_academic_warnings_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_academic_warnings_level
        CHECK (warning_level > 0),

    CONSTRAINT chk_academic_warnings_count
        CHECK (consecutive_count > 0),

    CONSTRAINT chk_academic_warnings_approval
        CHECK (
            status = 'draft'
            OR (
                approved_by IS NOT NULL
                AND approved_at IS NOT NULL
                AND decision_number IS NOT NULL
            )
        ),

    CONSTRAINT chk_academic_warnings_revocation
        CHECK (
            status <> 'revoked'
            OR (
                revoke_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(revoke_reason)) > 0
            )
        )
) ENGINE = InnoDB;

-- 29. CONDUCT_RESULTS - ĐIỂM RÈN LUYỆN

CREATE TABLE conduct_results (
    conduct_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    semester_id INT NOT NULL,
    score SMALLINT NULL,
    classification VARCHAR(60) NULL,
    comments TEXT NULL,
    status ENUM('draft', 'approved') NOT NULL DEFAULT 'draft',
    approved_by INT NULL,
    approved_at DATETIME NULL,

    CONSTRAINT uq_conduct_results_student_semester
        UNIQUE (student_id, semester_id),

    CONSTRAINT fk_conduct_results_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT fk_conduct_results_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id),

    CONSTRAINT fk_conduct_results_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_conduct_results_score
        CHECK (score IS NULL OR score BETWEEN 0 AND 100),

    CONSTRAINT chk_conduct_results_approval
        CHECK (
            status = 'draft'
            OR (
                score IS NOT NULL
                AND classification IS NOT NULL
                AND approved_by IS NOT NULL
                AND approved_at IS NOT NULL
            )
        )
) ENGINE = InnoDB;

-- 30. STUDENT_DECISIONS - QUYẾT ĐỊNH SINH VIÊN

CREATE TABLE student_decisions (
    decision_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    semester_id INT NULL,
    decision_type ENUM(
        'reward', 'discipline', 'graduation_review'
    ) NOT NULL,
    decision_number VARCHAR(100) NOT NULL,
    decision_date DATE NOT NULL,
    content TEXT NOT NULL,
    approved_by INT NOT NULL,

    CONSTRAINT uq_student_decisions_student_number
        UNIQUE (student_id, decision_number),

    CONSTRAINT fk_student_decisions_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT fk_student_decisions_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id),

    CONSTRAINT fk_student_decisions_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id)
) ENGINE = InnoDB;

-- 31. AUDIT_LOGS - NHẬT KÝ THAO TÁC
-- Tài khoản DB của ứng dụng chỉ nên có SELECT/INSERT
-- trên bảng này; không cấp UPDATE/DELETE.

CREATE TABLE audit_logs (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NOT NULL,
    entity_name VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80) NOT NULL,
    action VARCHAR(40) NOT NULL,
    reason TEXT NOT NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_id)
        REFERENCES users(user_id),

    INDEX idx_audit_logs_entity (entity_name, entity_id),
    INDEX idx_audit_logs_actor_time (actor_id, created_at),
    INDEX idx_audit_logs_created_at (created_at)
) ENGINE = InnoDB;

-- 32. STAFFS - CÁN BỘ, NHÂN VIÊN

CREATE TABLE staffs (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_code VARCHAR(30) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,
    department_id INT NOT NULL,
    user_id INT NULL,

    CONSTRAINT uq_staffs_code UNIQUE (staff_code),
    CONSTRAINT uq_staffs_user UNIQUE (user_id),

    CONSTRAINT fk_staffs_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id),

    CONSTRAINT fk_staffs_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
) ENGINE = InnoDB;

-- 33. ACADEMIC_REQUESTS - YÊU CẦU HỌC VỤ

CREATE TABLE academic_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    request_type ENUM(
        'repeat', 'improve', 'resit', 'deferred_exam',
        'leave', 'return', 'other'
    ) NOT NULL,
    related_enrollment_id INT NULL,
    content TEXT NOT NULL,
    status ENUM(
        'submitted', 'needs_info', 'approved',
        'rejected', 'executed', 'cancelled'
    ) NOT NULL DEFAULT 'submitted',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_by INT NULL,
    processed_at DATETIME NULL,
    response TEXT NULL,
    executed_enrollment_id INT NULL,
    executed_exam_registration_id INT NULL,

    CONSTRAINT uq_academic_requests_executed_enrollment
        UNIQUE (executed_enrollment_id),

    CONSTRAINT uq_academic_requests_executed_exam
        UNIQUE (executed_exam_registration_id),

    CONSTRAINT fk_academic_requests_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    CONSTRAINT fk_academic_requests_related_enrollment
        FOREIGN KEY (student_id, related_enrollment_id)
        REFERENCES enrollments(student_id, enrollment_id),

    CONSTRAINT fk_academic_requests_processor
        FOREIGN KEY (processed_by)
        REFERENCES users(user_id),

    CONSTRAINT fk_academic_requests_executed_enrollment
        FOREIGN KEY (student_id, executed_enrollment_id)
        REFERENCES enrollments(student_id, enrollment_id),

    CONSTRAINT fk_academic_requests_executed_exam
        FOREIGN KEY (executed_exam_registration_id)
        REFERENCES exam_registrations(exam_registration_id),

    CONSTRAINT chk_academic_requests_processing
        CHECK (
            (
                processed_by IS NULL
                AND processed_at IS NULL
            )
            OR
            (
                processed_by IS NOT NULL
                AND processed_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_academic_requests_decision
        CHECK (
            status NOT IN ('approved', 'rejected', 'executed')
            OR (
                processed_by IS NOT NULL
                AND processed_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_academic_requests_execution_status
        CHECK (
            (
                executed_enrollment_id IS NULL
                AND executed_exam_registration_id IS NULL
            )
            OR status = 'executed'
        ),

    CONSTRAINT chk_academic_requests_execution_type
        CHECK (
            (
                executed_enrollment_id IS NULL
                OR request_type IN ('repeat', 'improve')
            )
            AND
            (
                executed_exam_registration_id IS NULL
                OR request_type IN ('resit', 'deferred_exam')
            )
        ),

    CONSTRAINT chk_academic_requests_execution_result
        CHECK (
            status <> 'executed'
            OR request_type NOT IN (
                'repeat', 'improve', 'resit', 'deferred_exam'
            )
            OR (
                request_type IN ('repeat', 'improve')
                AND executed_enrollment_id IS NOT NULL
            )
            OR (
                request_type IN ('resit', 'deferred_exam')
                AND executed_exam_registration_id IS NOT NULL
            )
        ),

    INDEX idx_academic_requests_student_status (student_id, status)
) ENGINE = InnoDB;

-- 34. EXAM_ELIGIBILITY - ĐIỀU KIỆN DỰ THI
-- Khóa ngoại ghép kiểm tra đầu điểm và lần học thuộc cùng lớp.

CREATE TABLE exam_eligibility (
    eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    assessment_id INT NOT NULL,
    conclusion ENUM('pending', 'eligible', 'ineligible')
        NOT NULL DEFAULT 'pending',
    reason TEXT NULL,
    confirmed_by INT NULL,
    confirmed_at DATETIME NULL,

    CONSTRAINT uq_exam_eligibility
        UNIQUE (enrollment_id, assessment_id),

    CONSTRAINT fk_exam_eligibility_enrollment
        FOREIGN KEY (class_id, enrollment_id)
        REFERENCES enrollments(class_id, enrollment_id),

    CONSTRAINT fk_exam_eligibility_assessment
        FOREIGN KEY (class_id, assessment_id)
        REFERENCES assessments(class_id, assessment_id),

    CONSTRAINT fk_exam_eligibility_confirmer
        FOREIGN KEY (confirmed_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_exam_eligibility_confirmation
        CHECK (
            (
                conclusion = 'pending'
                AND confirmed_by IS NULL
                AND confirmed_at IS NULL
            )
            OR
            (
                conclusion IN ('eligible', 'ineligible')
                AND confirmed_by IS NOT NULL
                AND confirmed_at IS NOT NULL
            )
        )
) ENGINE = InnoDB;

-- 35. RESULT_COMPONENTS - NGUỒN ĐIỂM CỦA KẾT QUẢ CHỐT
-- Mỗi đầu điểm dùng đúng một nguồn.
-- Khóa ngoại ghép kiểm tra nguồn thuộc đúng lần học và đầu điểm.

CREATE TABLE result_components (
    result_component_id INT AUTO_INCREMENT PRIMARY KEY,
    result_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    assessment_id INT NOT NULL,
    grade_id INT NULL,
    exam_registration_id INT NULL,
    score_snapshot DECIMAL(5,2) NOT NULL,
    weight_snapshot DECIMAL(5,2) NOT NULL,
    max_score_snapshot DECIMAL(5,2) NOT NULL,

    CONSTRAINT uq_result_components_assessment
        UNIQUE (result_id, assessment_id),

    CONSTRAINT fk_result_components_result
        FOREIGN KEY (result_id, enrollment_id)
        REFERENCES course_results(result_id, enrollment_id),

    CONSTRAINT fk_result_components_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(assessment_id),

    CONSTRAINT fk_result_components_grade
        FOREIGN KEY (enrollment_id, assessment_id, grade_id)
        REFERENCES grades(enrollment_id, assessment_id, grade_id),

    CONSTRAINT fk_result_components_exam
        FOREIGN KEY (enrollment_id, assessment_id, exam_registration_id)
        REFERENCES exam_registrations(enrollment_id, assessment_id, exam_registration_id),

    CONSTRAINT chk_result_components_source
        CHECK (
            (
                grade_id IS NOT NULL
                AND exam_registration_id IS NULL
            )
            OR
            (
                grade_id IS NULL
                AND exam_registration_id IS NOT NULL
            )
        ),

    CONSTRAINT chk_result_components_max_score
        CHECK (max_score_snapshot > 0),

    CONSTRAINT chk_result_components_score
        CHECK (
            score_snapshot >= 0
            AND score_snapshot <= max_score_snapshot
        ),

    CONSTRAINT chk_result_components_weight
        CHECK (
            weight_snapshot > 0
            AND weight_snapshot <= 100
        )
) ENGINE = InnoDB;

-- 36. GRADE_CHANGE_REQUESTS - ĐỀ NGHỊ SỬA ĐIỂM

CREATE TABLE grade_change_requests (
    change_request_id INT AUTO_INCREMENT PRIMARY KEY,
    grade_id INT NULL,
    exam_registration_id INT NULL,
    old_score DECIMAL(5,2) NULL,
    proposed_score DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL,
    requested_by INT NOT NULL,
    approved_by INT NULL,
    status ENUM(
        'submitted', 'approved', 'rejected', 'applied'
    ) NOT NULL DEFAULT 'submitted',
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME NULL,

    CONSTRAINT fk_grade_changes_grade
        FOREIGN KEY (grade_id)
        REFERENCES grades(grade_id),

    CONSTRAINT fk_grade_changes_exam
        FOREIGN KEY (exam_registration_id)
        REFERENCES exam_registrations(exam_registration_id),

    CONSTRAINT fk_grade_changes_requester
        FOREIGN KEY (requested_by)
        REFERENCES users(user_id),

    CONSTRAINT fk_grade_changes_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_grade_changes_source
        CHECK (
            (
                grade_id IS NOT NULL
                AND exam_registration_id IS NULL
            )
            OR
            (
                grade_id IS NULL
                AND exam_registration_id IS NOT NULL
            )
        ),

    CONSTRAINT chk_grade_changes_scores
        CHECK (
            (old_score IS NULL OR old_score >= 0)
            AND proposed_score >= 0
        ),

    CONSTRAINT chk_grade_changes_approval
        CHECK (
            (
                status = 'submitted'
                AND approved_by IS NULL
                AND approved_at IS NULL
            )
            OR
            (
                status IN ('approved', 'rejected', 'applied')
                AND approved_by IS NOT NULL
                AND approved_at IS NOT NULL
            )
        )
) ENGINE = InnoDB;

-- DỮ LIỆU VAI TRÒ BAN ĐẦU
-- Không tạo tài khoản hoặc mật khẩu mặc định.

INSERT INTO roles (name)
VALUES
    ('ADMIN'),
    ('ACADEMIC_STAFF'),
    ('LECTURER'),
    ('STUDENT');

-- KIỂM TRA DANH SÁCH VÀ SỐ LƯỢNG BẢNG
-- CSDL mới chạy script này sẽ có 36 bảng.

SHOW TABLES;

SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE';
-- Lưu ý xử lý tại backend:
-- Kiểm tra quyền, trùng lịch, sĩ số và tiên quyết trong giao dịch.
-- Kiểm tra điểm không vượt max_score và tổng trọng số bằng 100.
-- Kiểm tra lần học trước cùng môn, đúng thời gian và không có vòng.
-- Kiểm tra yêu cầu thi được thực hiện cho đúng sinh viên.
-- Chỉ dùng chính sách đã duyệt; không sửa chính sách đã dùng.
-- Chốt điểm và sửa điểm phải ghi audit_logs cùng giao dịch.
-- Khi thay bản tổng kết hiện hành: bỏ cờ bản cũ rồi đặt cờ bản mới
-- trong cùng giao dịch, có khóa dữ liệu sinh viên và học kỳ.
