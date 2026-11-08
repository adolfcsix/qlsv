import { collectReceipt } from './finance.service.js';
import { ensure } from '../../core/errors.js';
import {id, text, numeric, dateOnly} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {academic, changed, required} from '../operations/change-utils.js';
export async function handleReceipt({ db, user, body, patches, p, a, b, n }) {
    academic(user);
    if (a && !b) {
        await collectReceipt(db, user, a);
        return true;
    }
    ensure(a && b, 'Không xóa phiếu thu.');
    changed(b, a, ['status', 'reason']);
    const row = await required(db, 'receipts', 'receipt_id', n);
    ensure(row.status === 'active' && a.status === 'cancelled', 'Phiếu đã hủy hoặc trạng thái không hợp lệ.', 409);
    const reason = text(a.reason, 'Lý do hủy', 1000);
    await db.update('receipts', 'receipt_id', n, { status: 'cancelled', reason });
    await writeAudit(db, user, 'CANCEL_RECEIPT', 'receipts', n, row, { status: 'cancelled' }, reason);
    return true;
}
export async function handleCharge({ db, user, body, patches, p, a, b, n }) {
    ensure(a && !b, 'Khoản thu không được sửa/xóa trực tiếp.');
    await required(db, 'students', 'student_id', a.studentId);
    const amount = numeric(a.amount, 1, 1e12, 'Số tiền');
    ensure(Number.isSafeInteger(amount), 'Số tiền phải là số nguyên.');
    const rowId = await db.insert('charges', { student_id: id(a.studentId), name: text(a.name, 'Nội dung khoản thu', 200), amount, due_date: dateOnly(a.due), created_by: user.user_id });
    await writeAudit(db, user, 'CREATE_CHARGE', 'charges', rowId);
    return true;
}
