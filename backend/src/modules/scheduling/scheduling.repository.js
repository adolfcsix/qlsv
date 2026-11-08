export async function scheduleRows(db, classId=null) {
    const rows=await db.all(`SELECT sc.*,r.room_code,c.class_code,c.capacity,c.status,c.lecturer_id AS primary_teacher
        FROM class_schedules sc JOIN classes c ON c.class_id=sc.class_id JOIN rooms r ON r.room_id=sc.room_id
        ${classId?'WHERE sc.class_id=?':''} ORDER BY sc.day_of_week,sc.start_time`,classId?[classId]:[]);
    const periodRows=new Map((await db.all('SELECT * FROM schedule_periods')).map(p=>[p.schedule_id,p]));
    const teachers=await db.all('SELECT st.*,l.full_name FROM schedule_teachers st JOIN lecturers l ON l.lecturer_id=st.lecturer_id');
    const overrides=new Set((await db.all('SELECT schedule_id FROM schedule_options')).map(r=>r.schedule_id));
    const audienceModes = new Set((await db.all('SELECT schedule_id FROM schedule_audience_modes')).map(r=>r.schedule_id));
    const audiences = await db.all('SELECT sa.*,g.group_code FROM schedule_audiences sa JOIN student_groups g ON g.student_group_id=sa.student_group_id');
    const names=new Map((await db.all('SELECT lecturer_id,full_name FROM lecturers')).map(l=>[l.lecturer_id,l.full_name]));
    return rows.map(r=>{const assigned=overrides.has(r.schedule_id)?teachers.filter(t=>t.schedule_id===r.schedule_id).map(t=>t.lecturer_id):r.primary_teacher?[r.primary_teacher]:[];
        const p=periodRows.get(r.schedule_id);return {...r,periods:p?{first:p.first_period===null?null:Number(p.first_period),count:Number(p.lesson_count),minutes:Number(p.lesson_minutes),breakMinutes:Number(p.break_minutes),activity:p.activity}:null,audienceMode:audienceModes.has(r.schedule_id)?'custom':'inherit',groupIds:audiences.filter(a=>a.schedule_id===r.schedule_id).map(a=>String(a.student_group_id)),groupNames:audiences.filter(a=>a.schedule_id===r.schedule_id).map(a=>a.group_code),id:String(r.schedule_id),classId:String(r.class_id),day:Number(r.day_of_week),start:String(r.start_time).slice(0,5),end:String(r.end_time).slice(0,5),from:r.start_date,to:r.end_date,roomId:String(r.room_id),room:r.room_code,teacherIds:assigned.map(String),teacherNames:assigned.map(x=>names.get(x)||'Giảng viên')};});
}
export async function sectionRoster(db,classId) {
    const targets=new Set((await db.all('SELECT student_group_id FROM section_targets WHERE class_id=?',[classId])).map(r=>r.student_group_id));
    const rows=await db.all(`SELECT e.*,s.student_code,s.full_name,s.student_group_id,g.group_code,g.name AS group_name,
        EXISTS(SELECT 1 FROM course_results cr WHERE cr.enrollment_id=e.enrollment_id AND cr.is_published=1) AS published,
        EXISTS(SELECT 1 FROM enrollment_requests er WHERE er.enrollment_id=e.enrollment_id AND er.status='approved') AS approved_request
        FROM enrollments e JOIN students s ON s.student_id=e.student_id JOIN student_groups g ON g.student_group_id=s.student_group_id
        WHERE e.class_id=? AND e.status NOT IN ('cancelled','withdrawn') ORDER BY s.student_code`,[classId]);
    return rows.map(r=>({id:String(r.enrollment_id),studentId:String(r.student_id),code:r.student_code,name:r.full_name,group:r.group_name,groupCode:r.group_code,status:r.status,published:!!r.published,external:targets.size>0&&!targets.has(r.student_group_id),source:r.approved_request?'Đăng ký đã duyệt':'Cán bộ phân lớp'}));
}

export function attendsSchedule(session, groupId, baseGroups = []) {
    return session.audienceMode !== 'custom' || session.groupIds.includes(String(groupId)) ||
        baseGroups.length > 0 && !baseGroups.map(String).includes(String(groupId));
}
export function schedulesOverlap(a,b) {
    if(Number(a.day)!==Number(b.day)||a.start>=b.end||a.end<=b.start)return false;
    const from=a.from>b.from?a.from:b.from,to=a.to<b.to?a.to:b.to;
    if(from>to)return false;
    const d=new Date(from+'T00:00:00Z');
    d.setUTCDate(d.getUTCDate()+(Number(a.day)-(d.getUTCDay()||7)+7)%7);
    return d.toISOString().slice(0,10)<=to;
}
