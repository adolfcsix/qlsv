// Đăng ký của một sinh viên: chỉ định student_id đã kiểm tra quyền ở service.
export async function findStudentEnrollments(db, studentId) {
    return db.all(`SELECT e.enrollment_id AS id, e.student_id AS studentId,
      c.class_id AS classId, c.class_code AS classCode, su.subject_code AS subjectCode,
      su.name AS subject, su.credits, e.enrollment_type AS enrollmentType,
      e.status, se.registration_start AS registrationStart, se.registration_end AS registrationEnd,
      (SELECT ar.status FROM academic_requests ar WHERE ar.student_id=e.student_id
        AND ar.related_enrollment_id=e.enrollment_id AND ar.request_type='other'
        AND ar.content LIKE 'Đề nghị rút học:%' ORDER BY ar.request_id DESC LIMIT 1) AS withdrawalStatus,
      se.name AS semesterName
      FROM enrollments e JOIN classes c ON c.class_id=e.class_id
      JOIN subjects su ON su.subject_id=c.subject_id
      JOIN semesters se ON se.semester_id=c.semester_id
      WHERE e.student_id=? AND e.status<>'completed'
      ORDER BY e.enrollment_id DESC LIMIT 200`, [studentId]);
}

export async function findEnrollment(db, enrollmentId) {
    return db.get(`SELECT e.*, c.class_code, c.subject_id, c.semester_id,
      se.registration_start, se.registration_end, st.user_id AS student_user_id
      FROM enrollments e JOIN classes c ON c.class_id=e.class_id
      JOIN semesters se ON se.semester_id=c.semester_id
      JOIN students st ON st.student_id=e.student_id
      WHERE e.enrollment_id=?`, [enrollmentId]);
}
