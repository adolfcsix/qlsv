import { sessionFacts } from './session-details.js';
import { esc, heading, card, table, badge, btn, link } from '../../components/ui.js';
import { resourceNotice } from '../../services/resource-pages.js';
const options=(rows,value,title,key='name')=>`<option value="">${title}</option>`+rows.map(r=>`<option value="${esc(r.id)}" ${String(r.id)===String(value)?'selected':''}>${esc(r.code ? r.code+' · '+r[key] : r[key])}</option>`).join('');
export function staffSchedule(ctx) {
    const resource=ctx.remoteStaffScheduling;
    const intro=heading('CÁN BỘ / ĐIỀU PHỐI GIẢNG DẠY','Xếp lịch & phân lớp',
        'Quản lý lớp học phần, từng buổi học, giảng viên và danh sách sinh viên.',btn('Mở lớp học phần','new-class','primary'));
    const quick=`<nav class="management-links" aria-label="Quản lý danh mục">${[['cohorts','Khóa tuyển sinh'],['departments','Khoa'],['majors','Ngành'],['groups','Lớp hành chính & sĩ số']].map(([key,label])=>link(label,`/academic/organization/${key}`,'btn small')).join('')}</nav>`;
    if(!resource||resource.state!=='ready')return intro+quick+resourceNotice(resource||{state:'loading'});
    const data=resource.data,selected=data.classes.find(c=>c.id===data.classId),f=ctx.filters,db=ctx.db;
    const filters=`<section class="card pad"><h2>Chọn phạm vi quản lý</h2><div class="form-grid compact-fields">
        <label class="field"><span>Khóa</span><select data-filter="scheduleCohort">${options(db.cohorts,f.scheduleCohort,'Tất cả khóa')}</select></label>
        <label class="field"><span>Khoa</span><select data-filter="scheduleDepartment">${options(db.departments,f.scheduleDepartment,'Tất cả khoa')}</select></label>
        <label class="field"><span>Ngành</span><select data-filter="scheduleMajor">${options(db.majors.filter(m=>!f.scheduleDepartment||m.departmentId===f.scheduleDepartment),f.scheduleMajor,'Tất cả ngành')}</select></label>
        <label class="field"><span>Lớp hành chính</span><select data-filter="scheduleGroup">${options(db.groups,f.scheduleGroup,'Tất cả lớp')}</select></label>
        <label class="field full"><span>Lớp học phần / lớp học vụ</span><select data-filter="scheduleClass"><option value="">Chọn lớp học phần</option>${data.classes.map(c=>`<option value="${esc(c.id)}" ${c.id===data.classId?'selected':''}>${esc(c.code)} · ${esc(c.subject)} · ${esc(c.semester)} · ${c.count}/${c.capacity}${c.status==='cancelled'?' · Đã hủy':''}</option>`).join('')}</select></label></div><p class="helper">Bộ lọc khóa, khoa, ngành và lớp dựa trên các lớp hành chính đã gán vào lớp học phần. Lớp mới chưa gán vẫn xem được khi bỏ bộ lọc.</p>${btn('Bỏ bộ lọc','clear-filters','text-button')}</section>`;
    let workspace='<div class="notice"><p>Chưa có lớp phù hợp. Bỏ bộ lọc hoặc mở lớp học phần mới.</p></div>';
    if(selected) {
        const editable=!['completed','cancelled'].includes(selected.status);
        const attrs=`data-class="${esc(selected.id)}"`;
        const management=`<div class="section-summary"><div><strong>${esc(selected.code)} · ${esc(selected.subject)}</strong><p>${esc(selected.semester)} · ${selected.count}/${selected.capacity} sinh viên</p></div>${badge(selected.status)}</div>`;
        const controls=editable?`<div class="action-wrap">${btn('Sửa lớp / sĩ số','edit-section','',attrs)}${btn('Xóa / hủy lớp','delete-section','danger-btn',attrs)}${btn('Thêm buổi học','new-session','primary',attrs)}</div>`:'';
        const slots=data.schedules.map(s=>[`${['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'][s.day-1]}<small>${esc(s.start)}–${esc(s.end)}</small>${sessionFacts(s)}`,`${esc(s.from)} → ${esc(s.to)}`,esc(s.room),s.teacherNames.length?s.teacherNames.map(esc).join('<br>'):badge('draft','Chưa phân công'),`${s.audienceMode==='custom'?s.groupNames.map(esc).join(', ')||'Chưa chọn lớp':'Toàn bộ lớp học phần'}${editable?'<div class="action-wrap">'+btn('Gán / gỡ lớp','session-targets','small',`${attrs} data-session="${esc(s.id)}"`)+(s.audienceMode==='custom'?btn('Dùng danh sách chung','reset-session-targets','small',`data-id="${esc(s.id)}"`):'')+'</div>':''}`,editable?`<div class="row-actions">${btn('Sửa','edit-session','small',`${attrs} data-id="${esc(s.id)}"`)}${btn('Xóa','delete-session','small danger-text',`data-id="${esc(s.id)}"`)}</div>`:'—']);
        const targets=`<div class="target-tags">${data.targets.map(g=>`<span class="badge neutral">${esc(g.code)} · ${esc(g.name)}</span>`).join('')||'<p class="muted">Chưa gán lớp hành chính. Có thể phân theo khóa, khoa, ngành hoặc từng lớp.</p>'}</div><p class="helper">Đối tượng chung cho lớp học phần. Từng buổi có thể gán riêng lớp/khóa/khoa/ngành ở bảng lịch phía trên. Có thể đồng bộ sinh viên đang học vào lớp khi gán.</p>`;
        const roster=data.roster.map(s=>[`${esc(s.code)}<strong>${esc(s.name)}</strong>`,`${esc(s.groupCode)}<small>${esc(s.group)}</small>`,s.external?badge('needs_info','Học ghép / khác lớp'):badge('active','Trong nhóm lớp'),esc(s.source),editable&&!s.published?btn('Gỡ khỏi lớp','remove-member','small danger-text',`${attrs} data-id="${esc(s.id)}"`):s.published?'Đã khóa kết quả':'—']);
        workspace=card('Thông tin lớp học phần','Lớp học vụ có danh sách, sĩ số và lịch riêng.',management+controls)+
            card('Lịch học & giảng viên','Mỗi buổi có thể có một hoặc nhiều giảng viên, hoặc để chưa phân công.',slots.length?table(['THỨ / GIỜ','HIỆU LỰC','PHÒNG','GIẢNG VIÊN','ĐỐI TƯỢNG BUỔI','THAO TÁC'],slots):'<p>Chưa xếp buổi học. Nhấn “Thêm buổi học” để bắt đầu.</p>')+
            card('Đối tượng khóa · khoa · ngành · lớp','Sinh viên đăng ký ngoài nhóm lớp vẫn được ghi nhận riêng.',targets,editable?btn('Gán / gỡ đối tượng','section-targets','',attrs):'')+
            card(`Danh sách sinh viên · ${data.roster.length}/${selected.capacity}`,'Sinh viên được duyệt hoặc phân trực tiếp sẽ xuất hiện trong thời khóa biểu.',roster.length?table(['SINH VIÊN','LỚP HÀNH CHÍNH','NHẬN BIẾT','NGUỒN',''],roster):'<p>Chưa có sinh viên trong lớp.</p>',editable?btn('Thêm sinh viên đích danh','add-member','primary',attrs):'');
    }
    const requests=ctx.remoteRegistrationRequests;
    const status=f.requestStatus||'pending';
    const requestFilter=`<label class="field request-status"><span>Trạng thái đăng ký</span><select data-filter="requestStatus">${[['pending','Chờ duyệt'],['approved','Đã duyệt'],['rejected','Đã từ chối'],['cancelled','Đã rút']].map(([v,l])=>`<option value="${v}" ${status===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
    const statusName={pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối',cancelled:'Đã rút'};
    const requestTable=requests?.state==='ready'?table(['SINH VIÊN','LỚP XIN HỌC','Ý KIẾN / TRẠNG THÁI','THAO TÁC'],requests.data.items.map(r=>[`${esc(r.studentCode)} · ${esc(r.studentName)}<small>${esc(r.group)}</small>`,`${esc(r.classCode)}<small>${esc(r.subject)}</small>`,`${badge(r.status,statusName[r.status])}<small>${esc(r.reason)}</small>`,r.status==='pending'?`<div class="row-actions">${btn('Mở lớp','manage-section','small',`data-id="${esc(r.classId)}"`)}${btn('Duyệt','approve-enrollment','small primary',`data-id="${esc(r.id)}"`)}${btn('Từ chối','reject-enrollment','small danger-text',`data-id="${esc(r.id)}"`)}</div>`:'—'])):resourceNotice(requests||{state:'loading'});
    const pages=requests?.data?.pagination;
    const paging=pages&&pages.pages>1?`<div class="table-foot"><span>Trang ${pages.page}/${pages.pages} · ${pages.total} đăng ký</span><div>${btn('Trước','request-page','','data-page="'+(pages.page-1)+'" '+(pages.page<=1?'disabled':''))}${btn('Sau','request-page','','data-page="'+(pages.page+1)+'" '+(pages.page>=pages.pages?'disabled':''))}</div></div>`:'';
    return intro+quick+filters+workspace+card('Đăng ký học phần chờ cán bộ xét duyệt','Chưa duyệt thì chưa chiếm chỗ và chưa có lịch học. Hệ thống kiểm tra lại sĩ số, chương trình và trùng lịch khi duyệt.',requestFilter+requestTable+paging);
}
