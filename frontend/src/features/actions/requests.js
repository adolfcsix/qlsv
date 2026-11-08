import { transact, uid, api, refresh } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import * as pages from '../../pages/index.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'new-request': el => { const ctx = context(), id = ctx.user.role === 'student' ? ctx.user.profileId : el.dataset.student; modal('Tạo yêu cầu học vụ', `<div class="form-grid">${select('type', 'Loại yêu cầu *', [['Thi bù', 'Thi bù'], ['Thi lại', 'Thi lại'], ['Học lại', 'Học lại'], ['Cải thiện', 'Cải thiện'], ['Bảo lưu', 'Bảo lưu'], ['Khác', 'Khác']])}${select('relatedEnrollmentId', 'Lần học liên quan', [['', 'Không gắn lần học'], ...ctx.db.enrollments.filter(e => e.studentId === id).map(e => { const c = ctx.db.classes.find(c => c.id === e.classId), s = ctx.db.subjects.find(s => s.id === c?.subjectId); return [e.id, `${s?.code} · ${s?.name} · ${c?.code}`]; }), ...ctx.db.results.filter(r => r.studentId === id && r.enrollmentId).map(r => [r.enrollmentId, `${r.code} · ${r.name} · ${r.semester}`])])}${textarea('content', 'Nội dung và căn cứ *', '', 'required minlength="10"')}</div>`, async (d) => { if (d.content.trim().length < 10)
            throw new Error('Nội dung cần ít nhất 10 ký tự.'); await transact(db => { db.requests.push({ ...d, id: uid('r'), code: 'HV-' + String(db.requests.length + 1).padStart(3, '0'), studentId: id, date: new Date().toISOString().slice(0, 10), status: 'submitted', response: '' }); }); await saved('Đã gửi yêu cầu học vụ.'); }); },
        'execute-withdrawal': el => {
            checkAcademic();
            const r = context().db.requests.find(item => item.id === el.dataset.id);
            if (!r?.relatedEnrollmentId || r.status !== 'approved' || !r.content.startsWith('Đề nghị rút học:'))
                throw new Error('Yêu cầu rút học chưa được duyệt hoặc không hợp lệ.');
            document.querySelector('#modal')?.close();
            modal('Xác nhận thực hiện rút học', textarea('reason', 'Căn cứ thực hiện *',
                r.response || '', 'required minlength="10" maxlength="1000"'), async data => {
                await api(`/enrollments/${encodeURIComponent(r.relatedEnrollmentId)}/withdraw`, {
                    method: 'POST', body: { reason: data.reason, requestId: r.id }
                });
                await refresh();
                await saved('Đã thực hiện rút học, giữ lịch sử và nhật ký xử lý.');
            });
        },
        'request-detail': el => requestDetail(el.dataset.id)
    };
}
