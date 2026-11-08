import { termInfo } from '../../utils/view-model.js';
import { esc, icon, btn, link, heading, card } from '../../components/ui.js';
import { auditTable, scheduleList } from '../_shared.js';
export function dashboardFrame(ctx, { title, stats, tasks }) {
    const { db, user } = ctx, term = termInfo(db);
    return heading('KHÔNG GIAN LÀM VIỆC', title, `${esc(term.name)} · ${esc(term.year)}`, user.role === 'academic' ? btn(icon('plus') + ' Thêm sinh viên', 'new-student', 'primary') : '') +
        `<div class="stats three">${stats}</div><div class="two-cols">${card('Công việc & theo dõi', 'Mở trực tiếp dữ liệu liên quan', `<div class="work-queue">${tasks.map(([label, count, href]) => link(`<span>${label}</span><strong>${count}</strong>${icon('chevron')}`, href)).join('')}</div>`)}${user.role === 'sysadmin' ? card('Hoạt động gần đây', 'Các thay đổi quyền truy cập', auditTable(ctx, 5)) : card('Lịch trong tuần', 'Buổi học theo thời gian hiệu lực', scheduleList(ctx), link('Mở thời khóa biểu', `/${user.role}/schedule`, 'text-link'))}</div>`;
}
