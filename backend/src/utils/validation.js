import { ensure } from '../core/errors.js';
export function id(value) { ensure(/^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0, 'Mã định danh không hợp lệ.'); return Number(value); }
export function text(value, label, max = 200, required = true) { ensure(typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= max, `${label} không hợp lệ.`); return value.trim(); }
export function enumeration(value, allowed, label = 'Trạng thái') { ensure(allowed.includes(value), `${label} không hợp lệ.`); return value; }
export function numeric(value, min, max, label = 'Số') { const v = Number(value); ensure(Number.isFinite(v) && v >= min && v <= max, `${label} phải từ ${min} đến ${max}.`); return v; }
export function dateOnly(value) {
    ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Ngày không hợp lệ.');
    const date = new Date(value + 'T00:00:00Z');
    ensure(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value, 'Ngày không hợp lệ.');
    return value;
}
export function timeOnly(value) {
    ensure(typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value), 'Giờ không hợp lệ.');
    return value;
}
