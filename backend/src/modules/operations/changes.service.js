import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { academic } from './change-utils.js';
import { registerCourse } from '../enrollments/enrollments.service.js';
import { handleAccounts } from '../accounts/accounts.changes.js';
import { handleRequests } from '../requests/requests.changes.js';
import { handleGrades } from '../assessment/assessment.changes.js';
import { handleStudents, handleContacts } from '../students/students.changes.js';
import { handleHistory } from '../students/student-history.changes.js';
import { handleReceipt, handleCharge } from '../finance/finance.changes.js';
import { handleClass } from '../teaching/teaching.changes.js';
import { handleExam } from '../exams/exams.changes.js';
import { handleCatalog } from '../organization/organization.changes.js';
const handlers = {
    accounts: handleAccounts, requests: handleRequests, grades: handleGrades,
    history: handleHistory, students: handleStudents, contacts: handleContacts,
    receipts: handleReceipt, charges: handleCharge, classes: handleClass, exams: handleExam
};
export async function applyChanges(db, user, body) {
    ensure(body && typeof body === 'object' && Number.isInteger(body.revision) && Array.isArray(body.changes) && body.changes.length <= 60, 'Yêu cầu cập nhật không hợp lệ.');
    return db.tx(async () => {
        const revision = await db.get('SELECT revision FROM app_lock WHERE lock_id=1');
        ensure(revision.revision === body.revision, 'Dữ liệu đã được người khác thay đổi. Tải lại trước khi lưu.', 409, 'STALE_REVISION');
        const patches = body.changes;
        ensure(patches.every(p => p && typeof p === 'object' && !Array.isArray(p) &&
            typeof p.table === 'string' && [p.before, p.after].every(value =>
                value == null || typeof value === 'object' && !Array.isArray(value))),
            'Dữ liệu cập nhật không hợp lệ.');
        let effective = 0;
        for (const p of patches.filter(item => item.table !== 'audit')) {
            ensure(p && typeof p.table === 'string', 'Dữ liệu cập nhật không hợp lệ.');
            const a = p.after, b = p.before;
            const n = b && /^\d+$/.test(String(p.id)) ? id(p.id) : null;
            // 'count' is derived, and must not be written to classes.
            if (p.table === 'classes' && a && b && Object.keys(a).filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).every(key => key === 'count'))
                continue;
            if (p.table === 'enrollments' && a && !b) {
                ensure(user.role === 'ACADEMIC_STAFF', 'Sinh viên cần gửi đăng ký và chờ cán bộ phê duyệt.', 403);
                await registerCourse(db, user, a.studentId, a.classId);
                effective++;
                continue;
            }
            const handler = handlers[p.table] || handleCatalog;
            if (!['accounts', 'requests', 'grades', 'receipts'].includes(p.table))
                academic(user);
            if (await handler({ db, user, body, patches, p, a, b, n }))
                effective++;
        }
        ensure(effective > 0, 'Không có thay đổi nghiệp vụ hợp lệ.');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { updated: effective };
    });
}
