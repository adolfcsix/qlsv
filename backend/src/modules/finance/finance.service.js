import { ensure } from '../../core/errors.js';
import {numeric, enumeration} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {academic, required, isoNow} from '../operations/change-utils.js';
export async function collectReceipt(db, user, a) { academic(user); const c = await required(db, 'charges', 'charge_id', a.chargeId), paid = await db.get("SELECT COALESCE(SUM(amount),0) AS total FROM receipts WHERE charge_id=? AND status='active'", [c.charge_id]); const amount = numeric(a.amount, 1, Number(c.amount) - Number(paid.total), 'Số tiền thực nhận'); ensure(Number.isSafeInteger(amount), 'Số tiền phải nguyên.'); const method = enumeration(a.method, ['Tiền mặt', 'Chuyển khoản'], 'Phương thức'); const code = 'PT-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); const rowId = await db.insert('receipts', { receipt_code: code, charge_id: c.charge_id, amount, method, received_at: isoNow(), status: 'active', reason: '', recorded_by: user.user_id }); await writeAudit(db, user, 'COLLECT_RECEIPT', 'receipts', rowId, null, { charge_id: c.charge_id, amount }); return rowId; }
