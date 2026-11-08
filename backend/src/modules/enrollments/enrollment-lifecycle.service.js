import { ensure } from '../../core/errors.js';
import { id, text } from '../../utils/validation.js';
import { writeAudit } from '../audit/audit.service.js';
import { findEnrollment, findStudentEnrollments } from './enrollments.repository.js';

// Thời hạn đăng ký lưu theo giờ địa phương của trường; không so với UTC dạng chuỗi.
export function registrationNow() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

const withinWindow = (row, now) => Boolean(row.registration_start && row.registration_end &&
    String(row.registration_start).slice(0, 19).replace('T', ' ') <= now &&
    now <= String(row.registration_end).slice(0, 19).replace('T', ' '));

export async function myEnrollments(db, user) {
    ensure(user.role === 'STUDENT', 'Chỉ sinh viên xem danh sách đăng ký của mình.', 403, 'FORBIDDEN');
    const student = await db.get('SELECT student_id FROM students WHERE user_id=?', [user.user_id]);
    ensure(student, 'Tài khoản chưa gắn hồ sơ sinh viên.', 404);
    const rows = await findStudentEnrollments(db, student.student_id);
    const now = registrationNow();
    return { items: rows.map(r => ({
        id: String(r.id), classId: String(r.classId), classCode: r.classCode,
        subjectCode: r.subjectCode, subject: r.subject, credits: Number(r.credits),
        enrollmentType: r.enrollmentType, status: r.status, semester: r.semesterName,
        withdrawalStatus: r.withdrawalStatus || null,
        canCancel: r.status === 'registered' && withinWindow(r, now)
    })) };
}

export async function getOwnedEnrollment(db, user, enrollmentId) {
    const row = await findEnrollment(db, id(enrollmentId));
    ensure(row, 'Không tìm thấy lần đăng ký.', 404, 'NOT_FOUND');
    ensure(user.role === 'ACADEMIC_STAFF' || user.role === 'STUDENT' && row.student_user_id === user.user_id,
        'Không có quyền thao tác đăng ký này.', 403, 'FORBIDDEN');
    return row;
}

async function hasResults(db, row) {
    const result = await db.get('SELECT result_id FROM course_results WHERE enrollment_id=?', [row.enrollment_id]);
    return Boolean(result);
}

export async function cancelEnrollment(db, user, enrollmentId) {
    ensure(['STUDENT','ACADEMIC_STAFF'].includes(user.role), 'Không có quyền hủy đăng ký.', 403);
    return db.tx(async () => {
        const row = await getOwnedEnrollment(db, user, enrollmentId);
        ensure(row.status === 'registered', 'Chỉ hủy được đăng ký chưa bắt đầu học.', 409);
        ensure(withinWindow(row, registrationNow()), 'Đã hết thời hạn hủy. Hãy gửi yêu cầu học vụ.', 409);
        const pending = await db.get(`SELECT request_id FROM academic_requests WHERE student_id=?
            AND related_enrollment_id=? AND request_type='other'
            AND content LIKE 'Đề nghị rút học:%' AND status IN ('submitted','needs_info','approved')
            LIMIT 1`, [row.student_id, row.enrollment_id]);
        ensure(!pending, 'Đã có yêu cầu rút học; cần cán bộ xử lý yêu cầu trước.', 409);
        ensure(!await hasResults(db, row), 'Lần học đã có kết quả, không được hủy.', 409);
        const grade = await db.get('SELECT grade_id FROM grades WHERE enrollment_id=?', [row.enrollment_id]);
        const exam = await db.get('SELECT exam_registration_id FROM exam_registrations WHERE enrollment_id=?', [row.enrollment_id]);
        ensure(!grade && !exam, 'Lần học đã có dữ liệu điểm/thi; cần cán bộ xử lý.', 409);
        await db.update('enrollments', 'enrollment_id', row.enrollment_id, { status: 'cancelled' });
        await writeAudit(db, user, 'CANCEL_ENROLLMENT', 'enrollments', row.enrollment_id,
            { status: row.status }, { status: 'cancelled' }, 'Hủy trong thời hạn đăng ký');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { id: String(row.enrollment_id), status: 'cancelled' };
    });
}

