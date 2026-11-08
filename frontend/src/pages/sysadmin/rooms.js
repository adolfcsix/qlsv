import { esc, heading, table, btn, badge } from '../../components/ui.js';
import { searchBar, pagination } from '../_shared.js';
import { resourceNotice, paginatedRows } from '../../services/resource-pages.js';
export function adminRooms(ctx){
    const r=ctx.remoteAdminRooms,title=heading('QUẢN TRỊ / CƠ SỞ VẬT CHẤT','Phòng học & phòng thi','Sức chứa và trạng thái phòng được dùng trực tiếp khi cán bộ xếp lịch.',btn('Thêm phòng','admin-room-new','primary'));
    const filter=`<select data-filter="roomEnabled" aria-label="Trạng thái phòng">${[['','Tất cả phòng'],['true','Đang sử dụng'],['false','Ngừng sử dụng']].map(([v,l])=>`<option value="${v}" ${ctx.filters.roomEnabled===v?'selected':''}>${l}</option>`).join('')}</select>`;
    if(r?.state!=='ready')return title+resourceNotice(r||{state:'loading'});
    return title+`<section class="card">${searchBar(ctx,'Tìm mã hoặc loại phòng',filter)}${table(['PHÒNG','LOẠI','SỨC CHỨA','TRẠNG THÁI','LỊCH SẮP TỚI','THAO TÁC'],r.data.items.map(p=>[`<strong>${esc(p.code)}</strong>`,esc(p.type||'Chưa phân loại'),`${p.capacity} chỗ`,badge(p.enabled?'active':'locked',p.enabled?'Đang sử dụng':'Ngừng sử dụng'),`${p.scheduled} buổi học<small>${p.exams} buổi thi${p.usedBefore?' · Đã có lịch sử':''}</small>`,`<div class="row-actions">${btn('Sửa','admin-room-edit','small',`data-id="${esc(p.id)}"`)}${btn('Lịch sử dụng','admin-room-usage','small',`data-id="${esc(p.id)}"`)}${btn('Xóa','admin-room-delete','small danger-text',`data-id="${esc(p.id)}"`)}</div>`]))}${pagination(paginatedRows(r.data),'phòng')}</section><div class="notice"><p>Phòng còn lịch sắp tới cần được chuyển lịch trước khi ngừng sử dụng. Không giảm sức chứa dưới mức của lớp đã xếp; không xóa phòng đã có lịch sử.</p></div>`;
}
