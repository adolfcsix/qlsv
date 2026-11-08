import { filteredGrades, gradeMeta, gradeTotal } from '../../../utils/view-model.js';
import { isOnline } from '../../../services/repository.js';
import { resourceNotice } from '../../../services/resource-pages.js';
import { esc, icon, badge, btn, person, empty, table, heading } from '../../../components/ui.js';
import { classInfo, visibleClasses, searchBar, filterSelect } from '../../_shared.js';

function correctionRequests(ctx) {
    if (!isOnline() && !ctx.remoteGradeChanges) return '';
    const resource = ctx.remoteGradeChanges;
    if (!resource || resource.state !== 'ready') return resourceNotice(resource || {state:'loading'});
    const rows = resource.data.items;
    return `<section class="card pad"><h2>Đề nghị chỉnh sửa điểm sau công bố</h2><p class="muted">Giáo viên gửi đề nghị; cán bộ đào tạo có quyền xét duyệt, không tự duyệt đề nghị của mình. Mọi thay đổi phải lưu lịch sử.</p>${rows.length ? table(['SINH VIÊN / ĐẦU ĐIỂM', 'ĐIỂM', 'LÝ DO', 'TRẠNG THÁI', ''], rows.map(r => [
        `<strong>${esc(r.studentName)}</strong><small>${esc(r.studentCode)} · ${esc(r.assessment)}</small>`,
        `${r.oldScore ?? '—'} → <strong>${r.proposedScore}</strong>`,
        esc(r.reason),
        badge(r.status, ({submitted:'Chờ xét',approved:'Đã duyệt',rejected:'Từ chối',applied:'Đã áp dụng'})[r.status] || r.status),
        ctx.user.role === 'academic' && r.status === 'submitted' && r.requestedBy !== ctx.user.id ?
            btn('Xét duyệt', 'review-grade-change', '', `data-id="${r.id}"`) : '—'
    ])) : '<p class="muted">Chưa có đề nghị sửa điểm của lớp này.</p>'}</section>`;
}

export function grades(ctx) {
    const { db, user } = ctx, classes = visibleClasses(ctx), selected = classes.find(c => c.id === ctx.parts[2]) || classes[0];
    if (!selected) return empty('Chưa có lớp được phân công');
    const c = classInfo(db, selected);
    const remote = ctx.remoteGradebook || null;
    const meta = remote?.state === 'ready' ? remote.data.meta : gradeMeta(db, c.id);
    const supported = meta.length === 3 && ['process','midterm','final'].every(k => meta.filter(a => a.key === k).length === 1);
    const all = remote?.state === 'ready' ? remote.data.items : db.grades.filter(g => g.classId === c.id);
    const rows = remote?.state === 'ready' ? all.filter(g => {
        const search = (ctx.filters.search || '').toLowerCase();
        return (!search || `${g.studentName} ${g.studentCode}`.toLowerCase().includes(search)) && (!ctx.filters.status || (ctx.filters.status === 'published' ? g.published : !g.published));
    }) : filteredGrades(ctx, c.id);
    const buttons = btn(icon('download') + ' Xuất CSV', 'export-grades') + (supported ? btn('Lưu bản nháp', 'save-grades', 'primary') : '');
    const header = heading('ĐÁNH GIÁ & KẾT QUẢ', 'Sổ điểm học phần', 'Nhập điểm thành phần và đối chiếu nguồn thi trước khi công bố.', buttons);
    const selector = `<div class="card grade-summary"><div><span class="eyebrow">${esc(c.code)}</span><h2>${esc(c.subject?.name)}</h2><p>${esc(c.lecturer?.name)} · ${c.subject?.credits} tín chỉ · ${esc(c.semester)}</p></div><select id="grade-class" aria-label="Chọn lớp học phần">${classes.map(x => `<option value="${esc(x.id)}" ${x.id === c.id ? 'selected' : ''}>${esc(x.code)}</option>`).join('')}</select></div>`;
    if ((isOnline() || remote) && remote?.state !== 'ready') return header + selector + resourceNotice(remote || {state:'loading'});
    if (!supported) return header + selector + '<div class="notice"><p>Cấu trúc đầu điểm chưa được hỗ trợ bởi biểu mẫu ba cột. Không thể nhập hoặc công bố qua giao diện này.</p></div>' + correctionRequests(ctx);
    const body = table(['SINH VIÊN', ...['process','midterm','final'].map(k => { const a = meta.find(a => a.key === k); return esc(a.name) + ` · ${a.weight}% / ${a.max}`; }), 'TỔNG TẠM', 'TRẠNG THÁI', ''], rows.map(g => {
        const student = db.students.find(s => s.id === g.studentId) || {name:g.studentName || '—',code:g.studentCode || '—'};
        const total = gradeTotal(g, meta);
        const sourceOptions = Object.entries(g.sources || {}).filter(([,s]) => s?.sourceId);
        const correction = g.published && isOnline() && sourceOptions.length ? btn('Đề nghị sửa điểm', 'request-grade-change', 'text-button', `data-id="${esc(g.id)}"`) : '';
        return [person(student), ...['process','midterm'].map(k => `<input class="grade-input" type="number" min="0" max="${meta.find(a => a.key === k).max}" step="0.01" aria-label="${k === 'process' ? 'Điểm quá trình' : 'Điểm giữa kỳ'} ${esc(student.name)}" name="${g.id}_${k}" value="${g[k] ?? ''}" ${g.published ? 'disabled' : ''}>`),
            (g.final === null || g.final === undefined ? '—' : Number(g.final).toFixed(2)) + (isOnline() && user.role === 'academic' && !g.published ? btn('Nhập điểm thi', 'exam-score', 'text-button', 'data-id="' + g.id + '"') : ''),
            `<span data-total="${g.id}">${total === null ? '—' : total.toFixed(2)}</span>`,
            badge(g.published ? 'published' : total === null ? 'draft' : 'active', g.published ? 'Đã công bố' : total === null ? 'Thiếu điểm' : 'Đủ điểm'), correction];
    }));
    return header + selector + `<div class="notice">${icon('file')}<p>Điểm trống khác điểm 0. Tổng tạm chỉ dùng để đối chiếu; điểm chính thức phải qua công bố theo quy chế. GPA tích lũy chỉ từ tổng kết được duyệt.</p></div><form id="grades-form" data-class="${esc(c.id)}"><section class="card">${searchBar(ctx, 'Tìm sinh viên trong sổ điểm', filterSelect('status', 'Tất cả kết quả', [{id:'published',name:'Đã công bố'},{id:'draft',name:'Chưa công bố'}], ctx.filters.status))}${body}<div class="table-foot"><span id="grade-hint">${rows.length}/${all.length} dòng · ${all.filter(g => g.published).length} đã công bố</span>${user.role === 'academic' ? btn('Kiểm tra & công bố lớp', 'publish-grades', 'primary', `data-class="${esc(c.id)}"`) : badge('draft', 'Cán bộ duyệt công bố')}</div></section></form>${correctionRequests(ctx)}`;
}
