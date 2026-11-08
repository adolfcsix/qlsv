import { esc, heading, card, table, btn } from '../../components/ui.js';
import { resourceNotice } from '../../services/resource-pages.js';
export function adminCalendar(ctx){
    const r=ctx.remoteAdminCalendar,title=heading('QUẢN TRỊ / THỜI GIAN ĐÀO TẠO','Năm học & học kỳ','Quản lý mốc học, cửa sổ đăng ký theo giờ Việt Nam và bảo vệ dữ liệu đã phát sinh.',btn('Thêm năm học','admin-year-new','primary'));
    if(r?.state!=='ready')return title+resourceNotice(r||{state:'loading'});
    const d=r.data,selected=ctx.filters.calendarYear||'',terms=d.semesters.filter(s=>!selected||s.yearId===selected);
    const years=table(['NĂM HỌC','THỜI GIAN','SỐ HỌC KỲ','THAO TÁC'],d.years.map(y=>[esc(y.name),`${esc(y.start)} → ${esc(y.end)}`,y.semesters,`<div class="row-actions">${btn('Sửa','admin-year-edit','small',`data-id="${esc(y.id)}"`)}${btn('Xóa','admin-year-delete','small danger-text',`data-id="${esc(y.id)}"`)}${btn('Thêm học kỳ','admin-semester-new','small',`data-year="${esc(y.id)}"`)}</div>`]));
    const filters=`<label class="field admin-year-filter"><span>Lọc theo năm học</span><select data-filter="calendarYear"><option value="">Tất cả năm học</option>${d.years.map(y=>`<option value="${esc(y.id)}" ${selected===y.id?'selected':''}>${esc(y.name)}</option>`).join('')}</select></label>`;
    const rows=table(['HỌC KỲ / NĂM','THỜI GIAN HỌC','ĐĂNG KÝ · GIỜ VIỆT NAM','LỚP HỌC PHẦN','THAO TÁC'],terms.map(s=>[`<strong>${esc(s.name)}</strong><small>${esc(s.year)}</small>`,`${esc(s.start)} → ${esc(s.end)}`,s.registrationStart?`${esc(s.registrationStart)}<small>đến ${esc(s.registrationEnd)}</small>`:'Chưa mở cửa sổ đăng ký',s.classes,`<div class="row-actions">${btn('Sửa','admin-semester-edit','small',`data-id="${esc(s.id)}"`)}${btn('Xóa','admin-semester-delete','small danger-text',`data-id="${esc(s.id)}"`)}</div>`]));
    return title+card('Danh sách năm học','Năm học phải bao trọn các học kỳ trực thuộc.',years)+card('Các học kỳ','Học kỳ đã có kết quả công bố không sửa mốc học. Lịch đã xếp phải nằm trong khoảng học kỳ.',filters+rows,d.years.length?btn('Thêm học kỳ','admin-semester-new','primary',`data-year="${esc(selected)}"`):'');
}
