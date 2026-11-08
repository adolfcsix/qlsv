import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { requireAdministrator } from '../../middlewares/authorize.js';
import { listParameters } from '../organization/organization.service.js';
import { scheduleRows } from '../scheduling/scheduling.repository.js';

export async function loadOverview(db,user,params){
    await requireAdministrator(db,user);const q=listParameters(params),kind=params.get('kind')||'students';ensure(['students','sections','pending'].includes(kind),'Danh sách tổng quan không hợp lệ.');
    const cohorts=await db.all('SELECT * FROM cohorts ORDER BY admission_year DESC'),departments=await db.all('SELECT * FROM departments ORDER BY department_code'),majors=await db.all('SELECT * FROM majors ORDER BY major_code');
    const groups=await db.all('SELECT g.*,p.major_id,p.admission_year,m.department_id FROM student_groups g JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id');
    const cohortId=params.get('cohortId')?id(params.get('cohortId')):null,groupId=params.get('groupId')?id(params.get('groupId')):null;
    const year=cohortId?cohorts.find(c=>c.cohort_id===cohortId)?.admission_year:null;
    const selectedGroups=groups.filter(g=>(!cohortId||g.admission_year===year)&&(!q.departmentId||g.department_id===q.departmentId)&&(!q.majorId||g.major_id===q.majorId)&&(!groupId||g.student_group_id===groupId));
    const groupIds=new Set(selectedGroups.map(g=>g.student_group_id));
    const students=(await db.all(`SELECT s.student_id AS id,s.student_code AS code,s.full_name AS name,s.status,s.student_group_id,g.group_code,g.name AS groupName,p.admission_year,m.name AS major,d.name AS department,m.department_id
        FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id JOIN departments d ON d.department_id=m.department_id ORDER BY s.student_code`)).filter(s=>groupIds.has(s.student_group_id));
    const studentIds=new Set(students.map(s=>s.id)),scoped=!!(cohortId||q.departmentId||q.majorId||groupId);
    const teachers=(await db.all('SELECT lecturer_id,department_id,user_id FROM lecturers')).filter(l=>!q.departmentId||l.department_id===q.departmentId),staffs=(await db.all('SELECT staff_id,department_id,user_id FROM staffs')).filter(l=>!q.departmentId||l.department_id===q.departmentId);
    const targets=await db.all('SELECT * FROM section_targets'),enrollments=await db.all("SELECT class_id,student_id FROM enrollments WHERE status NOT IN ('cancelled','withdrawn')");
    const sessions=await scheduleRows(db),classes=(await db.all(`SELECT c.*,su.name AS subject,se.name AS semester,ay.name AS yearName FROM classes c JOIN subjects su ON su.subject_id=c.subject_id JOIN semesters se ON se.semester_id=c.semester_id JOIN academic_years ay ON ay.academic_year_id=se.academic_year_id WHERE c.status NOT IN ('cancelled','completed') ORDER BY c.class_code`)).filter(c=>!scoped||targets.some(t=>t.class_id===c.class_id&&groupIds.has(t.student_group_id))||enrollments.some(e=>e.class_id===c.class_id&&studentIds.has(e.student_id)));
    const pending=(await db.all(`SELECT r.request_id AS id,s.student_id,s.student_code AS code,s.full_name AS name,c.class_code,su.name AS subject,r.requested_at FROM enrollment_requests r JOIN students s ON s.student_id=r.student_id JOIN classes c ON c.class_id=r.class_id JOIN subjects su ON su.subject_id=c.subject_id WHERE r.status='pending' ORDER BY r.request_id DESC`)).filter(r=>studentIds.has(r.student_id));
    const accountCounts=await db.get(`SELECT SUM(CASE WHEN u.status='active' AND a.user_id IS NULL THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN u.status='locked' AND a.user_id IS NULL THEN 1 ELSE 0 END) AS locked,SUM(CASE WHEN a.user_id IS NOT NULL THEN 1 ELSE 0 END) AS archived FROM users u LEFT JOIN account_archives a ON a.user_id=u.user_id`);
    const unassigned=Number((await db.get('SELECT (SELECT COUNT(*) FROM students WHERE user_id IS NULL)+(SELECT COUNT(*) FROM lecturers WHERE user_id IS NULL)+(SELECT COUNT(*) FROM staffs WHERE user_id IS NULL) AS n')).n);
    const rooms=Number((await db.get('SELECT COUNT(*) AS n FROM rooms')).n),disabled=Number((await db.get('SELECT COUNT(*) AS n FROM room_settings WHERE enabled=0')).n);
    const noSchedule=classes.filter(c=>!sessions.some(s=>s.classId===String(c.class_id))).length;
    const noTeacher=classes.filter(c=>{const slots=sessions.filter(s=>s.classId===String(c.class_id));return slots.length?slots.some(s=>!s.teacherIds.length):!c.lecturer_id;}).length;
    const issue=params.get('issue')||'';ensure(['','no-schedule','no-teacher'].includes(issue),'Bộ lọc công việc không hợp lệ.');
    const classItems=classes.map(c=>({id:String(c.class_id),code:c.class_code,name:c.subject,semester:c.semester+' · '+c.yearName,status:c.status,capacity:Number(c.capacity),enrolled:enrollments.filter(e=>e.class_id===c.class_id).length,sessions:sessions.filter(s=>s.classId===String(c.class_id)).length,needsTeacher:(()=>{const slots=sessions.filter(s=>s.classId===String(c.class_id));return slots.length?slots.some(s=>!s.teacherIds.length):!c.lecturer_id;})()}));
    let list=kind==='sections'?classItems:kind==='pending'?pending.map(p=>({id:String(p.id),code:p.code,name:p.name,classCode:p.class_code,subject:p.subject,requestedAt:p.requested_at})):students.map(s=>({id:String(s.id),code:s.code,name:s.name,status:s.status,group:s.groupName,major:s.major,department:s.department,cohort:s.admission_year}));
    if(kind==='sections'&&issue)list=list.filter(c=>issue==='no-schedule'?c.sessions===0:c.needsTeacher);
    if(q.search){const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').replaceAll('Đ','d').toLowerCase();list=list.filter(r=>norm(Object.values(r).join(' ')).includes(q.normalized));}
    const total=list.length,pages=Math.max(1,Math.ceil(total/q.limit)),page=Math.min(q.page,pages);
    return{kind,issue,counts:{students:students.length,lecturers:teachers.length,staffs:staffs.length,groups:selectedGroups.length,sections:classes.length,pending:pending.length,activeAccounts:Number(accountCounts.active||0),lockedAccounts:Number(accountCounts.locked||0),archivedAccounts:Number(accountCounts.archived||0),unassigned,rooms,disabledRooms:disabled,noSchedule,noTeacher},
        byDepartment:departments.filter(d=>!q.departmentId||d.department_id===q.departmentId).map(d=>({id:String(d.department_id),code:d.department_code,name:d.name,students:students.filter(s=>s.department_id===d.department_id).length,lecturers:teachers.filter(l=>l.department_id===d.department_id).length,staffs:staffs.filter(l=>l.department_id===d.department_id).length})),
        statuses:[...new Set(students.map(s=>s.status))].map(status=>({status,count:students.filter(s=>s.status===status).length})),
        items:list.slice((page-1)*q.limit,page*q.limit),pagination:{page,limit:q.limit,total,pages},
        options:{cohorts:cohorts.map(c=>({id:String(c.cohort_id),name:c.name})),departments:departments.map(d=>({id:String(d.department_id),name:d.name})),majors:majors.map(m=>({id:String(m.major_id),name:m.name,departmentId:String(m.department_id)})),groups:groups.map(g=>({id:String(g.student_group_id),name:g.name,majorId:String(g.major_id),departmentId:String(g.department_id),cohortId:String(cohorts.find(c=>c.admission_year===g.admission_year)?.cohort_id||'')}))}};
}
