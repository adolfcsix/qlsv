import { changeStudentStatus } from '../../services/student-service.js';
import { statuses } from '../../demo/data.js';
import { read, upsert, uid, getContext } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import { filteredStudents } from '../../utils/view-model.js';
const { person, select, field, textarea, modal, csv, toast } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'new-student': () => studentForm(),
        'edit-student': el => studentForm(el.dataset.id),
        'new-contact': el => { checkAcademic(); modal('Thêm người liên hệ', `<div class="form-grid">${field('name', 'Họ và tên *', '', 'text', 'required')}${field('relationship', 'Quan hệ *', '', 'text', 'required')}${field('phone', 'Điện thoại *', '', 'tel', 'required pattern="[0-9+ .-]{8,20}"')}${field('address', 'Địa chỉ')}${select('emergency', 'Liên hệ khẩn cấp', [['true', 'Có'], ['false', 'Không']])}</div>`, async (d) => { await upsert('contacts', { ...d, id: uid('ct'), studentId: el.dataset.student, emergency: d.emergency === 'true' }); await saved(); }); },
        'student-status': async el => { checkAcademic(); const s = read().students.find(s => s.id === el.dataset.id); modal('Biến động học vụ', `${person(s)}<div class="form-grid">${select('status', 'Trạng thái mới *', Object.entries(statuses).filter(([k]) => ['studying', 'on_leave', 'suspended', 'withdrawn'].includes(k)), s.status)}${select('groupId', 'Lớp hành chính', await options('groups', 'Chọn lớp',
            { programId: getContext(read(), s).program.id }), s.groupId)}${field('date', 'Ngày hiệu lực *', new Date().toISOString().slice(0, 10), 'date', 'required')}${field('decision', 'Số quyết định *', '', 'text', 'required')}${textarea('reason', 'Lý do và căn cứ *', '', 'required')}</div>`, async (d) => { if (d.date > new Date().toISOString().slice(0, 10))
            throw new Error('Bản đầu chỉ xử lý quyết định đã có hiệu lực.'); const old = getContext(read(), s), ng = read().groups.find(g => g.id === d.groupId); if (ng.programId !== old.program.id)
            throw new Error('Chỉ chuyển lớp trong cùng chương trình.'); if (s.status === d.status && s.groupId === d.groupId)
            throw new Error('Chưa có thay đổi trạng thái hoặc lớp.'); await changeStudentStatus(s, { status: d.status, groupId: d.groupId },
                { date: d.date, decision: d.decision, reason: d.reason }, getUser().name); await saved(); }, true); },
        'export-students': () => { const ctx = context(); const rows = filteredStudents(ctx); csv('danh-sach-sinh-vien', ['Mã sinh viên', 'Họ tên', 'Lớp', 'Ngành', 'Khóa', 'Trạng thái'], rows.map(s => { const c = getContext(ctx.db, s); return [s.code, s.name, c.group?.name, c.major?.name, c.cohort?.code, statuses[s.status]]; })); toast('Đã xuất danh sách CSV.'); }
    };
}
