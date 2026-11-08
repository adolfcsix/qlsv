import { registrationNow } from '../enrollments/enrollment-lifecycle.service.js';
import { ensure } from '../../core/errors.js';
import { text, numeric } from '../../utils/validation.js';
import { requireAdministrator } from '../../middlewares/authorize.js';
import { required, duplicate } from '../operations/change-utils.js';
import { writeAudit } from '../audit/audit.service.js';
import { listParameters } from '../organization/organization.service.js';
const today=()=>registrationNow().slice(0,10);
export async function listRooms(db,user,params){
    await requireAdministrator(db,user);const q=listParameters(params),where=[],args=[];
    if(params.has('enabled')){ensure(['true','false'].includes(params.get('enabled')),'Trạng thái phòng không hợp lệ.');where.push('COALESCE(rs.enabled,1)=?');args.push(params.get('enabled')==='true'?1:0);}
    if(q.search){where.push("(r.room_code LIKE ? ESCAPE '!' OR r.room_type LIKE ? ESCAPE '!')");const term='%'+q.search.replace(/[!%_]/g,'!$&')+'%';args.push(term,term);}
    const from='FROM rooms r LEFT JOIN room_settings rs ON rs.room_id=r.room_id',condition=where.length?' WHERE '+where.join(' AND '):'';
    const count=await db.get('SELECT COUNT(*) AS n '+from+condition,args);
    const rows=await db.all(`SELECT r.*,COALESCE(rs.enabled,1) AS enabled, EXISTS(SELECT 1 FROM room_usage_history h WHERE h.room_id=r.room_id) AS used_before,
        (SELECT COUNT(*) FROM class_schedules sc JOIN classes c ON c.class_id=sc.class_id WHERE sc.room_id=r.room_id AND sc.end_date>=? AND c.status NOT IN ('cancelled','completed')) AS scheduled,
        (SELECT COUNT(*) FROM exam_sessions ex WHERE ex.room_id=r.room_id AND ex.exam_date>=? AND ex.status IN ('draft','published')) AS exams
        ${from}${condition} ORDER BY r.room_code LIMIT ? OFFSET ?`,[today(),today(),...args,q.limit,q.offset]);
    return{items:rows.map(r=>({id:String(r.room_id),code:r.room_code,type:r.room_type||'',capacity:Number(r.capacity),enabled:!!r.enabled,usedBefore:!!r.used_before,scheduled:Number(r.scheduled),exams:Number(r.exams)})),pagination:{page:q.page,limit:q.limit,total:Number(count.n),pages:Math.max(1,Math.ceil(Number(count.n)/q.limit))}};
}
export async function saveRoomWithin(db,user,rowId,body){
    await requireAdministrator(db,user);const old=rowId?await required(db,'rooms','room_id',rowId):null;
    const code=text(body.code,'Mã phòng',40),type=text(body.type||'','Loại phòng',80,false),capacity=numeric(body.capacity,1,5000,'Sức chứa');ensure(Number.isInteger(capacity),'Sức chứa phải là số nguyên.');ensure(typeof body.enabled==='boolean','Chọn trạng thái phòng.');
    await duplicate(db,'rooms','room_code',code,'room_id',rowId);
    if(old){
        const schedules=await db.all("SELECT c.capacity FROM class_schedules sc JOIN classes c ON c.class_id=sc.class_id WHERE sc.room_id=? AND sc.end_date>=? AND c.status NOT IN ('cancelled','completed')",[old.room_id,today()]);
        const exams=await db.all("SELECT c.capacity FROM exam_sessions ex JOIN classes c ON c.class_id=ex.class_id WHERE ex.room_id=? AND ex.exam_date>=? AND ex.status IN ('draft','published')",[old.room_id,today()]);
        ensure(body.enabled||!schedules.length&&!exams.length,'Phòng còn lịch học/thi sắp tới. Chuyển các buổi sang phòng khác trước khi ngừng sử dụng.',409,'ROOM_IN_USE');
        ensure([...schedules,...exams].every(r=>capacity>=Number(r.capacity)),'Sức chứa mới thấp hơn sĩ số tối đa của lớp đã xếp. Điều chỉnh lớp/lịch trước.',409,'ROOM_CAPACITY_CONFLICT');
    }
    const v={room_code:code,room_type:type,capacity},key=old?.room_id||await db.insert('rooms',v);if(old)await db.update('rooms','room_id',key,v);
    const settings=await db.get('SELECT room_id FROM room_settings WHERE room_id=?',[key]);if(settings)await db.update('room_settings','room_id',key,{enabled:body.enabled?1:0});else await db.insert('room_settings',{room_id:key,enabled:body.enabled?1:0});
    await writeAudit(db,user,old?'UPDATE_ROOM':'CREATE_ROOM','rooms',key,old,{...v,enabled:body.enabled},text(body.reason,'Căn cứ',1000));return{id:String(key)};
}
export async function deleteRoomWithin(db,user,rowId,body){await requireAdministrator(db,user);const old=await required(db,'rooms','room_id',rowId);ensure(!await db.get('SELECT room_id FROM room_usage_history WHERE room_id=?',[old.room_id])&&!await db.get('SELECT schedule_id FROM class_schedules WHERE room_id=? LIMIT 1',[old.room_id])&&!await db.get('SELECT exam_id FROM exam_sessions WHERE room_id=? LIMIT 1',[old.room_id]),'Phòng đã có lịch học/thi hoặc lịch sử. Giữ phòng và dùng trạng thái ngừng sử dụng khi không còn lịch sắp tới.',409,'ROOM_HAS_HISTORY');await db.run('DELETE FROM room_settings WHERE room_id=?',[old.room_id]);await db.run('DELETE FROM rooms WHERE room_id=?',[old.room_id]);await writeAudit(db,user,'DELETE_ROOM','rooms',old.room_id,old,null,text(body.reason,'Lý do xóa',1000));return{removed:true};}
export async function roomUsage(db,user,rowId){
    await requireAdministrator(db,user);const room=await required(db,'rooms','room_id',rowId);
    const sessions=await db.all(`SELECT c.class_code,su.name AS subject,sc.day_of_week,sc.start_time,sc.end_time,sc.start_date,sc.end_date,c.status FROM class_schedules sc JOIN classes c ON c.class_id=sc.class_id JOIN subjects su ON su.subject_id=c.subject_id WHERE sc.room_id=? ORDER BY sc.end_date DESC,sc.day_of_week,sc.start_time LIMIT 100`,[room.room_id]);
    const exams=await db.all(`SELECT c.class_code,su.name AS subject,x.exam_date,x.start_time,x.end_time,x.status FROM exam_sessions x JOIN classes c ON c.class_id=x.class_id JOIN subjects su ON su.subject_id=c.subject_id WHERE x.room_id=? ORDER BY x.exam_date DESC,x.start_time LIMIT 100`,[room.room_id]);
    return{code:room.room_code,sessions:sessions.map(s=>({code:s.class_code,subject:s.subject,day:Number(s.day_of_week),start:s.start_time.slice(0,5),end:s.end_time.slice(0,5),from:s.start_date,to:s.end_date,status:s.status})),exams:exams.map(s=>({code:s.class_code,subject:s.subject,date:s.exam_date,start:s.start_time.slice(0,5),end:s.end_time.slice(0,5),status:s.status}))};
}
