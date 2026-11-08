import { periodLabel } from './session-details.js';
import { esc } from '../../components/format.js';

export function classSessions(row) {
    if (Array.isArray(row.schedules)) return row.schedules;
    // Chỉ dùng dữ liệu lịch một buổi của demo/V05 khi chưa có schedules.
    return row.day != null && row.start && row.end ? [{
        day: row.day, start: row.start, end: row.end, room: row.room
    }] : [];
}

export function sessionLabel(session, dates = false) {
    const day = Number(session.day);
    const dayName = day === 7 ? 'Chủ nhật' : day >= 1 && day <= 6 ? `Thứ ${day + 1}` : 'Chưa xác định thứ';
    const range = dates && session.startDate && session.endDate ?
        ` · ${session.startDate} đến ${session.endDate}` : '';
    return `${dayName} · ${session.start || '—'}–${session.end || '—'} · ${session.room || 'Chưa xếp phòng'} · ${periodLabel(session)}${session.teacherNames?.length ? ' · '+session.teacherNames.join(', ') : ''}${range}`;
}

export function renderClassSessions(row, { details = false } = {}) {
    const schedules = classSessions(row);
    if (!schedules.length) return '<span class="muted">Chưa xếp lịch học</span>';
    return `<ul class="class-session-list">${schedules.map(session =>
        `<li>${esc(sessionLabel(session, details))}</li>`).join('')}</ul>`;
}
