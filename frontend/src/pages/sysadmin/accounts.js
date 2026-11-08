import { matches, pageSlice } from '../../utils/view-model.js';
import { esc, badge, btn, link, person, table, heading } from '../../components/ui.js';
import { pagination, searchBar, filterSelect } from '../_shared.js';
import { accountProfiles, accountRoleLabels } from '../../features/accounts/profile-options.js';
export function accounts(ctx) {
    const tab=ctx.parts[2]||'',unassigned=tab==='unassigned',deleted=tab==='deleted';
    const profiles=accountProfiles(ctx.db).filter(p=>!p.userId).map(p=>({...p,role:p.kind==='staff'?'academic':p.kind}));
    const live=ctx.db.accounts.filter(a=>!a.archived),archives=ctx.db.accounts.filter(a=>a.archived);
    const source=unassigned?profiles:deleted?archives:live;
    const rows=source.filter(a=>matches(`${a.name} ${a.code} ${a.email||''}`,ctx.filters.search)&&(!ctx.filters.role||a.role===ctx.filters.role)&&(!ctx.filters.status||a.status===ctx.filters.status));
    const pg=pageSlice(rows,ctx.filters);
    const rowActions=a=>a.archived?btn('Chi tiết','account-detail','small',`data-id="${esc(a.id)}"`)+btn('Khôi phục','restore-account','small',`data-id="${esc(a.id)}"`):
        btn('Sửa / vai trò','edit-account','small',`data-id="${esc(a.id)}"`)+btn('Chi tiết','account-detail','small',`data-id="${esc(a.id)}"`)+(a.id!==ctx.user.id?btn('Xóa','delete-account','small danger-text',`data-id="${esc(a.id)}"`):'');
    return heading('QUẢN TRỊ / TÀI KHOẢN & QUYỀN','Quản lý tài khoản','Tạo, sửa và phân vai trò sinh viên, giảng viên, cán bộ hoặc quản trị; giữ liên kết hồ sơ rõ ràng.',btn('Tạo / cấp tài khoản','new-account','primary'))+
        `<nav class="tabs" aria-label="Nhóm tài khoản">${link('Đang quản lý · '+live.length,'/sysadmin/accounts',!unassigned&&!deleted?'active':'')}${link('Hồ sơ chưa cấp · '+profiles.length,'/sysadmin/accounts/unassigned',unassigned?'active':'')}${link('Đã xóa · '+archives.length,'/sysadmin/accounts/deleted',deleted?'active':'')}</nav>`+
        (deleted?'<div class="notice"><p>Tài khoản ở đây đã bị chặn đăng nhập và được giữ để truy vết. Khôi phục sẽ đưa về trạng thái khóa. Tài khoản chưa có lịch sử được xóa hẳn, hồ sơ vẫn được giữ.</p></div>':'')+
        `<section class="card">${searchBar(ctx,'Tìm tên, tài khoản hoặc email',filterSelect('role','Tất cả vai trò',Object.entries(accountRoleLabels).map(([id,name])=>({id,name})),ctx.filters.role)+(!unassigned&&!deleted?filterSelect('status','Tất cả trạng thái',[{id:'active',name:'Đang hoạt động'},{id:'locked',name:'Đã khóa'}],ctx.filters.status):''))}`+
        table(unassigned?['HỒ SƠ','NHÓM HỒ SƠ','THAO TÁC']:['THÀNH VIÊN','TÀI KHOẢN','VAI TRÒ','TRẠNG THÁI','THAO TÁC'],pg.rows.map(a=>unassigned?[person(a),esc(accountRoleLabels[a.role]),btn('Cấp tài khoản','new-account','small',`data-profile="${esc(a.role+':'+a.id)}"`)]:[person(a),`<strong>${esc(a.code)}</strong><small>${esc(a.email)}</small>`,esc(accountRoleLabels[a.role]),a.archived?badge('cancelled','Đã xóa khỏi sử dụng'):`${badge(a.status)}${a.mustChange?'<small>Phải đổi mật khẩu tạm</small>':''}`,`<div class="row-actions">${rowActions(a)}</div>`]))+pagination(pg,unassigned?'hồ sơ':'tài khoản')+'</section>';
}
