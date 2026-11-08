import { read, upsert, uid, api, refresh } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import * as pages from '../../pages/index.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'new-exam': async () => { checkAcademic(); modal('Tạo lịch thi nháp', `<div class="form-grid">${select('classId', 'Lớp học phần *', await options('classes'))}${select('type', 'Loại thi', [['Chính thức', 'Chính thức'], ['Thi lại', 'Thi lại'], ['Thi bù', 'Thi bù']])}${field('date', 'Ngày thi *', '2026-12-19', 'date', 'required')}${field('start', 'Giờ bắt đầu *', '08:00', 'time', 'required')}${field('end', 'Giờ kết thúc *', '09:30', 'time', 'required')}${field('room', 'Phòng thi *', 'B2.301', 'text', 'required')}</div>`, async (d) => { if (d.end <= d.start)
            throw new Error('Giờ kết thúc phải sau giờ bắt đầu.'); if (read().exams.some(e => e.status !== 'cancelled' && e.date === d.date && e.room.toLowerCase() === d.room.trim().toLowerCase() && e.start < d.end && d.start < e.end))
            throw new Error('Phòng thi đã có lịch trong khung giờ này.'); await upsert('exams', { ...d, id: uid('e'), code: 'KT' + String(read().exams.length + 1).padStart(3, '0'), status: 'draft' }); await saved(); }); },
        'exam-score': async (el) => { checkAcademic(); if (state.dirtyGrades)
            await saveGrades(); const rows = await api('/enrollments/' + el.dataset.id + '/exam-attempts'); if (!rows.length)
            throw new Error('Chưa có lần dự thi. Cần lập danh sách dự thi và xác nhận điều kiện trước.'); modal('Nhập kết quả từng lần thi', `<div class="form-grid">${select('attemptId', 'Lần dự thi *', rows.map(r => [r.id, `${r.candidate} · Lần ${r.attempt} · ${r.date} · hiện tại ${r.score ?? 'trống'}`]), rows[0].id, 'required')}${select('status', 'Trạng thái *', [['registered', 'Chưa có kết quả'], ['attended', 'Đã dự thi'], ['absent', 'Vắng thi']], rows[0].status, 'required')}${field('score', 'Điểm thi (trống nếu chưa thi / vắng)', rows[0].score ?? '', 'number', 'min="0" step="0.01"')}${textarea('reason', 'Căn cứ nhập / điều chỉnh *', '', 'required maxlength="500"')}</div><p class="muted">Giữ nguyên số lần thi. Điểm 0 khác chưa có kết quả; máy chủ kiểm tra thang điểm và điều kiện dự thi.</p>`, async (d) => { await api('/exam-registrations/' + d.attemptId + '/score', { method: 'POST', body: { status: d.status, score: d.status !== 'attended' || d.score === '' ? null : Number(d.score), reason: d.reason, expected: (() => { const row = rows.find(r => String(r.id) === String(d.attemptId)); return { status: row.status, score: row.score == null ? null : Number(row.score) }; })() } }); await refresh(); await saved('Đã lưu điểm của lần dự thi.'); }); bindExamAttemptSelection(document.querySelector('#modal'), rows); },
        'exam-detail': el => { const ctx = context(), e = ctx.db.exams.find(e => e.id === el.dataset.id), c = ctx.db.classes.find(c => c.id === e.classId); info('Lịch thi · ' + e.code, `${badge(e.status)}${pages.details([['Lớp học phần', c.code], ['Ngày thi', date(e.date)], ['Thời gian', e.start + '–' + e.end], ['Phòng', e.room], ['Loại thi', e.type]])}${ctx.user.role === 'academic' && e.status === 'draft' ? '<p class="muted">Cần danh sách dự thi, điều kiện và kiểm tra sức chứa từ backend trước khi công bố.</p>' : ''}`); }
    };
}

// Switching exam attempts must switch score/status together, not reuse the first attempt.
export function bindExamAttemptSelection(dialog, rows) {
    const attempt = dialog.querySelector('[name="attemptId"]');
    const status = dialog.querySelector('[name="status"]');
    const score = dialog.querySelector('[name="score"]');
    const reason = dialog.querySelector('[name="reason"]');
    const syncStatus = () => {
        score.disabled = status.value !== 'attended';
        if (score.disabled) score.value = '';
    };
    const load = () => {
        const row = rows.find(r => String(r.id) === String(attempt.value));
        if (!row) return;
        status.value = row.status;
        score.value = row.score ?? '';
        score.max = String(row.maxScore);
        reason.value = '';
        syncStatus();
    };
    attempt.addEventListener('change', load);
    status.addEventListener('change', syncStatus);
    load();
}
