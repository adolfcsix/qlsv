// SQL chỉ trả lịch thuộc tài khoản; không tải snapshot của toàn trường.
const classroom = `FROM class_schedules sc
    JOIN classes c ON c.class_id=sc.class_id
    JOIN subjects su ON su.subject_id=c.subject_id
    JOIN rooms r ON r.room_id=sc.room_id`;
const exams = `FROM exam_sessions ex
    JOIN classes c ON c.class_id=ex.class_id
    JOIN subjects su ON su.subject_id=c.subject_id
    JOIN rooms r ON r.room_id=ex.room_id`;

export async function weekDefinitions(db, user, start, end) {
    const student = user.role === 'STUDENT';
    const scope = student
        ? `EXISTS (SELECT 1 FROM enrollments e JOIN students st ON st.student_id=e.student_id
            WHERE e.class_id=c.class_id AND st.user_id=?
                AND e.status IN ('registered','studying')
                AND (NOT EXISTS(SELECT 1 FROM schedule_audience_modes am WHERE am.schedule_id=sc.schedule_id)
                OR EXISTS(SELECT 1 FROM schedule_audiences sa WHERE sa.schedule_id=sc.schedule_id AND sa.student_group_id=st.student_group_id)
                OR (EXISTS(SELECT 1 FROM section_targets tt WHERE tt.class_id=c.class_id) AND NOT EXISTS(SELECT 1 FROM section_targets tt WHERE tt.class_id=c.class_id AND tt.student_group_id=st.student_group_id))))`
        : `(EXISTS (SELECT 1 FROM schedule_teachers st JOIN lecturers l ON l.lecturer_id=st.lecturer_id WHERE st.schedule_id=sc.schedule_id AND l.user_id=?) OR (NOT EXISTS(SELECT 1 FROM schedule_options so WHERE so.schedule_id=sc.schedule_id) AND EXISTS(SELECT 1 FROM lecturers l WHERE l.lecturer_id=c.lecturer_id AND l.user_id=?)))`;
    const scopeArgs = student ? [user.user_id] : [user.user_id,user.user_id];
    const rows = await db.all(`SELECT sc.schedule_id AS id, c.class_id AS classId,
        c.class_code AS classCode, su.name AS subject, su.subject_code AS subjectCode,
        r.room_code AS room, sc.day_of_week AS day, sc.start_time AS start,
        sc.end_time AS end, sc.start_date AS fromDate, sc.end_date AS toDate
        ${classroom} WHERE sc.start_date<=? AND sc.end_date>=? AND c.status<>'cancelled'
        AND ${scope} ORDER BY sc.day_of_week,sc.start_time,sc.schedule_id`, [end, start, ...scopeArgs]);
    const examScope = student
        ? `EXISTS (SELECT 1 FROM exam_registrations er
            JOIN enrollments e ON e.enrollment_id=er.enrollment_id
            JOIN students st ON st.student_id=e.student_id
            WHERE er.exam_id=ex.exam_id AND st.user_id=?
                AND er.status NOT IN ('cancelled','disqualified')
                AND e.status IN ('registered','studying','completed'))`
        : `EXISTS (SELECT 1 FROM lecturers l WHERE l.lecturer_id=c.lecturer_id AND l.user_id=?)`;
    const examRows = await db.all(`SELECT ex.exam_id AS id, c.class_id AS classId,
        c.class_code AS classCode, su.name AS subject, su.subject_code AS subjectCode,
        r.room_code AS room, ex.exam_date AS date, ex.start_time AS start,
        ex.end_time AS end, ex.exam_type AS examType
        ${exams} WHERE ex.exam_date>=? AND ex.exam_date<=?
        AND ex.status IN ('published','completed') AND ${examScope}
        ORDER BY ex.exam_date,ex.start_time,ex.exam_id`, [start, end, user.user_id]);
    return { rows, examRows };
}
