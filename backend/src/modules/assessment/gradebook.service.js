import { ensure } from '../../core/errors.js';
import { id, numeric } from '../../utils/validation.js';
import { writeAudit } from '../audit/audit.service.js';

export async function classAccess(db, user, classId) {
    ensure(['ACADEMIC_STAFF', 'LECTURER'].includes(user.role), 'Không được truy cập sổ điểm.', 403);
    const course = await db.get('SELECT c.*,l.user_id AS lecturer_user_id FROM classes c LEFT JOIN lecturers l ON l.lecturer_id=c.lecturer_id WHERE c.class_id=?', [id(classId)]);
    ensure(course, 'Không tìm thấy lớp học phần.', 404);
    const sessionAssignment = user.role === 'LECTURER' && await db.get('SELECT st.lecturer_id FROM schedule_teachers st JOIN class_schedules sc ON sc.schedule_id=st.schedule_id JOIN lecturers l ON l.lecturer_id=st.lecturer_id WHERE sc.class_id=? AND l.user_id=? LIMIT 1',[course.class_id,user.user_id]);
    ensure(user.role === 'ACADEMIC_STAFF' || Number(course.lecturer_user_id) === Number(user.user_id) || sessionAssignment, 'Lớp không thuộc phân công của bạn.', 403);
    return course;
}

export async function getGradebook(db, user, classId) {
    const course = await classAccess(db, user, classId);
    const assessments = await db.all('SELECT * FROM assessments WHERE class_id=? ORDER BY assessment_id', [course.class_id]);
    const roster = await db.all("SELECT e.enrollment_id,e.student_id,s.student_code,s.full_name,cr.is_published FROM enrollments e JOIN students s ON s.student_id=e.student_id LEFT JOIN course_results cr ON cr.enrollment_id=e.enrollment_id WHERE e.class_id=? AND e.status NOT IN ('cancelled','withdrawn') ORDER BY s.student_code", [course.class_id]);
    const grades = await db.all('SELECT g.* FROM grades g WHERE g.class_id=?', [course.class_id]);
    const attempts = await db.all("SELECT er.* FROM exam_registrations er WHERE er.class_id=? AND er.status='attended' AND er.score IS NOT NULL ORDER BY er.attempt_no DESC", [course.class_id]);
    const hasExams = new Set((await db.all('SELECT DISTINCT assessment_id FROM exam_sessions WHERE class_id=?', [course.class_id])).map(row => row.assessment_id));
    const meta = assessments.map(a => ({ id: String(a.assessment_id), key: a.assessment_type, name: a.name, weight: Number(a.weight), max: Number(a.max_score) }));
    const items = roster.map(row => {
        const scores = {}, sources = {};
        for (const a of assessments) {
            const source = hasExams.has(a.assessment_id) ? attempts.find(t => t.enrollment_id === row.enrollment_id && t.assessment_id === a.assessment_id) : grades.find(g => g.enrollment_id === row.enrollment_id && g.assessment_id === a.assessment_id);
            scores[a.assessment_type] = source?.score == null ? null : Number(source.score);
            sources[a.assessment_type] = source ? { type: hasExams.has(a.assessment_id) ? 'exam' : 'grade', sourceId: String(hasExams.has(a.assessment_id) ? source.exam_registration_id : source.grade_id), assessment: a.name } : null;
        }
        return { id: String(row.enrollment_id), classId: String(course.class_id), studentId: String(row.student_id), studentCode: row.student_code, studentName: row.full_name, published: !!row.is_published, sources, ...scores };
    });
    return { classId: String(course.class_id), meta, items, supported: meta.length === 3 && ['process', 'midterm', 'final'].every(key => meta.filter(a => a.key === key).length === 1) };
}

// Shared by the original compatibility endpoint and the new resource API.
// This is the ONLY place that changes pre-publication process/midterm grades.
export async function saveDraftGrade(db, user, enrollmentId, scores, expectedClass = null, expected = null) {
    const enrollment = await db.get('SELECT * FROM enrollments WHERE enrollment_id=?', [id(enrollmentId)]);
    ensure(enrollment, 'Không tìm thấy lần học.', 404);
    const course = await classAccess(db, user, enrollment.class_id);
    if (expectedClass !== null) ensure(Number(course.class_id) === Number(expectedClass), 'Lần học không thuộc lớp này.', 409);
    ensure(!['cancelled','withdrawn'].includes(enrollment.status), 'Lần học không còn hợp lệ.', 409);
    ensure(!await db.get('SELECT result_id FROM course_results WHERE enrollment_id=? AND is_published=1', [enrollment.enrollment_id]), 'Điểm đã công bố. Cần đề nghị sửa điểm.', 409);
    const assessments = await db.all("SELECT * FROM assessments WHERE class_id=? AND assessment_type IN ('process','midterm')", [course.class_id]);
    const before = {}, after = {};
    for (const key of ['process','midterm']) {
        ensure(Object.hasOwn(scores, key), 'Thiếu trường điểm ' + key);
        const matching = assessments.filter(a => a.assessment_type === key);
        ensure(matching.length === 1, 'Cấu trúc đầu điểm chưa được hỗ trợ.', 409);
        const assessment = matching[0];
        const raw = scores[key];
        ensure(raw === null || typeof raw === 'number' && Number.isFinite(raw), 'Điểm phải là số hoặc để trống.');
        const value = raw === null ? null : numeric(raw, 0, Number(assessment.max_score), 'Điểm');
        const old = await db.get('SELECT * FROM grades WHERE enrollment_id=? AND assessment_id=?', [enrollment.enrollment_id, assessment.assessment_id]);
        before[key] = old?.score == null ? null : Number(old.score);
        if (expected && Object.hasOwn(expected, key)) ensure(before[key] === expected[key], 'Dữ liệu điểm đã đổi ở phiên khác. Hãy tải lại sổ điểm.', 409, 'STALE_GRADE');
        after[key] = value;
        if (before[key] === value) continue;
        if (old) await db.update('grades', 'grade_id', old.grade_id, { score: value, recorded_by: user.user_id });
        else await db.insert('grades', { class_id: course.class_id, enrollment_id: enrollment.enrollment_id, assessment_id: assessment.assessment_id, score: value, recorded_by: user.user_id });
    }
    if (Object.keys(after).some(key => after[key] !== before[key])) {
        await writeAudit(db, user, 'SAVE_GRADES', 'enrollments', enrollment.enrollment_id, before, after);
        return true;
    }
    return false;
}

export async function saveClassDrafts(db, user, classId, rows) {
    return db.tx(async () => {
        await classAccess(db, user, classId);
        ensure(Array.isArray(rows) && rows.length > 0 && rows.length <= 100, 'Danh sách điểm phải có từ 1 đến 100 dòng.');
        ensure(rows.every(row => row && typeof row === 'object' && !Array.isArray(row) &&
            row.scores && typeof row.scores === 'object' && !Array.isArray(row.scores) &&
            (row.expected == null || typeof row.expected === 'object' && !Array.isArray(row.expected))),
            'Dòng điểm không hợp lệ.');
        ensure(new Set(rows.map(r => String(r.enrollmentId))).size === rows.length, 'Một lần học xuất hiện nhiều lần.');
        let changed = 0;
        for (const row of rows) if (await saveDraftGrade(db, user, row.enrollmentId, row.scores || {}, classId, row.expected || null)) changed++;
        if (changed) await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { saved: rows.length, changed };
    });
}
