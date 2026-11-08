// One read model for the academic editor and student progress; SQL identifiers are static.
export async function getCurriculumStructure(db, curriculumId) {
    const program = await db.get(`SELECT c.curriculum_id AS id, c.code, c.name,
        c.admission_year AS admissionYear, c.required_credits AS requiredCredits,
        m.major_id AS majorId, m.name AS majorName, d.name AS departmentName,
        ap.code AS policyCode
        FROM curricula c JOIN majors m ON m.major_id=c.major_id
        JOIN departments d ON d.department_id=m.department_id
        JOIN academic_policies ap ON ap.policy_id=c.policy_id WHERE c.curriculum_id=?`, [curriculumId]);
    if (!program) return null;
    const [electiveGroups, subjects, prerequisites] = await Promise.all([
        db.all(`SELECT elective_group_id AS id, curriculum_id AS curriculumId,
          code, name, minimum_credits AS minimumCredits
          FROM elective_groups WHERE curriculum_id=? ORDER BY code`, [curriculumId]),
        db.all(`SELECT cs.curriculum_subject_id AS id, cs.curriculum_id AS curriculumId,
          cs.subject_id AS subjectId, s.subject_code AS code, s.name,
          s.credits, s.status, cs.requirement_type AS requirementType,
          cs.elective_group_id AS electiveGroupId,
          cs.recommended_semester AS recommendedSemester
          FROM curriculum_subjects cs JOIN subjects s ON s.subject_id=cs.subject_id
          WHERE cs.curriculum_id=? ORDER BY cs.recommended_semester, s.subject_code`, [curriculumId]),
        db.all(`SELECT sp.subject_id AS subjectId, sp.prerequisite_subject_id AS prerequisiteSubjectId,
          s.subject_code AS code, p.subject_code AS prerequisiteCode, p.name AS prerequisiteName
          FROM subject_prerequisites sp JOIN subjects s ON s.subject_id=sp.subject_id
          JOIN subjects p ON p.subject_id=sp.prerequisite_subject_id
          WHERE sp.subject_id IN (SELECT subject_id FROM curriculum_subjects WHERE curriculum_id=?)
          ORDER BY s.subject_code, p.subject_code`, [curriculumId])
    ]);
    return { program, electiveGroups, subjects, prerequisites };
}

export async function studentAttempts(db, studentId) {
    return db.all(`SELECT s.subject_id AS subjectId, s.subject_code AS subjectCode,
      c.semester_id AS semesterId, sm.end_date AS semesterEnd,
      e.enrollment_id AS enrollmentId, e.status AS enrollmentStatus,
      cr.result_id AS resultId, cr.outcome, cr.is_published AS isPublished,
      cr.credits_snapshot AS creditsSnapshot
      FROM enrollments e JOIN classes c ON c.class_id=e.class_id
      JOIN subjects s ON s.subject_id=c.subject_id
      JOIN semesters sm ON sm.semester_id=c.semester_id
      LEFT JOIN course_results cr ON cr.enrollment_id=e.enrollment_id
      WHERE e.student_id=? AND e.status NOT IN ('cancelled','withdrawn')
      ORDER BY sm.end_date, e.enrollment_id`, [studentId]);
}

export async function isCurriculumLocked(db, curriculumId) {
    // Enrollment already creates a historical obligation; do not change its
    // curriculum after a student starts registering, even before publishing grades.
    const enrolled = await db.get(`SELECT 1 AS used FROM enrollments e
      JOIN students st ON st.student_id=e.student_id
      JOIN student_groups g ON g.student_group_id=st.student_group_id
      WHERE g.curriculum_id=? LIMIT 1`, [curriculumId]);
    const approved = await db.get(`SELECT 1 AS used FROM semester_summaries ss
      JOIN students st ON st.student_id=ss.student_id
      JOIN student_groups g ON g.student_group_id=st.student_group_id
      WHERE g.curriculum_id=? AND ss.status='approved' LIMIT 1`, [curriculumId]);
    return Boolean(enrolled || approved);
}
