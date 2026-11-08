import { adminOverview } from '../../features/admin/overview.js';
import { stat } from '../../components/ui.js';
import { dashboardFrame } from './shared.js';
export function sysadminDashboard(ctx) {
    if (ctx.remoteAdminOverview) return adminOverview(ctx);
    const { db } = ctx;
    const unassigned = [...db.students.map(s => ({ ...s, role: 'student' })), ...db.lecturers.map(s => ({ ...s, role: 'lecturer' }))].filter(s => !db.accounts.some(a => a.profileId === s.id && a.role === s.role));
    const stats = stat('Tài khoản hoạt động', db.accounts.filter(a => a.status === 'active').length, 'Được phép đăng nhập', 'users') + stat('Chưa cấp tài khoản', unassigned.length, 'Hồ sơ đang chờ', 'file') + stat('Tài khoản bị khóa', db.accounts.filter(a => a.status === 'locked').length, 'Giữ nguyên lịch sử', 'shield');
    const tasks = [['Hồ sơ chờ cấp tài khoản', unassigned.length, '/sysadmin/accounts/unassigned'], ['Cần đổi mật khẩu', db.accounts.filter(a => a.mustChange).length, '/sysadmin/accounts'], ['Nhật ký thao tác', db.audit.length, '/sysadmin/audit']];
    return dashboardFrame(ctx, { title: 'Tổng quan quản trị', stats, tasks });
}
