import { ensure } from '../../core/errors.js';
import { writeAudit } from '../audit/audit.service.js';

// One optimistic revision check shared by academic mutations. db.tx provides
// a serializable writer queue (SQLite) / app_lock FOR UPDATE (MySQL).
export async function checkRevision(db, revision) {
    ensure(Number.isSafeInteger(revision), 'Thiếu phiên bản dữ liệu. Tải lại trang trước khi sửa.');
    const row = await db.get('SELECT revision FROM app_lock WHERE lock_id=1');
    ensure(Number(row?.revision) === revision,
        'Dữ liệu đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.', 409, 'STALE_REVISION');
}

export async function academicMutation(db, user, revision, operation) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được thực hiện thao tác này.', 403, 'FORBIDDEN');
    return db.tx(async () => { await checkRevision(db, revision); return operation(); });
}

export async function auditRevision(db, user, action, table, entityId, before, after, reason) {
    await writeAudit(db, user, action, table, entityId, before, after, reason);
    await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
}
