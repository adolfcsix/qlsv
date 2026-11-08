import { seed } from '../../demo/data.js';
import { read, isOnline, signOut, refresh } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import * as pages from '../../pages/index.js';
import { openAssistant, resetAssistant } from '../chatbot/chat-widget.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'open-chat': () => openAssistant(),
        'ask-student': el => { openAssistant('Thông tin sinh viên ' + read().students.find(s => s.id === el.dataset.id).code); },
        close: () => document.querySelector('#modal').close(),
        menu: () => toggleMenu(),
        logout: () => confirm('Đăng xuất', 'Kết thúc phiên trên thiết bị này?', async () => { await signOut(); sessionStorage.removeItem('hocvu-account'); state.cart = []; state.filters = {}; filterMemory.clear(); resetAssistant(); state.loginHint = ''; document.querySelector('#modal').close(); go('/login'); }),
        'demo-account': el => { const a = (isOnline() ? seed().accounts : read().accounts).find(a => a.role === el.dataset.role); document.querySelector('[name="username"]').value = a.code; document.querySelector('[name="password"]').value = 'Hocvu@2026'; document.querySelector('#login-form [type="submit"]').focus(); },
        'toggle-password': el => { const input = el.closest('.password-wrap').querySelector('input'); input.type = input.type === 'password' ? 'text' : 'password'; el.textContent = input.type === 'password' ? 'Hiện' : 'Ẩn'; },
        support: () => info('Hỗ trợ tài khoản', `<div class="prose"><h3>Quên mật khẩu hoặc chưa được cấp tài khoản?</h3><p>Cung cấp mã sinh viên, giảng viên hoặc cán bộ cho đơn vị quản lý để đối chiếu. Quản trị có thể cấp lại mật khẩu tạm sau khi xác minh.</p><p>Kênh liên hệ chính thức sẽ được nhà trường bổ sung. Bản này không gửi email khôi phục.</p></div>`),
        notifications: () => { const ctx = context(), u = ctx.user; const rows = u.role === 'sysadmin' ? [['Tài khoản cần đổi mật khẩu', ctx.db.accounts.filter(a => a.mustChange).length, '/sysadmin/accounts']] : u.role === 'academic' ? [['Yêu cầu mới', ctx.db.requests.filter(r => r.status === 'submitted').length, '/academic/requests'], ['Lịch thi nháp', ctx.db.exams.filter(e => e.status === 'draft').length, '/academic/exams']] : u.role === 'student' ? [['Yêu cầu cần bổ sung', ctx.db.requests.filter(r => r.status === 'needs_info' && r.studentId === u.profileId).length, '/student/requests'], ['Khoản thu còn thiếu', ctx.db.charges.filter(c => c.studentId === u.profileId && ctx.db.receipts.filter(r => r.chargeId === c.id && r.status === 'active').reduce((n, r) => n + r.amount, 0) < c.amount).length, '/student/fees']] : [['Dòng điểm chưa công bố', ctx.db.grades.filter(g => !g.published).length, '/lecturer/grades']]; info('Công việc cần theo dõi', `<div class="work-queue">${rows.map(([label, count, href]) => link(`<span>${label}</span><strong>${count}</strong>${icon('arrow')}`, href)).join('')}</div><p class="helper muted">Tổng hợp từ dữ liệu hiện tại trong phạm vi của bạn.</p>`); },
        'clear-filters': () => { if (state.dirtyGrades)
            throw new Error('Hãy lưu điểm trước khi đổi bộ lọc.'); state.filters = {}; const parts = context().parts; if (parts[1] === 'students' && parts.length > 2) {
            filterMemory.delete('#/' + getUser().role + '/students');
            go('/' + getUser().role + '/students');
            return;
        } render(); },
        'schedule-layout': el => { state.filters.layout = el.dataset.layout; render(); },
        'reload-app': () => location.reload(),
        'refresh-data': async () => { if (state.dirtyGrades)
            throw new Error('Hãy lưu điểm trước khi cập nhật.'); await refresh(); render(); toast('Đã cập nhật dữ liệu.'); },
        page: el => { state.filters.page = Number(el.dataset.page); render(); },
        week: el => { state.filters.week = el.dataset.reset ? 0 : Number(state.filters.week || 0) + Number(el.dataset.delta); render(); }
    };
}
