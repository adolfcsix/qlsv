import { ensure } from '../../core/errors.js';
import { id, text } from '../../utils/validation.js';
import { registerCourse } from './enrollments.service.js';
import { writeAudit } from '../audit/audit.service.js';

const now=()=>new Date().toISOString();
export async function submitEnrollmentRequests(db,user,body) {
    ensure(user.role==='STUDENT','Chỉ sinh viên gửi đăng ký học phần.',403);
    ensure(Array.isArray(body.classIds)&&body.classIds.length>0&&body.classIds.length<=20,'Chọn từ 1 đến 20 lớp.');
    return db.tx(async()=>{
        const student=await db.get('SELECT * FROM students WHERE user_id=?',[user.user_id]);
        ensure(student,'Tài khoản chưa gắn sinh viên.',404);
        ensure(!body.studentId||id(body.studentId)===student.student_id,'Không gửi đăng ký thay người khác.',403);
        const requestIds=[];
        for(const classId of new Set(body.classIds.map(id))) {
            const existing=await db.get("SELECT enrollment_id FROM enrollments WHERE student_id=? AND class_id=? AND status NOT IN ('cancelled','withdrawn')",[student.student_id,classId]);
            ensure(!existing,'Bạn đã có trong lớp này.',409);
            const pending=await db.get("SELECT request_id FROM enrollment_requests WHERE student_id=? AND class_id=? AND status='pending'",[student.student_id,classId]);
            if(pending){requestIds.push(String(pending.request_id));continue;}
            await registerCourse(db,user,student.student_id,classId,{validateOnly:true});
            const requestId=await db.insert('enrollment_requests',{student_id:student.student_id,class_id:classId,status:'pending',requested_at:now()});
            requestIds.push(String(requestId));
            await writeAudit(db,user,'REQUEST_ENROLLMENT','enrollment_requests',requestId);
        }
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {requestIds,pending:true};
    });
}
export async function listEnrollmentRequests(db,user,params) {
    ensure(['STUDENT','ACADEMIC_STAFF'].includes(user.role),'Không có quyền xem đăng ký.',403);
    const where=[],args=[];
    if(user.role==='STUDENT'){where.push('s.user_id=?');args.push(user.user_id);}
    if(params.get('classId')){where.push('r.class_id=?');args.push(id(params.get('classId')));}
    if(params.get('status')){const status=params.get('status');ensure(['pending','approved','rejected','cancelled'].includes(status),'Trạng thái không hợp lệ.');where.push('r.status=?');args.push(status);}
    const rawPage=params.get('page')||'1';
    ensure(/^[1-9]\d*$/.test(rawPage)&&Number.isSafeInteger(Number(rawPage))&&Number(rawPage)<=1000000,'Trang đăng ký không hợp lệ.');
    const page=Number(rawPage);
    const condition=where.length?' WHERE '+where.join(' AND '):'';
    const from=`FROM enrollment_requests r JOIN students s ON s.student_id=r.student_id JOIN classes c ON c.class_id=r.class_id JOIN subjects su ON su.subject_id=c.subject_id JOIN student_groups g ON g.student_group_id=s.student_group_id`;
    const count=await db.get(`SELECT COUNT(*) AS n ${from}${condition}`,args);
    const rows=await db.all(`SELECT r.*,s.student_code,s.full_name,g.name AS group_name,c.class_code,su.name AS subject FROM enrollment_requests r JOIN students s ON s.student_id=r.student_id JOIN classes c ON c.class_id=r.class_id JOIN subjects su ON su.subject_id=c.subject_id JOIN student_groups g ON g.student_group_id=s.student_group_id${condition} ORDER BY r.request_id DESC LIMIT 50 OFFSET ?`,[...args,(page-1)*50]);
    return {items:rows.map(r=>({id:String(r.request_id),studentId:String(r.student_id),classId:String(r.class_id),studentCode:r.student_code,studentName:r.full_name,group:r.group_name,classCode:r.class_code,subject:r.subject,status:r.status,reason:r.reason||'',requestedAt:r.requested_at})),pagination:{page,limit:50,total:Number(count.n),pages:Math.max(1,Math.ceil(Number(count.n)/50))}};
}
export async function reviewEnrollmentRequest(db,user,requestId,body) {
    ensure(user.role==='ACADEMIC_STAFF','Chỉ cán bộ đào tạo được duyệt đăng ký.',403);
    ensure(['approve','reject'].includes(body.decision),'Quyết định không hợp lệ.');
    const reason=text(body.reason||'', 'Ý kiến xử lý',1000,body.decision==='reject');
    return db.tx(async()=>{
        const row=await db.get('SELECT * FROM enrollment_requests WHERE request_id=?',[id(requestId)]);
        ensure(row,'Không tìm thấy đăng ký.',404);
        ensure(row.status==='pending','Đăng ký đã được xử lý.',409);
        const enrollmentId=body.decision==='approve'?await registerCourse(db,user,row.student_id,row.class_id,{staffAssignment:true}):null;
        const status=body.decision==='approve'?'approved':'rejected';
        await db.update('enrollment_requests','request_id',row.request_id,{status,enrollment_id:enrollmentId,reviewed_by:user.user_id,reviewed_at:now(),reason});
        await writeAudit(db,user,'REVIEW_ENROLLMENT','enrollment_requests',row.request_id,{status:'pending'},{status,enrollmentId},reason);
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {status,enrollmentId:enrollmentId?String(enrollmentId):null};
    });
}
export async function cancelEnrollmentRequest(db,user,requestId) {
    ensure(user.role==='STUDENT','Chỉ sinh viên rút đăng ký đang chờ của mình.',403);
    return db.tx(async()=>{
        const row=await db.get('SELECT r.* FROM enrollment_requests r JOIN students s ON s.student_id=r.student_id WHERE r.request_id=? AND s.user_id=?',[id(requestId),user.user_id]);
        ensure(row,'Không tìm thấy đăng ký trong phạm vi của bạn.',404);
        ensure(row.status==='pending','Đăng ký không còn chờ duyệt.',409);
        await db.update('enrollment_requests','request_id',row.request_id,{status:'cancelled',reason:'Sinh viên rút yêu cầu',reviewed_at:now()});
        await writeAudit(db,user,'CANCEL_ENROLLMENT_REQUEST','enrollment_requests',row.request_id);
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {status:'cancelled'};
    });
}
