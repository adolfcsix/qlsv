import { ensure } from '../../core/errors.js';
import { text, dateOnly } from '../../utils/validation.js';
import { requireAdministrator } from '../../middlewares/authorize.js';
import { required, duplicate } from '../operations/change-utils.js';
import { writeAudit } from '../audit/audit.service.js';

function localDateTime(value){if(value===''||value==null)return null;ensure(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value),'Thời gian đăng ký không hợp lệ.');dateOnly(value.slice(0,10));return value.replace('T',' ')+(value.length===16?':00':'');}
export async function loadCalendar(db,user){await requireAdministrator(db,user);const years=await db.all('SELECT y.*,(SELECT COUNT(*) FROM semesters s WHERE s.academic_year_id=y.academic_year_id) AS term_count FROM academic_years y ORDER BY y.start_date DESC');const semesters=await db.all('SELECT s.*,y.name AS year_name,(SELECT COUNT(*) FROM classes c WHERE c.semester_id=s.semester_id) AS class_count FROM semesters s JOIN academic_years y ON y.academic_year_id=s.academic_year_id ORDER BY s.start_date DESC');return{years:years.map(y=>({id:String(y.academic_year_id),name:y.name,start:y.start_date,end:y.end_date,semesters:Number(y.term_count)})),semesters:semesters.map(s=>({id:String(s.semester_id),yearId:String(s.academic_year_id),year:s.year_name,name:s.name,start:s.start_date,end:s.end_date,registrationStart:s.registration_start||'',registrationEnd:s.registration_end||'',classes:Number(s.class_count)}))};}
export async function saveYearWithin(db,user,rowId,body){
    await requireAdministrator(db,user);const old=rowId?await required(db,'academic_years','academic_year_id',rowId):null;
    const name=text(body.name,'Tên năm học',30),start=dateOnly(body.start),end=dateOnly(body.end);ensure(end>start,'Ngày kết thúc năm học phải sau ngày bắt đầu.');
    await duplicate(db,'academic_years','name',name,'academic_year_id',rowId);
    if(old)ensure(!await db.get('SELECT semester_id FROM semesters WHERE academic_year_id=? AND (start_date<? OR end_date>?) LIMIT 1',[old.academic_year_id,start,end]),'Khoảng năm học mới không bao trọn các học kỳ hiện có.',409,'SEMESTER_OUTSIDE_YEAR');
    const v={name,start_date:start,end_date:end},key=old?.academic_year_id||await db.insert('academic_years',v);if(old)await db.update('academic_years','academic_year_id',key,v);
    await writeAudit(db,user,old?'UPDATE_ACADEMIC_YEAR':'CREATE_ACADEMIC_YEAR','academic_years',key,old,v,text(body.reason,'Căn cứ',1000));return{id:String(key)};
}
export async function saveSemesterWithin(db,user,rowId,body){
    await requireAdministrator(db,user);const old=rowId?await required(db,'semesters','semester_id',rowId):null,year=await required(db,'academic_years','academic_year_id',body.yearId);
    const name=text(body.name,'Tên học kỳ',60),start=dateOnly(body.start),end=dateOnly(body.end);ensure(end>start&&start>=year.start_date&&end<=year.end_date,'Ngày học kỳ phải hợp lệ và nằm trong năm học.');
    ensure(!await db.get('SELECT semester_id FROM semesters WHERE academic_year_id=? AND LOWER(name)=LOWER(?) AND semester_id<>?',[year.academic_year_id,name,old?.semester_id||0]),'Tên học kỳ đã có trong năm học này.',409,'DUPLICATE');
    const registrationStart=localDateTime(body.registrationStart),registrationEnd=localDateTime(body.registrationEnd);
    ensure(registrationStart===null&&registrationEnd===null||registrationStart!==null&&registrationEnd!==null&&registrationEnd>registrationStart,'Điền cả hai mốc đăng ký và đảm bảo kết thúc sau bắt đầu.');
    ensure(!registrationEnd||registrationEnd<=end+' 23:59:59','Đăng ký không được kết thúc sau học kỳ.');
    if(old){
        const used=await db.get('SELECT class_id FROM classes WHERE semester_id=? LIMIT 1',[old.semester_id]);
        ensure(!used||old.academic_year_id===year.academic_year_id,'Học kỳ đã có lớp học phần, không chuyển năm học.',409);
        const finalized=await db.get('SELECT r.result_id FROM course_results r JOIN enrollments e ON e.enrollment_id=r.enrollment_id JOIN classes c ON c.class_id=e.class_id WHERE c.semester_id=? AND r.is_published=1 LIMIT 1',[old.semester_id]);
        const summary=await db.get("SELECT summary_id FROM semester_summaries WHERE semester_id=? AND status='approved' LIMIT 1",[old.semester_id]);
        ensure(!(finalized||summary)||start===old.start_date&&end===old.end_date&&old.academic_year_id===year.academic_year_id,'Học kỳ đã có kết quả/tổng kết duyệt; không thay mốc học đã chốt.',409,'FINALIZED_SEMESTER');
        ensure(!await db.get('SELECT sc.schedule_id FROM class_schedules sc JOIN classes c ON c.class_id=sc.class_id WHERE c.semester_id=? AND (sc.start_date<? OR sc.end_date>?) LIMIT 1',[old.semester_id,start,end]),'Mốc học kỳ mới nằm ngoài lịch học đã xếp.',409,'SCHEDULE_OUTSIDE_SEMESTER');
        ensure(!await db.get("SELECT x.exam_id FROM exam_sessions x JOIN classes c ON c.class_id=x.class_id WHERE c.semester_id=? AND x.status<>'cancelled' AND (x.exam_date<? OR x.exam_date>?) LIMIT 1",[old.semester_id,start,end]),'Mốc học kỳ mới nằm ngoài lịch thi đã xếp.',409,'EXAM_OUTSIDE_SEMESTER');
    }
    const v={academic_year_id:year.academic_year_id,name,start_date:start,end_date:end,registration_start:registrationStart,registration_end:registrationEnd},key=old?.semester_id||await db.insert('semesters',v);if(old)await db.update('semesters','semester_id',key,v);
    await writeAudit(db,user,old?'UPDATE_SEMESTER':'CREATE_SEMESTER','semesters',key,old,v,text(body.reason,'Căn cứ',1000));return{id:String(key)};
}
export async function deleteCalendarWithin(db,user,type,rowId,body){await requireAdministrator(db,user);const year=type==='year',table=year?'academic_years':'semesters',pk=year?'academic_year_id':'semester_id',old=await required(db,table,pk,rowId);if(year)ensure(!await db.get('SELECT semester_id FROM semesters WHERE academic_year_id=? LIMIT 1',[old[pk]]),'Năm học đang có học kỳ, không xóa.',409);else ensure(!await db.get('SELECT class_id FROM classes WHERE semester_id=? LIMIT 1',[old[pk]]),'Học kỳ đã có lớp học phần, không xóa.',409);await db.run(`DELETE FROM ${table} WHERE ${pk}=?`,[old[pk]]);await writeAudit(db,user,year?'DELETE_ACADEMIC_YEAR':'DELETE_SEMESTER',table,old[pk],old,null,text(body.reason,'Lý do xóa',1000));return{removed:true};}
