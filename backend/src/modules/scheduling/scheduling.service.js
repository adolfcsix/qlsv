import { validatePeriods, writePeriods } from './periods.js';
import { ensure, AppError } from '../../core/errors.js';
import { id, text, numeric, dateOnly, timeOnly } from '../../utils/validation.js';
import { academic, required, duplicate } from '../operations/change-utils.js';
import { writeAudit } from '../audit/audit.service.js';
import { registerCourse } from '../enrollments/enrollments.service.js';
import { scheduleRows, sectionRoster, attendsSchedule, schedulesOverlap } from './scheduling.repository.js';

const active="status NOT IN ('cancelled','withdrawn')";
async function revision(db,body) {
    ensure(Number.isSafeInteger(body.revision),'Thiếu phiên bản dữ liệu. Tải lại trang.');
    const current=await db.get('SELECT revision FROM app_lock WHERE lock_id=1');
    ensure(current.revision===body.revision,'Dữ liệu đã đổi. Hãy tải lại trước khi lưu.',409,'STALE_REVISION');
}
async function finish(db,user,action,entity,key,before=null,after=null,reason='') {
    await writeAudit(db,user,action,entity,key,before,after,reason);
    await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
}
export { schedulesOverlap } from './scheduling.repository.js';
export async function validateSchedule(db,course,candidate,except=null) {
    const room=await required(db,'rooms','room_id',candidate.roomId);
    const setting=await db.get('SELECT enabled FROM room_settings WHERE room_id=?',[room.room_id]);
    ensure(setting?.enabled!==0,'Phòng đang ngừng sử dụng. Chọn phòng khác.',409,'ROOM_DISABLED');
    ensure(Number(room.capacity)>=Number(course.capacity),'Phòng không đủ sức chứa theo sĩ số tối đa của lớp.',409);
    const semester=await required(db,'semesters','semester_id',course.semester_id);
    ensure(candidate.from>=semester.start_date&&candidate.to<=semester.end_date,'Thời gian hiệu lực phải nằm trong học kỳ.');
    ensure(schedulesOverlap(candidate,candidate),'Khoảng ngày đã chọn không có ngày học tương ứng.');
    for(const teacher of candidate.teacherIds)await required(db,'lecturers','lecturer_id',teacher);
    const others=await scheduleRows(db);
    for(const other of others) {
        if(String(other.id)===String(except)||other.status==='cancelled'||!schedulesOverlap(candidate,other))continue;
        ensure(Number(other.class_id)!==Number(course.class_id),'Hai buổi của cùng lớp bị trùng giờ.',409,'SCHEDULE_CONFLICT');
        ensure(String(other.roomId)!==String(candidate.roomId),`Trùng phòng với ${other.class_code}.`,409,'ROOM_CONFLICT');
        ensure(!other.teacherIds.some(t=>candidate.teacherIds.includes(t)),`Giảng viên trùng lịch với ${other.class_code}.`,409,'TEACHER_CONFLICT');
        const baseA=(await db.all('SELECT student_group_id FROM section_targets WHERE class_id=?',[course.class_id])).map(r=>String(r.student_group_id));
        const baseB=(await db.all('SELECT student_group_id FROM section_targets WHERE class_id=?',[other.class_id])).map(r=>String(r.student_group_id));
        const students=await db.all(`SELECT s.student_group_id FROM enrollments a JOIN enrollments b ON b.student_id=a.student_id JOIN students s ON s.student_id=a.student_id
            WHERE a.class_id=? AND b.class_id=? AND a.status NOT IN ('cancelled','withdrawn') AND b.status NOT IN ('cancelled','withdrawn')`,[course.class_id,other.class_id]);
        ensure(!students.some(s=>attendsSchedule(candidate,s.student_group_id,baseA)&&attendsSchedule(other,s.student_group_id,baseB)),`Sinh viên trong lớp trùng lịch với ${other.class_code}.`,409,'STUDENT_SCHEDULE_CONFLICT');
        const groupsA=candidate.audienceMode==='custom'?candidate.groupIds:baseA;
        const groupsB=other.audienceMode==='custom'?other.groupIds:baseB;
        ensure(!groupsA.some(g=>groupsB.includes(g)),`Lớp hành chính đã có lịch ở ${other.class_code}.`,409,'GROUP_SCHEDULE_CONFLICT');
    }
    if(!await db.get('SELECT room_id FROM room_usage_history WHERE room_id=?',[room.room_id]))await db.insert('room_usage_history',{room_id:room.room_id});
}
export async function loadStaffScheduling(db,user,params) {
    academic(user);
    const classes=await db.all(`SELECT c.*,su.name AS subjectName,se.name AS semesterName,ay.name AS yearName,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id=c.class_id AND e.status NOT IN ('cancelled','withdrawn')) AS count
        FROM classes c JOIN subjects su ON su.subject_id=c.subject_id JOIN semesters se ON se.semester_id=c.semester_id JOIN academic_years ay ON ay.academic_year_id=se.academic_year_id ORDER BY se.start_date DESC,c.class_code`);
    const groups=await db.all(`SELECT g.*,p.major_id,p.admission_year,m.department_id FROM student_groups g JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id`);
    const targets=await db.all('SELECT * FROM section_targets');
    const cohort=params.get('cohort'),department=params.get('department'),major=params.get('major'),group=params.get('group');
    let allowedGroups=groups.filter(g=>(!cohort||String(g.admission_year)===cohort)&&(!department||String(g.department_id)===department)&&(!major||String(g.major_id)===major)&&(!group||String(g.student_group_id)===group));
    const scoped=classes.filter(c=>!cohort&&!department&&!major&&!group||targets.some(t=>t.class_id===c.class_id&&allowedGroups.some(g=>g.student_group_id===t.student_group_id)));
    const classId=params.get('classId')?id(params.get('classId')):scoped.find(c=>c.status!=='cancelled'&&c.status!=='completed')?.class_id;
    const course=scoped.find(c=>c.class_id===classId)||null;
    return {classes:scoped.map(c=>({id:String(c.class_id),code:c.class_code,subjectId:String(c.subject_id),subject:c.subjectName,semesterId:String(c.semester_id),semester:`${c.semesterName} · ${c.yearName}`,capacity:Number(c.capacity),count:Number(c.count),lecturerId:c.lecturer_id?String(c.lecturer_id):'',status:c.status})),classId:course?String(classId):'',
        schedules:course?await scheduleRows(db,classId):[],roster:course?await sectionRoster(db,classId):[],
        targets:course?groups.filter(g=>targets.some(t=>t.class_id===classId&&t.student_group_id===g.student_group_id)).map(g=>({id:String(g.student_group_id),code:g.group_code,name:g.name})):[],
        rooms:(await db.all('SELECT r.* FROM rooms r LEFT JOIN room_settings rs ON rs.room_id=r.room_id WHERE COALESCE(rs.enabled,1)=1 ORDER BY r.room_code')).map(r=>({id:String(r.room_id),code:r.room_code,capacity:Number(r.capacity)})),
        semesters:(await db.all('SELECT * FROM semesters ORDER BY start_date DESC')).map(s=>({id:String(s.semester_id),name:s.name,start:s.start_date,end:s.end_date})),
        revision:(await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision};
}
export async function saveSection(db,user,classId,body) {
    academic(user);
    return db.tx(async()=>{
        await revision(db,body);
        const old=classId?await required(db,'classes','class_id',classId):null;
        ensure(!old||!['completed','cancelled'].includes(old.status),'Lớp đã hoàn tất hoặc hủy; không sửa trực tiếp.',409);
        const capacity=numeric(body.capacity,1,500,'Sĩ số tối đa');ensure(Number.isInteger(capacity),'Sĩ số phải nguyên.');
        const code=text(body.code,'Mã lớp',50);await duplicate(db,'classes','class_code',code,'class_id',classId);
        const lecturerId=body.lecturerId?id(body.lecturerId):null;
        if(lecturerId)await required(db,'lecturers','lecturer_id',lecturerId);
        const values={class_code:code,capacity,lecturer_id:lecturerId,status:body.status||old?.status||'open'};
        ensure(['open','closed','teaching'].includes(values.status),'Trạng thái lớp không hợp lệ.');
        if(old) {
            const count=await db.get(`SELECT COUNT(*) AS n FROM enrollments WHERE class_id=? AND ${active}`,[old.class_id]);
            ensure(capacity>=Number(count.n),'Sĩ số tối đa thấp hơn số sinh viên hiện có.',409);
            await db.update('classes','class_id',old.class_id,values);
            const updated={...old,...values};
            for(const schedule of await scheduleRows(db,old.class_id))await validateSchedule(db,updated,schedule,schedule.id);
        } else {
            const subject=await required(db,'subjects','subject_id',body.subjectId),semester=await required(db,'semesters','semester_id',body.semesterId);
            Object.assign(values,{subject_id:subject.subject_id,semester_id:semester.semester_id});
        }
        const key=old?.class_id||await db.insert('classes',values);
        if(!old)for(const [name,type,weight] of [['Quá trình','process',20],['Giữa kỳ','midterm',30],['Cuối kỳ','final',50]])await db.insert('assessments',{class_id:key,name,assessment_type:type,weight,max_score:10});
        await finish(db,user,old?'UPDATE_CLASS':'CREATE_CLASS','classes',key,old,values);
        return {id:String(key)};
    });
}
export async function saveSchedule(db,user,classId,scheduleId,body) {
    academic(user);
    return db.tx(async()=>{
        await revision(db,body);
        const course=await required(db,'classes','class_id',classId);
        ensure(!['cancelled','completed'].includes(course.status),'Lớp không còn cho phép xếp lịch.',409);
        const old=scheduleId?await required(db,'class_schedules','schedule_id',scheduleId):null;
        ensure(!old||old.class_id===course.class_id,'Buổi học không thuộc lớp.',409);
        const day=numeric(body.day,1,7,'Thứ');ensure(Number.isInteger(day),'Thứ phải nguyên.');
        const from=dateOnly(body.from),to=dateOnly(body.to),start=timeOnly(body.start),end=timeOnly(body.end);
        ensure(to>=from&&end>start,'Khoảng thời gian học không hợp lệ.');
        ensure(Array.isArray(body.teacherIds)&&body.teacherIds.length<=10,'Chọn tối đa 10 giảng viên cho một buổi.');
        const teacherIds=[...new Set(body.teacherIds.map(x=>String(id(x))))];
        const previous=old?(await scheduleRows(db,course.class_id)).find(s=>s.id===String(old.schedule_id)):null;
        const periods=validatePeriods(body.periods===undefined?previous?.periods||null:body.periods,start,end);
        const candidate={day,from,to,start,end,roomId:String(id(body.roomId)),teacherIds,audienceMode:previous?.audienceMode || 'inherit',groupIds:previous?.groupIds || []};
        await validateSchedule(db,course,candidate,scheduleId);
        const values={class_id:course.class_id,room_id:id(body.roomId),day_of_week:day,start_time:start+':00',end_time:end+':00',start_date:from,end_date:to};
        const key=old?.schedule_id||await db.insert('class_schedules',values);
        if(old)await db.update('class_schedules','schedule_id',key,values);
        await writePeriods(db,key,periods);
        await db.run('DELETE FROM schedule_teachers WHERE schedule_id=?',[key]);
        if(!await db.get('SELECT schedule_id FROM schedule_options WHERE schedule_id=?',[key]))await db.insert('schedule_options',{schedule_id:key,teacher_override:1});
        for(const teacher of teacherIds)await db.insert('schedule_teachers',{schedule_id:key,lecturer_id:Number(teacher)});
        await finish(db,user,old?'UPDATE_SCHEDULE':'CREATE_SCHEDULE','class_schedules',key,old?{...old,periods:previous?.periods||null}:null,{...values,teacherIds,periods});
        return {id:String(key)};
    });
}
export async function deleteSchedule(db,user,scheduleId,body) {
    academic(user);return db.tx(async()=>{await revision(db,body);const old=await required(db,'class_schedules','schedule_id',scheduleId);const course=await required(db,'classes','class_id',old.class_id);ensure(!['completed','cancelled'].includes(course.status),'Không xóa lịch của lớp đã hoàn tất/hủy.',409);await db.run('DELETE FROM schedule_teachers WHERE schedule_id=?',[old.schedule_id]);await db.run('DELETE FROM schedule_options WHERE schedule_id=?',[old.schedule_id]);await db.run('DELETE FROM schedule_audiences WHERE schedule_id=?',[old.schedule_id]);await db.run('DELETE FROM schedule_audience_modes WHERE schedule_id=?',[old.schedule_id]);await db.run('DELETE FROM class_schedules WHERE schedule_id=?',[old.schedule_id]);await finish(db,user,'DELETE_SCHEDULE','class_schedules',old.schedule_id,old,null,text(body.reason,'Lý do',1000));return {removed:true};});
}
async function removeMemberWithin(db,user,enrollmentId,reason) {
    const row=await required(db,'enrollments','enrollment_id',enrollmentId);
    ensure(!await db.get('SELECT result_id FROM course_results WHERE enrollment_id=? AND is_published=1',[row.enrollment_id]),'Sinh viên có kết quả đã công bố; không được gỡ khỏi lớp.',409);
    ensure(['registered','studying'].includes(row.status),'Lần học không còn đang hoạt động.',409);
    await db.update('enrollments','enrollment_id',row.enrollment_id,{status:'cancelled'});
    await writeAudit(db,user,'REMOVE_CLASS_MEMBER','enrollments',row.enrollment_id,row,{status:'cancelled'},reason);
}
export async function changeTargets(db,user,classId,body,scheduleId=null) {
    academic(user);return db.tx(async()=>{
        await revision(db,body);const course=await required(db,'classes','class_id',classId);
        ensure(!['completed','cancelled'].includes(course.status),'Lớp không còn cho phép phân lớp.',409);
        if(scheduleId){const slot=await required(db,'class_schedules','schedule_id',scheduleId);ensure(slot.class_id===course.class_id,'Buổi học không thuộc lớp.',409);}
        if(scheduleId&&body.scope==='inherit') {
            await db.run('DELETE FROM schedule_audiences WHERE schedule_id=?',[id(scheduleId)]);
            await db.run('DELETE FROM schedule_audience_modes WHERE schedule_id=?',[id(scheduleId)]);
            for(const slot of await scheduleRows(db,course.class_id))await validateSchedule(db,course,slot,slot.id);
            await finish(db,user,'RESET_SESSION_AUDIENCE','class_schedules',id(scheduleId));return {groups:0,affected:0};
        }
        ensure(['group','cohort','department','major'].includes(body.scope)&&['add','remove'].includes(body.mode),'Phạm vi hoặc thao tác không hợp lệ.');
        const ref=id(body.referenceId);
        const filters={group:'g.student_group_id',cohort:'p.admission_year',department:'m.department_id',major:'m.major_id'};
        let value=ref;if(body.scope==='cohort')value=(await required(db,'cohorts','cohort_id',ref)).admission_year;
        const groups=await db.all(`SELECT g.student_group_id FROM student_groups g JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id WHERE ${filters[body.scope]}=?`,[value]);
        ensure(groups.length,'Không có lớp hành chính trong phạm vi đã chọn.');
        if(scheduleId&&!await db.get('SELECT schedule_id FROM schedule_audience_modes WHERE schedule_id=?',[id(scheduleId)])) {
            await db.insert('schedule_audience_modes',{schedule_id:id(scheduleId)});
            if(body.mode==='remove') {
                const current=await db.all('SELECT student_group_id FROM section_targets WHERE class_id=?',[course.class_id]);
                for(const row of current)await db.insert('schedule_audiences',{schedule_id:id(scheduleId),student_group_id:row.student_group_id});
            }
        }
        let affected=0;
        for(const group of groups) {
            const key=group.student_group_id;
            const exists=await db.get('SELECT class_id FROM section_targets WHERE class_id=? AND student_group_id=?',[course.class_id,key]);
            if(scheduleId){
                const present=await db.get('SELECT schedule_id FROM schedule_audiences WHERE schedule_id=? AND student_group_id=?',[id(scheduleId),key]);
                if(body.mode==='add'&&!present)await db.insert('schedule_audiences',{schedule_id:id(scheduleId),student_group_id:key});
                if(body.mode==='remove')await db.run('DELETE FROM schedule_audiences WHERE schedule_id=? AND student_group_id=?',[id(scheduleId),key]);
            }
            if(body.mode==='add'&&!exists)await db.insert('section_targets',{class_id:course.class_id,student_group_id:key});
            if(body.mode==='remove'&&!scheduleId)await db.run('DELETE FROM section_targets WHERE class_id=? AND student_group_id=?',[course.class_id,key]);
            if(body.syncStudents===true) {
                if(body.mode==='add') {
                    const students=await db.all("SELECT student_id,student_code,full_name FROM students WHERE student_group_id=? AND status='studying'",[key]);
                    for(const student of students){try{await registerCourse(db,user,student.student_id,course.class_id,{staffAssignment:true});affected++;}catch(error){throw new AppError(error.status||422,error.code||'ASSIGNMENT_FAILED',`${student.student_code} · ${student.full_name}: ${error.message}`);}}
                } else if(!scheduleId) {
                    const rows=await db.all("SELECT e.enrollment_id FROM enrollments e JOIN students s ON s.student_id=e.student_id WHERE e.class_id=? AND s.student_group_id=? AND e.status IN ('registered','studying')",[course.class_id,key]);
                    for(const row of rows){await removeMemberWithin(db,user,row.enrollment_id,'Gỡ đối tượng lớp theo cán bộ');affected++;}
                }
            }
        }
        // Check target group collisions even if their students have not been assigned yet.
        for(const schedule of await scheduleRows(db,course.class_id))await validateSchedule(db,course,schedule,schedule.id);
        await finish(db,user,scheduleId?'UPDATE_SESSION_TARGETS':'UPDATE_CLASS_TARGETS',scheduleId?'class_schedules':'classes',scheduleId?id(scheduleId):course.class_id,null,{scope:body.scope,referenceId:ref,mode:body.mode,syncStudents:body.syncStudents===true,affected});
        return {groups:groups.length,affected};
    });
}
export async function addMember(db,user,classId,body) {
    academic(user);return db.tx(async()=>{await revision(db,body);const enrollmentId=await registerCourse(db,user,id(body.studentId),id(classId),{staffAssignment:true});await finish(db,user,'ASSIGN_CLASS_MEMBER','enrollments',enrollmentId,null,{studentId:body.studentId,classId},text(body.reason,'Lý do phân lớp',1000));return {enrollmentId:String(enrollmentId)};});
}
export async function removeMember(db,user,classId,enrollmentId,body) {
    academic(user);return db.tx(async()=>{await revision(db,body);const row=await required(db,'enrollments','enrollment_id',enrollmentId);ensure(row.class_id===id(classId),'Sinh viên không thuộc lớp học phần này.',409);const reason=text(body.reason,'Lý do gỡ khỏi lớp',1000);await removeMemberWithin(db,user,row.enrollment_id,reason);await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');return {removed:true};});
}
export async function deleteSection(db,user,classId,body) {
    academic(user);return db.tx(async()=>{
        await revision(db,body);const row=await required(db,'classes','class_id',classId);const reason=text(body.reason,'Lý do xóa/hủy lớp',1000);
        ensure(row.status!=='completed'&&!await db.get('SELECT r.result_id FROM course_results r JOIN enrollments e ON e.enrollment_id=r.enrollment_id WHERE e.class_id=? AND r.is_published=1 LIMIT 1',[row.class_id]),'Lớp đã có kết quả công bố, không được xóa/hủy.',409);
        const used=await db.get('SELECT enrollment_id FROM enrollments WHERE class_id=? LIMIT 1',[row.class_id]);
        const exam=await db.get('SELECT exam_id FROM exam_sessions WHERE class_id=? LIMIT 1',[row.class_id]);
        const requests=await db.get('SELECT request_id FROM enrollment_requests WHERE class_id=? LIMIT 1',[row.class_id]);
        let archived=!!(used||exam||requests);
        if(archived) {
            await db.update('classes','class_id',row.class_id,{status:'cancelled'});
            await db.run("UPDATE exam_registrations SET status='cancelled' WHERE class_id=? AND status IN ('registered','attended','absent')",[row.class_id]);
            await db.run("UPDATE exam_sessions SET status='cancelled' WHERE class_id=? AND status<>'cancelled'",[row.class_id]);
            await db.run("UPDATE enrollments SET status='cancelled' WHERE class_id=? AND status IN ('registered','studying')",[row.class_id]);
            await db.run("UPDATE enrollment_requests SET status='cancelled',reason=?,reviewed_by=?,reviewed_at=? WHERE class_id=? AND status='pending'",[reason,user.user_id,new Date().toISOString(),row.class_id]);
        } else {
            for(const schedule of await scheduleRows(db,row.class_id)){await db.run('DELETE FROM schedule_teachers WHERE schedule_id=?',[Number(schedule.id)]);await db.run('DELETE FROM schedule_options WHERE schedule_id=?',[Number(schedule.id)]);await db.run('DELETE FROM schedule_audiences WHERE schedule_id=?',[Number(schedule.id)]);await db.run('DELETE FROM schedule_audience_modes WHERE schedule_id=?',[Number(schedule.id)]);}
            await db.run('DELETE FROM class_schedules WHERE class_id=?',[row.class_id]);
            await db.run('DELETE FROM section_targets WHERE class_id=?',[row.class_id]);
            await db.run('DELETE FROM assessments WHERE class_id=?',[row.class_id]);
            await db.run('DELETE FROM classes WHERE class_id=?',[row.class_id]);
        }
        await finish(db,user,archived?'CANCEL_CLASS':'DELETE_CLASS','classes',row.class_id,row,null,reason);
        return {archived};
    });
}
