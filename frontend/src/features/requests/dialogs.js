import { transact, audit, isOnline } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import * as pages from '../../pages/index.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function createFormHandlers(runtime) {
    const { context, checkAcademic, options, log, saved, getUser, render, state } = runtime;
    function requestDetail(id) { const ctx = context(), r = ctx.db.requests.find(x => x.id === id); if (!r)
        throw new Error('Không tìm thấy yêu cầu.'); if (ctx.user.role === 'student' && r.studentId !== ctx.user.profileId)
        throw new Error('Không có quyền xem yêu cầu.'); const s = ctx.db.students.find(s => s.id === r.studentId), can = ctx.user.role === 'academic' && ['submitted', 'needs_info'].includes(r.status); const executable = isOnline() && ctx.user.role === 'academic' && r.status === 'approved' &&
        r.relatedEnrollmentId && r.content.startsWith('Đề nghị rút học:');
        const body = `${person(s)}<div class="dialog-section">${badge(r.status)}<h3>${esc(r.type)} · ${esc(r.subject)}</h3><p>${esc(r.content)}</p><small>${date(r.date)} · ${esc(r.code)}</small></div>${r.response ? `<div class="notice"><p><strong>Phản hồi</strong><br>${esc(r.response)}</p></div>` : ''}${can ? `<div class="form-grid">${select('status', 'Kết quả xử lý *', [['needs_info', 'Yêu cầu bổ sung'], ['approved', 'Duyệt yêu cầu'], ['rejected', 'Từ chối']], r.status)}${textarea('response', 'Phản hồi / căn cứ *', r.response, 'required')}</div>` : ''}${executable ? `<div class="dialog-section">${btn('Thực hiện rút học', 'execute-withdrawal', 'primary', 'data-id="' + esc(r.id) + '"')}</div>` : ''}`; if (!can) {
        info('Chi tiết yêu cầu học vụ', body);
        return;
    } modal('Xử lý yêu cầu · ' + r.code, body, async (d) => { if (!['submitted', 'needs_info'].includes(r.status))
        throw new Error('Yêu cầu đã có quyết định. Không thể duyệt lại.'); if (!d.response.trim())
        throw new Error('Vui lòng nhập căn cứ xử lý.'); await transact(db => { Object.assign(db.requests.find(x => x.id === id), d); audit(db, ctx.user.name, 'Phản hồi học vụ', r.code); }); await saved('Đã lưu phản hồi. Duyệt chưa tự tạo lần học hoặc lần thi.'); }); }
    return { requestDetail };
}
