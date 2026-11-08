import { esc, heading, btn, link, table, badge } from '../../components/ui.js';
import { searchBar, pagination } from '../_shared.js';
import { resourceNotice, paginatedRows } from '../../services/resource-pages.js';
export function personnel(ctx){
    const type=ctx.parts[2]==='staff'?'staff':'lecturer',label=type==='staff'?'Cán bộ / nhân sự quản trị':'Giảng viên',r=ctx.remoteAdminPersonnel;
    const title=heading('QUẢN TRỊ / NHÂN SỰ','Hồ sơ giảng viên & cán bộ','Quản lý hồ sơ nhân sự độc lập với tên đăng nhập và vai trò tài khoản.',btn('Thêm '+(type==='staff'?'cán bộ':'giảng viên'),'admin-personnel-new','primary',`data-type="${type}"`));
    const tabs=`<nav class="tabs">${link('Giảng viên','/sysadmin/personnel/lecturer',type==='lecturer'?'active':'')}${link('Cán bộ & quản trị','/sysadmin/personnel/staff',type==='staff'?'active':'')}</nav>`;
    const departments=`<select data-filter="personnelDepartment" aria-label="Khoa / đơn vị"><option value="">Tất cả khoa / đơn vị</option>${ctx.db.departments.map(d=>`<option value="${esc(d.id)}" ${ctx.filters.personnelDepartment===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select>`;
    if(r?.state!=='ready')return title+tabs+resourceNotice(r||{state:'loading'});
    return title+tabs+`<section class="card">${searchBar(ctx,'Tìm mã, họ tên hoặc email',departments)}${table(['HỒ SƠ','KHOA / ĐƠN VỊ','LIÊN HỆ','TÀI KHOẢN','THAO TÁC'],r.data.items.map(p=>[
        `<strong>${esc(p.name)}</strong><small>${esc(p.code)}</small>`,esc(p.department),`${esc(p.email||'Chưa có email')}<small>${esc(p.phone||'Chưa có điện thoại')}</small>`,
        p.userId?`<strong>${esc(p.username)}</strong>${badge(p.accountStatus,p.accountStatus==='archived'?'Đã xóa khỏi sử dụng':p.accountStatus==='active'?'Hoạt động':'Đã khóa')}`:badge('draft','Chưa cấp tài khoản'),
        `<div class="row-actions">${btn('Sửa','admin-personnel-edit','small',`data-type="${type}" data-id="${esc(p.id)}"`)}${btn('Xóa','admin-personnel-delete','small danger-text',`data-type="${type}" data-id="${esc(p.id)}"`)}${!p.userId?btn('Cấp tài khoản','new-account','small',`data-profile="${type==='staff'?'academic':'lecturer'}:${esc(p.id)}"`):link('Tài khoản','/sysadmin/accounts','text-link')}</div>`
    ]))}${pagination(paginatedRows(r.data),label.toLowerCase())}</section><p class="helper">Không xóa hồ sơ đang liên kết tài khoản, cố vấn hoặc đã có phân công giảng dạy. Sửa hồ sơ không tự đổi vai trò/tên đăng nhập.</p>`;
}