// Sinh viên không được tự đổi trạng thái rút học. Chỉ tạo yêu cầu để cán bộ xét.
export async function requestWithdrawal(db, user, enrollmentId, reason) {
    ensure(user.role === 'STUDENT', 'Chỉ sinh viên gửi yêu cầu rút học.', 403);
    const explanation = text(reason, 'Lý do', 1000);
    ensure(explanation.length >= 10, 'Lý do cần ít nhất 10 ký tự.');
    return db.tx(async () => {
        const row = await getOwnedEnrollment(db, user, enrollmentId);
        ensure(['registered','studying'].includes(row.status), 'Lần học không còn hợp lệ để đề nghị rút.', 409);
        ensure(!withinWindow(row, registrationNow()) || row.status === 'studying',
            'Đăng ký còn trong thời hạn hủy. Hãy hủy trực tiếp nếu chưa bắt đầu học.', 409);
        ensure(!await hasResults(db, row), 'Đã có kết quả học phần; cần liên hệ cán bộ đào tạo.', 409);
        const earlier = await db.get(`SELECT request_id FROM academic_requests WHERE student_id=?
            AND related_enrollment_id=? AND request_type='other'
            AND content LIKE 'Đề nghị rút học:%' AND status IN ('submitted','needs_info','approved')
            ORDER BY request_id DESC LIMIT 1`, [row.student_id, row.enrollment_id]);
        if (earlier) return { requestId: String(earlier.request_id), status: 'submitted', existing: true };
        const requestId = await db.insert('academic_requests', { student_id: row.student_id,
            related_enrollment_id: row.enrollment_id, request_type: 'other',
            content: `Đề nghị rút học: ${row.class_code}. ${explanation}`, status: 'submitted' });
        await writeAudit(db, user, 'REQUEST_WITHDRAWAL', 'academic_requests', requestId,
            null, { enrollmentId: row.enrollment_id }, 'Chờ cán bộ xét duyệt');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { requestId: String(requestId), status: 'submitted', existing: false };
    });
}

// Thao tác của cán bộ giữ lại enrollment; không xóa điểm và không tự thay đổi kết quả đã công bố.
export async function withdrawEnrollment(db, user, enrollmentId, reason, requestId) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được thực hiện rút học.', 403);
    const explanation = text(reason, 'Căn cứ xử lý', 1000);
    ensure(explanation.length >= 10, 'Căn cứ cần ít nhất 10 ký tự.');
    return db.tx(async () => {
        const row = await getOwnedEnrollment(db, user, enrollmentId);
        ensure(['registered','studying'].includes(row.status), 'Trạng thái lần học không được rút.', 409);
        ensure(!await hasResults(db, row), 'Đã chốt kết quả, không được rút trực tiếp.', 409);
        let request;
        if (requestId != null) {
            request = await db.get('SELECT * FROM academic_requests WHERE request_id=?', [id(requestId)]);
            ensure(request && request.student_id === row.student_id && request.related_enrollment_id === row.enrollment_id
                && request.request_type === 'other' && String(request.content).startsWith('Đề nghị rút học:')
                && request.status === 'approved', 'Yêu cầu rút học chưa được duyệt hoặc không thuộc lần học.', 409);
        }
        await db.update('enrollments', 'enrollment_id', row.enrollment_id, { status: 'withdrawn' });
        if (request) await db.update('academic_requests', 'request_id', request.request_id, { status: 'executed' });
        await writeAudit(db, user, 'WITHDRAW_ENROLLMENT', 'enrollments', row.enrollment_id,
            { status: row.status }, { status: 'withdrawn', requestId: request?.request_id || null }, explanation);
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { id: String(row.enrollment_id), status: 'withdrawn' };
    });
}
