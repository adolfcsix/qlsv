import { ensure } from '../core/errors.js';
export async function canStudent(db, user, studentId) { if (user.role === 'ACADEMIC_STAFF')
    return true; if (user.role === 'STUDENT')
    return !!await db.get('SELECT student_id FROM students WHERE student_id=? AND user_id=?', [studentId, user.user_id]); if (user.role === 'LECTURER')
    return !!await db.get('SELECT s.student_id FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id JOIN lecturers l ON l.lecturer_id=g.advisor_lecturer_id WHERE s.student_id=? AND l.user_id=?', [studentId, user.user_id]); return false; }
export const roleNames = { ADMIN: 'sysadmin', ACADEMIC_STAFF: 'academic', LECTURER: 'lecturer', STUDENT: 'student' };

export async function requireAdministrator(db,actor) {
    ensure(actor.role === 'ADMIN','Chỉ quản trị được thực hiện thao tác này.',403,'FORBIDDEN');
    const row=await db.get(`SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id
        WHERE u.user_id=? AND u.status='active' AND r.name='ADMIN'
        AND NOT EXISTS(SELECT 1 FROM account_archives a WHERE a.user_id=u.user_id)`,[actor.user_id]);
    ensure(row,'Quyền quản trị đã thay đổi. Đăng nhập lại trước khi thao tác.',403,'ADMIN_ACCESS_CHANGED');
    if(actor.token_hash)ensure(await db.get('SELECT user_id FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>=?',[actor.token_hash,actor.user_id,new Date().toISOString()]),'Phiên quản trị đã bị thu hồi.',401,'SESSION_REVOKED');
}
