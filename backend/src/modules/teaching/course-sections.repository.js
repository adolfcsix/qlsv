import { scheduleRows, attendsSchedule } from '../scheduling/scheduling.repository.js';
// Chỉ trả các lớp nằm trong phạm vi tài khoản; không tải tất cả lớp rồi lọc ở frontend.
function escapeLike(term) { return term.replace(/[!%_]/g, '!$&'); }

// Một nguồn lịch cho danh sách và chi tiết; không lấy buổi đầu rồi bỏ các buổi còn lại.
async function schedulesForClasses(db, classIds, user) {
    if (!classIds.length) return new Map();
    const selected = new Set(classIds.map(String));
    const student=user?.role==='STUDENT'?await db.get('SELECT student_group_id FROM students WHERE user_id=?',[user.user_id]):null;
    const targets=student?await db.all('SELECT * FROM section_targets'):[];
    const rows = (await scheduleRows(db)).filter(row=>selected.has(row.classId)&&(!student||attendsSchedule(row,student.student_group_id,targets.filter(t=>String(t.class_id)===row.classId).map(t=>String(t.student_group_id)))));
    const byClass = new Map();
    for (const row of rows) {
        const key = row.classId;
        if (!byClass.has(key)) byClass.set(key, []);
        byClass.get(key).push({id:row.id,day:row.day,start:row.start,end:row.end,
            startDate:row.from,endDate:row.to,room:row.room,periods:row.periods,teacherIds:row.teacherIds,teacherNames:row.teacherNames});
    }
    return byClass;
}

export async function listCourseSections(db, user, query) {
    const joins = `FROM classes c
        JOIN subjects su ON su.subject_id=c.subject_id
        JOIN semesters se ON se.semester_id=c.semester_id
        JOIN academic_years ay ON ay.academic_year_id=se.academic_year_id
        LEFT JOIN lecturers l ON l.lecturer_id=c.lecturer_id
        LEFT JOIN class_schedules sc ON sc.schedule_id=(
            SELECT MIN(z.schedule_id) FROM class_schedules z WHERE z.class_id=c.class_id)
        LEFT JOIN rooms r ON r.room_id=sc.room_id`;
    const where = [], args = [];
    if (user.role === 'STUDENT') {
        where.push("c.status='open'");
        where.push(`EXISTS (SELECT 1 FROM students st
            JOIN student_groups sg ON sg.student_group_id=st.student_group_id
            JOIN curriculum_subjects cs ON cs.curriculum_id=sg.curriculum_id
              AND cs.subject_id=c.subject_id
            WHERE st.user_id=?)`);
        args.push(user.user_id);
    } else if (user.role === 'LECTURER') {
        where.push('(l.user_id=? OR EXISTS(SELECT 1 FROM class_schedules ts JOIN schedule_teachers st ON st.schedule_id=ts.schedule_id JOIN lecturers tl ON tl.lecturer_id=st.lecturer_id WHERE ts.class_id=c.class_id AND tl.user_id=?))');
        args.push(user.user_id,user.user_id);
    }
    // Chi tiết lớp được phép xem lớp đã hoàn thành, còn danh sách mặc định giữ bộ lọc cũ.
    if (user.role !== 'STUDENT' && !query.status && !query.classId) where.push("c.status<>'completed'");
    if (query.classId) {
        where.push('c.class_id=?');
        args.push(query.classId);
    }
    if (query.status) {
        where.push('c.status=?');
        args.push(query.status);
    }
    if (query.semesterId) {
        where.push('c.semester_id=?');
        args.push(query.semesterId);
    }
    if (query.search) {
        const fields = ['c.class_code', 'su.name', 'su.subject_code'].map(f =>
            db.driver === 'sqlite' ? `QLSV_NORMALIZE(${f})` : f);
        where.push('(' + fields.map(f => `${f} LIKE ? ESCAPE '!'`).join(' OR ') + ')');
        const term = '%' + escapeLike(db.driver === 'sqlite' ? query.normalized : query.search) + '%';
        args.push(...fields.map(() => term));
    }
    const condition = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const count = await db.get(`SELECT COUNT(*) AS total ${joins}${condition}`, args);
    const rows = await db.all(`SELECT c.class_id AS id, c.class_code AS code,
        c.subject_id AS subjectId, su.name AS subjectName, su.credits AS credits,
        c.lecturer_id AS lecturerId, l.full_name AS lecturerName,
        c.semester_id AS semesterId, se.name AS semesterName, ay.name AS academicYear,
        c.capacity, c.status,
        sc.day_of_week AS day, sc.start_time AS start,
        sc.end_time AS end, r.room_code AS room,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id=c.class_id
            AND e.status NOT IN ('cancelled','withdrawn')) AS count
        ${joins}${condition}
        ORDER BY se.start_date DESC, c.class_code LIMIT ? OFFSET ?`,
    [...args, query.limit, query.offset]);
    const byClass = await schedulesForClasses(db, rows.map(row => row.id), user);
    return { total: Number(count.total), items: rows.map(r => ({
        ...r, id: String(r.id), subjectId: String(r.subjectId),
        lecturerName:r.lecturerName || [...new Set((byClass.get(String(r.id))||[]).flatMap(s=>s.teacherNames))].join(', '),
        lecturerId: r.lecturerId == null ? '' : String(r.lecturerId),
        semesterId: String(r.semesterId), start: r.start?.slice(0, 5) || '',
        end: r.end?.slice(0, 5) || '', room: r.room || 'Chưa xếp',
        semester: `${r.semesterName} · ${r.academicYear}`,
        schedules: byClass.get(String(r.id)) || []
    })) };
}
