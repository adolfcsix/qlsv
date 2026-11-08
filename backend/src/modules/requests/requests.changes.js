import { requestTypes } from '../reports/snapshot.service.js';
import { ensure } from '../../core/errors.js';
import {text, enumeration} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {academic, changed, required, sqlNow} from '../operations/change-utils.js';
export async function handleRequests({ db, user, body, patches, p, a, b, n }) {
    ensure(a, 'Không xóa yêu cầu học vụ.');
    if (!b) {
        ensure(['STUDENT', 'ACADEMIC_STAFF'].includes(user.role), 'Không đủ quyền.', 403);
        const student = await required(db, 'students', 'student_id', a.studentId);
        ensure(user.role === 'ACADEMIC_STAFF' || student.user_id === user.user_id, 'Không được gửi yêu cầu thay người khác.', 403);
        const type = Object.entries(requestTypes).find(([, v]) => v === a.type)?.[0];
        ensure(type, 'Loại yêu cầu không hợp lệ.');
        const related = a.relatedEnrollmentId ? await required(db, 'enrollments', 'enrollment_id', a.relatedEnrollmentId) : null;
        ensure(!related || related.student_id === student.student_id, 'Lần học không thuộc sinh viên gửi yêu cầu.', 403);
        const requestId = await db.insert('academic_requests', { student_id: student.student_id, request_type: type, related_enrollment_id: related?.enrollment_id || null, content: text(a.content, 'Nội dung', 4000), status: 'submitted' });
        await writeAudit(db, user, 'SUBMIT_REQUEST', 'academic_requests', requestId);
    }
    else {
        academic(user);
        changed(b, a, ['status', 'response']);
        const row = await required(db, 'academic_requests', 'request_id', n);
        ensure(['submitted', 'needs_info'].includes(row.status), 'Yêu cầu đã có quyết định.', 409);
        enumeration(a.status, ['needs_info', 'approved', 'rejected']);
        const response = text(a.response, 'Phản hồi', 4000);
        await db.update('academic_requests', 'request_id', n, { status: a.status, response, processed_by: user.user_id, processed_at: sqlNow() });
        await writeAudit(db, user, 'REVIEW_REQUEST', 'academic_requests', n, row, { status: a.status }, response);
    }
    return true;
}
