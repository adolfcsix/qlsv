import { activities } from './session-details.js';
import { api, isOnline } from '../../services/repository.js';
import { modal, field, select, textarea, esc } from '../../components/ui.js';

export function createActions({context,checkAcademic,saved,go,state,render}) {
    function ready(){checkAcademic();if(!isOnline())throw new Error('Chạy bản full-stack để quản lý lớp và lịch học.');}
    async function data(){ready();const ctx=context();return {ctx,data:ctx.remoteStaffScheduling?.state==='ready'?ctx.remoteStaffScheduling.data:await api('/staff/scheduling')};}
    async function sectionForm(classId=null) {
        const {ctx,data:d}=await data();
        const old=d.classes.find(c=>c.id===classId);
        if(classId&&!old)throw new Error('Hãy mở lớp trong trang Xếp lịch & phân lớp trước.');
        modal(old?'Chỉnh lớp học phần':'Mở lớp học phần',`<div class="form-grid">`+
            field('code','Mã lớp học phần *',old?.code||'','text','required maxlength="50"')+
            (!old?select('subjectId','Học phần *',ctx.db.subjects.map(s=>[s.id,`${s.code} · ${s.name}`]),'','required')+select('semesterId','Học kỳ *',d.semesters.map(s=>[s.id,`${s.name} · ${s.start} → ${s.end}`]),'','required'):'')+
            select('lecturerId','Giảng viên phụ trách', [['','Chưa phân công'],...ctx.db.lecturers.map(l=>[l.id,`${l.code} · ${l.name}`])],old?.lecturerId||'')+
            field('capacity','Sĩ số tối đa *',old?.capacity||40,'number','required min="1" max="500" step="1"')+
            select('status','Trạng thái', [['open','Mở đăng ký'],['closed','Đóng đăng ký'],['teaching','Đang giảng dạy']],old?.status||'open')+
            '</div><p class="helper">Tạo lớp trước, sau đó thêm buổi, gán đối tượng và phân sinh viên. Sinh viên gửi đăng ký phải chờ cán bộ duyệt.</p>',async values=>{
                const result=await api('/staff/course-sections'+(old?'/'+old.id:''),{method:old?'PATCH':'POST',body:{...values,capacity:Number(values.capacity),revision:d.revision}});
                state.filters.scheduleClass=result.id;
                await saved(old?'Đã cập nhật lớp.':'Đã mở lớp. Tiếp tục thêm buổi học và gán đối tượng.');
                go('/academic/schedule/'+result.id);
            },true);
    }
    async function sessionForm(el,edit=false) {
        const {ctx,data:d}=await data(),classId=el.dataset.class,course=d.classes.find(c=>c.id===classId);
        if(!course)throw new Error('Chọn lớp trước khi xếp lịch.');
        const old=edit?d.schedules.find(s=>s.id===el.dataset.id):null;
        const term=d.semesters.find(s=>s.id===course.semesterId);
        const teachers=old?old.teacherIds:course.lecturerId?[course.lecturerId]:[];
        modal(old?'Chỉnh buổi học':'Thêm buổi học',`<p><strong>${esc(course.code)} · ${esc(course.subject)}</strong></p><div class="form-grid">`+
            select('day','Ngày học *',[1,2,3,4,5,6,7].map(v=>[v,v===7?'Chủ nhật':'Thứ '+(v+1)]),old?.day||1,'required')+
            select('roomId','Phòng học *',d.rooms.map(r=>[r.id,`${r.code} · ${r.capacity} chỗ`]),old?.roomId||'','required')+
            field('start','Giờ bắt đầu *',old?.start||'07:30','time','required')+field('end','Giờ kết thúc *',old?.end||'10:00','time','required')+
            field('periodCount','Số tiết *',old?(old.periods?.count||0):3,'number',`required min="${old?0:1}" max="20" step="1"`)+
            field('firstPeriod','Tiết bắt đầu (nếu đánh số)',old?old.periods?.first||'':1,'number','min="1" max="30" step="1"')+
            field('lessonMinutes','Phút mỗi tiết *',old?.periods?.minutes||45,'number','required min="15" max="120" step="1"')+
            field('breakMinutes','Tổng phút nghỉ trong buổi *',old?old.periods?.breakMinutes||0:15,'number','required min="0" max="180" step="1"')+
            select('activity','Loại buổi học',Object.entries(activities),old?.periods?.activity||'lecture')+
            field('from','Từ ngày *',old?.from||term?.start,'date','required')+field('to','Đến ngày *',old?.to||term?.end,'date','required')+
            `<fieldset class="full teacher-picker"><legend>Giảng viên của buổi học</legend><p>Có thể chọn nhiều người, bỏ chọn để gỡ phân công.</p><div class="teacher-options">${ctx.db.lecturers.map(l=>`<label class="check-label"><input type="checkbox" data-session-teacher value="${esc(l.id)}" ${teachers.includes(l.id)?'checked':''}> ${esc(l.code)} · ${esc(l.name)}</label>`).join('')}</div></fieldset></div><p class="helper"><span id="session-period-preview" role="status"></span> Giờ học phải bằng số tiết × phút/tiết + tổng phút nghỉ. Dữ liệu cũ chưa xác nhận có thể để 0 tiết. Máy chủ vẫn kiểm tra trùng phòng, giảng viên và sinh viên.</p>`,async values=>{
                const teacherIds=[...document.querySelectorAll('#modal [data-session-teacher]:checked')].map(el=>el.value);
                await api(`/staff/course-sections/${classId}/schedules${old?'/'+old.id:''}`,{method:old?'PATCH':'POST',body:{...values,day:Number(values.day),teacherIds,periods:Number(values.periodCount)?{first:values.firstPeriod?Number(values.firstPeriod):null,count:Number(values.periodCount),minutes:Number(values.lessonMinutes),breakMinutes:Number(values.breakMinutes),activity:values.activity}:null,revision:d.revision}});
                await saved('Đã lưu buổi học và phân công giảng viên.');
            },true);
        const dialog=document.querySelector('#modal'),names=['start','end','periodCount','lessonMinutes','breakMinutes'];
        const update=()=>{const value=n=>dialog.querySelector(`[name="${n}"]`).value,count=Number(value('periodCount')),min=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5)),span=min(value('end'))-min(value('start')),total=count*Number(value('lessonMinutes'))+Number(value('breakMinutes'));dialog.querySelector('#session-period-preview').textContent=count?`${count} tiết · ${total} phút khai báo / ${span} phút theo giờ học. ${total===span?'Đã khớp.':'Cần điều chỉnh cho khớp.'}`:'Chưa khai báo số tiết.';};
        for(const name of names)dialog.querySelector(`[name="${name}"]`).addEventListener('input',update);update();

    }
    return {
        'new-class':()=>sectionForm(),
        'edit-section':el=>sectionForm(el.dataset.class),
        'manage-section':el=>{state.filters={};go('/academic/schedule/'+el.dataset.id);},
        'new-session':el=>sessionForm(el),
        'edit-session':el=>sessionForm(el,true),
        'delete-session':async el=>{const {data:d}=await data();modal('Xóa buổi học',textarea('reason','Lý do xóa *','','required maxlength="1000"'),async values=>{await api('/staff/schedules/'+el.dataset.id,{method:'DELETE',body:{revision:d.revision,...values}});await saved('Đã xóa buổi học và lưu lịch sử.');});},
        'delete-section':async el=>{const {data:d}=await data();modal('Xóa / hủy lớp học phần','<p>Lớp chưa có dữ liệu được xóa. Lớp đã phát sinh đăng ký được chuyển sang đã hủy và giữ lịch sử; kết quả đã công bố được bảo vệ.</p>'+textarea('reason','Lý do *','','required maxlength="1000"'),async values=>{const result=await api('/staff/course-sections/'+el.dataset.class,{method:'DELETE',body:{revision:d.revision,...values}});state.filters={};await saved(result.archived?'Đã hủy lớp, giữ lịch sử.':'Đã xóa lớp chưa sử dụng.');go('/academic/schedule');});},
        'session-targets':el=>{ const actions=createActions({context,checkAcademic,saved,go,state,render}); return actions['section-targets'](el); },
        'reset-session-targets':async el=>{const {data:d}=await data();await api(`/staff/schedules/${el.dataset.id}/audiences`,{method:'POST',body:{revision:d.revision,scope:'inherit'}});await saved('Buổi học đã dùng lại danh sách chung của lớp học phần.');},
        'section-targets':async el=>{
            const {ctx,data:d}=await data();const sources={group:ctx.db.groups,cohort:ctx.db.cohorts,department:ctx.db.departments,major:ctx.db.majors};
            const sessionId=el.dataset.session;
            modal(sessionId?'Gán / gỡ đối tượng của buổi học':'Gán / gỡ đối tượng học',`<div class="form-grid">${select('mode','Thao tác',[['add','Gán vào lớp học phần'],['remove','Gỡ khỏi đối tượng lớp']])}${select('scope','Chọn theo',[['group','Lớp hành chính'],['cohort','Toàn khóa'],['department','Toàn khoa'],['major','Toàn ngành']])}${select('referenceId','Đối tượng *',sources.group.map(r=>[r.id,r.code+' · '+r.name]),'','required')}</div><label class="check-label"><input type="checkbox" name="syncStudents" checked> ${sessionId?'Khi gán, thêm sinh viên đang học vào lớp học phần. Gỡ đối tượng buổi không xóa sinh viên khỏi các buổi khác.':'Đồng bộ sinh viên: thêm sinh viên đang học khi gán; gỡ sinh viên khỏi lớp học phần khi gỡ đối tượng.'}</label>${sessionId?'<p class="helper">Lần gán đầu chuyển buổi sang danh sách lớp riêng. Sinh viên học ghép ngoài đối tượng chung vẫn được tham dự.</p>':''}<p class="helper">Nếu một sinh viên không đủ điều kiện hoặc lớp hết chỗ/trùng lịch, toàn bộ thao tác được hoàn tác. Sinh viên đã có kết quả công bố không được gỡ.</p>`,async values=>{const result=await api(sessionId?`/staff/schedules/${sessionId}/audiences`:`/staff/course-sections/${el.dataset.class}/targets`,{method:'POST',body:{...values,syncStudents:values.syncStudents==='on',revision:d.revision}});await saved(`Đã cập nhật ${result.groups} lớp hành chính, xử lý ${result.affected} sinh viên.`);},true);
            const dialog=document.querySelector('#modal'),scope=dialog.querySelector('[name="scope"]'),target=dialog.querySelector('[name="referenceId"]');
            scope.addEventListener('change',()=>{target.innerHTML=sources[scope.value].map(r=>`<option value="${esc(r.id)}">${esc(r.code+' · '+r.name)}</option>`).join('');});
        },
        'add-member':async el=>{const {ctx,data:d}=await data();const members=new Set(d.roster.map(r=>r.studentId));const students=ctx.db.students.filter(s=>s.status==='studying'&&!members.has(s.id));if(!students.length)throw new Error('Không có sinh viên đang học để thêm.');modal('Thêm sinh viên đích danh',select('studentId','Sinh viên *',students.map(s=>[s.id,`${s.code} · ${s.name} · ${ctx.db.groups.find(g=>g.id===s.groupId)?.code||''}`]),'','required')+textarea('reason','Căn cứ phân lớp *','','required maxlength="1000"')+'<p class="helper">Sinh viên ngoài nhóm lớp được đánh dấu học ghép. Vẫn kiểm tra chương trình, tiên quyết, sĩ số, tín chỉ và trùng lịch.</p>',async values=>{await api(`/staff/course-sections/${el.dataset.class}/members`,{method:'POST',body:{revision:d.revision,...values}});await saved('Đã thêm sinh viên vào lớp và lịch học.');},true);},
        'remove-member':async el=>{const {data:d}=await data();modal('Gỡ sinh viên khỏi lớp học phần',textarea('reason','Lý do gỡ *','','required maxlength="1000"'),async values=>{await api(`/staff/course-sections/${el.dataset.class}/members/${el.dataset.id}`,{method:'DELETE',body:{revision:d.revision,...values}});await saved('Đã gỡ khỏi lịch học; giữ lịch sử đăng ký.');});},
        'approve-enrollment':el=>{ready();modal('Duyệt đăng ký học phần',textarea('reason','Ý kiến duyệt (không bắt buộc)','','maxlength="1000"')+'<p>Kiểm tra lại sĩ số, trùng lịch và điều kiện học tập trước khi thêm vào danh sách.</p>',async values=>{await api(`/enrollment-requests/${el.dataset.id}/review`,{method:'POST',body:{decision:'approve',reason:values.reason}});await saved('Đã duyệt đăng ký. Sinh viên đã có trong lớp và lịch học.');});},
        'reject-enrollment':el=>{ready();modal('Từ chối đăng ký học phần',textarea('reason','Lý do từ chối *','','required maxlength="1000"'),async values=>{await api(`/enrollment-requests/${el.dataset.id}/review`,{method:'POST',body:{decision:'reject',reason:values.reason}});await saved('Đã từ chối và gửi lý do đến sinh viên.');});},
        'request-page':el=>{state.filters.requestPage=Number(el.dataset.page);render();},
        'cancel-registration-request':el=>{modal('Rút đăng ký đang chờ','<p>Rút yêu cầu này? Bạn có thể đăng ký lại nếu lớp còn mở.</p>',async()=>{await api(`/enrollment-requests/${el.dataset.id}/cancel`,{method:'POST',body:{}});await saved('Đã rút đăng ký đang chờ duyệt.');});}
    };
}
