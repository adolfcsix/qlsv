import { roles, statuses } from '../../demo/data.js';
import { link, card, heading } from '../../components/ui.js';
import { details } from '../_shared.js';
import { password } from './security.js';
export function account(ctx) {
    const u = ctx.user, security = ctx.parts[2] === 'security';
    return heading('KHÔNG GIAN CÁ NHÂN', 'Hồ sơ & bảo mật', 'Quản lý thông tin định danh và quyền truy cập của bạn.') + `<nav class="tabs" aria-label="Thiết lập cá nhân">${link('Thông tin tài khoản', `/${u.role}/account`, security ? '' : 'active')}${link('Bảo mật', `/${u.role}/account/security`, security ? 'active' : '')}</nav>` + (security ? password({ ...ctx, embedded: true }) : card('Thông tin tài khoản', 'Thông tin do nhà trường quản lý', details([['Họ và tên', u.name], ['Tên đăng nhập', u.code], ['Email đăng nhập', u.email], ['Vai trò', roles[u.role]], ['Trạng thái', statuses[u.status]]])));
}
