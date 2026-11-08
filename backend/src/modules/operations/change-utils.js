import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
export const academic = u => ensure(u.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được thực hiện thao tác này.', 403, 'FORBIDDEN');
export const admin = u => ensure(u.role === 'ADMIN', 'Chỉ quản trị được thực hiện thao tác này.', 403, 'FORBIDDEN');
export const statuses = ['studying', 'on_leave', 'suspended', 'withdrawn', 'graduated'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function changed(before, after, allowed) { const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]); for (const k of keys)
    if (!same(before?.[k], after?.[k]))
        ensure(allowed.includes(k), `Không được thay đổi trường ${k}.`, 403, 'FIELD_FORBIDDEN'); }
export const isoNow = () => new Date().toISOString();
export const sqlNow = () => isoNow().slice(0, 19).replace('T', ' ');
export async function required(db, table, pk, value) { const row = await db.get(`SELECT * FROM ${table} WHERE ${pk}=?`, [id(value)]); ensure(row, 'Không tìm thấy dữ liệu liên quan.', 404, 'NOT_FOUND'); return row; }
export async function duplicate(db, table, column, value, pk, current) { const row = await db.get(`SELECT ${pk} FROM ${table} WHERE LOWER(${column})=LOWER(?)`, [value]); ensure(!row || String(row[pk]) === String(current), 'Mã hoặc email đã tồn tại.', 409, 'DUPLICATE'); }
