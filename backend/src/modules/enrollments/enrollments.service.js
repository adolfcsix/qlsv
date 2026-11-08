import { scheduleRows, attendsSchedule, schedulesOverlap } from '../scheduling/scheduling.repository.js';
import { ensure } from '../../core/errors.js';


import { writeAudit } from '../audit/audit.service.js';
import { required } from '../operations/change-utils.js';
import { registrationNow } from './enrollment-lifecycle.service.js';
export async function registerCourse(db, user, studentId, classId, options = {}) {
    ensure(['STUDENT', 'ACADEMIC_STAFF'].includes(user.role), 'Không đủ quyền đăng ký.', 403);
    const staffAssignment = user.role === 'ACADEMIC_STAFF' && options.staffAssignment === true;
    const s = await required(db, 'students', 'student_id', studentId), c = await required(db, 'classes', 'class_id', classId);
    ensure(user.role === 'ACADEMIC_STAFF' || s.user_id === user.user_id, 'Không được đăng ký cho người khác.', 403);
    ensure(s.status === 'studying' && (c.status === 'open' || staffAssignment && c.status === 'teaching'), 'Sinh viên hoặc lớp chưa đủ điều kiện đăng ký.');
    const se = await required(db, 'semesters', 'semester_id', c.semester_id);
    const now = registrationNow();
    ensure(staffAssignment || se.registration_start && se.registration_end && se.registration_start <= now && now <= se.registration_end, 'Ngoài thời hạn đăng ký.');
    const existing = await db.get('SELECT * FROM enrollments WHERE student_id=? AND class_id=?', [s.student_id, c.class_id]);
    if (existing && !['cancelled', 'withdrawn'].includes(existing.status))
        return existing.enrollment_id;
    const group = await required(db, 'student_groups', 'student_group_id', s.student_group_id), curr = await required(db, 'curricula', 'curriculum_id', group.curriculum_id), policy = await required(db, 'academic_policies', 'policy_id', curr.policy_id);
    ensure(policy.approved_by, 'Quy chế chưa được duyệt.');
    const rules = typeof policy.rules === 'string' ? JSON.parse(policy.rules) : policy.rules;
    ensure(await db.get('SELECT curriculum_subject_id FROM curriculum_subjects WHERE curriculum_id=? AND subject_id=?', [curr.curriculum_id, c.subject_id]), 'Học phần không thuộc chương trình.');
    const dup = await db.get("SELECT e.enrollment_id FROM enrollments e JOIN classes c ON c.class_id=e.class_id WHERE e.student_id=? AND c.subject_id=? AND c.semester_id=? AND e.status NOT IN ('cancelled','withdrawn')", [s.student_id, c.subject_id, c.semester_id]);
    ensure(!dup, 'Đã đăng ký học phần này trong học kỳ.', 409);
    const count = await db.get("SELECT COUNT(*) AS n FROM enrollments WHERE class_id=? AND status NOT IN ('cancelled','withdrawn')", [c.class_id]);
    ensure(count.n < c.capacity, 'Lớp đã đủ sĩ số.', 409, 'CLASS_FULL');
    const pre = await db.all('SELECT prerequisite_subject_id FROM subject_prerequisites WHERE subject_id=?', [c.subject_id]);
    for (const p of pre)
        ensure(await db.get("SELECT r.result_id FROM course_results r JOIN enrollments e ON e.enrollment_id=r.enrollment_id JOIN classes c ON c.class_id=e.class_id WHERE e.student_id=? AND c.subject_id=? AND r.is_published=1 AND r.outcome='passed'", [s.student_id, p.prerequisite_subject_id]), 'Chưa đạt học phần tiên quyết.');
    const credits = await db.get("SELECT COALESCE(SUM(su.credits),0) AS n FROM enrollments e JOIN classes c ON c.class_id=e.class_id JOIN subjects su ON su.subject_id=c.subject_id WHERE e.student_id=? AND c.semester_id=? AND e.status NOT IN ('cancelled','withdrawn')", [s.student_id, c.semester_id]);
    const su = await required(db, 'subjects', 'subject_id', c.subject_id);
    ensure(Number.isFinite(rules.maxCredits) && credits.n + su.credits <= rules.maxCredits, 'Vượt giới hạn tín chỉ theo quy chế.');
    const schedules = await scheduleRows(db);
    const targets = await db.all('SELECT * FROM section_targets');
    const baseGroups = classId => targets.filter(t=>String(t.class_id)===String(classId)).map(t=>String(t.student_group_id));
    const ownClasses = new Set((await db.all("SELECT class_id FROM enrollments WHERE student_id=? AND status NOT IN ('cancelled','withdrawn')",[s.student_id])).map(e=>String(e.class_id)));
    const selected = schedules.filter(sc=>sc.classId===String(c.class_id)&&attendsSchedule(sc,s.student_group_id,baseGroups(c.class_id)));
    for (const sc of selected) {
        const conflict = schedules.some(other=>other.status!=='cancelled'&&ownClasses.has(other.classId)&&
            attendsSchedule(other,s.student_group_id,baseGroups(other.classId))&&schedulesOverlap(sc,other));
        ensure(!conflict, 'Trùng lịch học với lớp đã đăng ký.', 409);
    }
    const prev = await db.get("SELECT e.*,r.outcome,sm.end_date FROM enrollments e JOIN classes c ON c.class_id=e.class_id JOIN semesters sm ON sm.semester_id=c.semester_id JOIN course_results r ON r.enrollment_id=e.enrollment_id WHERE e.student_id=? AND c.subject_id=? AND r.is_published=1 AND sm.end_date<? ORDER BY sm.end_date DESC,e.enrollment_id DESC LIMIT 1", [s.student_id, c.subject_id, se.start_date]);
    const type = prev ? (prev.outcome === 'passed' ? 'improve' : 'repeat') : 'first';
    if (type === 'improve')
        ensure(rules.allowImprove === true, 'Quy chế không cho cải thiện.');
    const values = { student_id: s.student_id, class_id: c.class_id, previous_enrollment_id: prev?.enrollment_id || null, enrollment_type: type, status: 'registered', created_by: user.user_id };
    if (options.validateOnly) return null;
    let rowId;
    if (existing) {
        await db.update('enrollments', 'enrollment_id', existing.enrollment_id, values);
        rowId = existing.enrollment_id;
    }
    else
        rowId = await db.insert('enrollments', values);
    await writeAudit(db, user, 'REGISTER_COURSE', 'enrollments', rowId, existing || null, { student_id: s.student_id, class_id: c.class_id, enrollment_type: type });
    return rowId;
}
