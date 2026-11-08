import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app.js';
import {openDatabase} from '../backend/src/config/database.js';
import {schedulesOverlap} from '../backend/src/modules/scheduling/scheduling.service.js';
import {staffSchedule} from '../frontend/src/features/timetable/staff-schedule.js';

function client(origin){return{cookie:'',csrf:'',async req(path,method='GET',body){const r=await fetch(origin+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});const payload=await r.json();if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];if(payload.data?.csrf)this.csrf=payload.data.csrf;return{status:r.status,...payload};},login(username){return this.req('/auth/login','POST',{username,password:'Hocvu@2026'});}};}

test('Lịch trùng phải có buổi thực sự trong khoảng ngày, giờ sát nhau không trùng',()=>{
 const a={day:1,from:'2026-11-03',to:'2026-11-08',start:'08:00',end:'09:00'};
 assert.equal(schedulesOverlap(a,a),false);
 const b={...a,from:'2026-11-02'};assert.equal(schedulesOverlap(b,b),true);
 assert.equal(schedulesOverlap(b,{...b,start:'09:00',end:'10:00'}),false);
});

test('V14 cán bộ: ảnh, sĩ số, xếp lịch, phân lớp, đăng ký chờ duyệt và lịch cá nhân',async t=>{
 const db=await openDatabase({driver:'sqlite',file:':memory:'});const {server}=await createApp({db,seed:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`,staff=client(origin),student=client(origin),second=client(origin),lecturer=client(origin),admin=client(origin);
 await db.update('user_security','user_id',5,{must_change_password:0});
 for(const [c,name] of [[staff,'cb001'],[student,'20240001'],[second,'20240002'],[lecturer,'gv001'],[admin,'quantri']])assert.equal((await c.login(name)).status,200);
 const revision=async()=>Number((await staff.req('/state')).data.revision);
 const mutate=async(path,method,body)=>staff.req(path,method,{revision:await revision(),...body});
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9b8AAAAASUVORK5CYII=';
 let groupId,newStudent,classId,slotId,requestId;
 try{
  await t.test('Chỉ cán bộ được vào điều phối; sinh viên/giảng viên/quản trị không ghi được',async()=>{
   assert.equal((await staff.req('/staff/scheduling')).status,200);
   for(const c of [student,lecturer,admin]){assert.equal((await c.req('/staff/scheduling')).status,403);assert.equal((await c.req('/staff/course-sections','POST',{revision:0})).status,403);}
  });
  await t.test('Thêm lớp hành chính có sĩ số; thêm sinh viên có ảnh tùy chọn; giới hạn được giữ ở backend',async()=>{
   const response=await mutate('/student-groups','POST',{after:{id:'new',code:'V14-A',name:'Lớp thử V14',programId:'1',advisor:'1',capacity:1}});assert.equal(response.status,201,JSON.stringify(response));
   groupId=(await db.get('SELECT student_group_id AS id FROM student_groups WHERE group_code=?',['V14-A'])).id;
   const person={id:'new-person',code:'V140001',name:'Ảnh hồ sơ thử nghiệm',dob:'2004-01-01',gender:'Nam',email:'testv14@example.com',phone:'',address:'Hải Phòng',admissionDate:'2026-09-01',groupId:String(groupId),status:'studying',photoData:photo};
   const created=await mutate('/students','POST',{after:person});assert.equal(created.status,201,JSON.stringify(created));
   newStudent=(await db.get('SELECT student_id FROM students WHERE student_code=?',['V140001'])).student_id;
   const next=await mutate('/students','POST',{after:{...person,code:'V140002'}});assert.equal(next.status,409);assert.equal(next.error.code,'GROUP_FULL');
   assert.equal((await db.get('SELECT COUNT(*) AS n FROM student_photos WHERE student_id=?',[newStudent])).n,1);
   const image=await fetch(origin+`/api/v1/students/${newStudent}/photo`,{headers:{Cookie:staff.cookie}});assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/png/);assert.ok((await image.arrayBuffer()).byteLength>12);
   assert.equal((await fetch(origin+`/api/v1/students/${newStudent}/photo`,{headers:{Cookie:student.cookie}})).status,403);
   const own=(await student.req('/state')).data.students[0];assert.equal((await student.req('/students/'+own.id,'PATCH',{revision:await revision(),before:own,after:{...own,photoData:photo}})).status,403);
   const g=(await staff.req('/state')).data.groups.find(g=>g.id===String(groupId));
   assert.equal((await mutate('/student-groups/'+groupId,'PATCH',{before:g,after:{...g,capacity:2}})).status,200);
   const withoutPhoto=await mutate('/students','POST',{after:{...person,code:'V140002',photoData:undefined}});assert.equal(withoutPhoto.status,201);
   assert.equal((await mutate('/student-groups/'+groupId,'PATCH',{before:{...g,capacity:2},after:{...g,capacity:1}})).status,409);
  });
  await t.test('Cán bộ thay/gỡ ảnh; từ chối SVG và giữ dữ liệu khi ảnh không hợp lệ',async()=>{
   let row=(await staff.req('/state')).data.students.find(s=>s.id===String(newStudent));assert.match(row.photoUrl,/\/photo\?v=1/);
   let result=await mutate('/students/'+newStudent,'PATCH',{before:row,after:{...row,name:'Tên không được ghi',photoData:'data:image/svg+xml;base64,PHN2Zy8+'}});assert.equal(result.status,422);
   assert.equal((await db.get('SELECT full_name FROM students WHERE student_id=?',[newStudent])).full_name,'Ảnh hồ sơ thử nghiệm');
   result=await mutate('/students/'+newStudent,'PATCH',{before:row,after:{...row,photoData:photo}});assert.equal(result.status,200);
   row=(await staff.req('/state')).data.students.find(s=>s.id===String(newStudent));assert.match(row.photoUrl,/v=2/);
   assert.equal((await mutate('/students/'+newStudent,'PATCH',{before:row,after:{...row,photoData:''}})).status,200);
   assert.equal((await fetch(origin+`/api/v1/students/${newStudent}/photo`,{headers:{Cookie:staff.cookie}})).status,404);
  });
  await t.test('Tạo lớp học phần rồi thêm buổi có hai giảng viên, lọc đúng lịch giảng viên',async()=>{
   let r=await mutate('/staff/course-sections','POST',{code:'V14-SECTION',subjectId:'2',semesterId:'1',lecturerId:'',capacity:2,status:'open'});assert.equal(r.status,201,JSON.stringify(r));classId=r.data.id;
   r=await mutate(`/staff/course-sections/${classId}/schedules`,'POST',{day:7,start:'16:00',end:'17:00',from:'2026-11-02',to:'2026-11-08',roomId:'1',teacherIds:['1','2']});assert.equal(r.status,200,JSON.stringify(r));slotId=r.data.id;
   const page=await staff.req('/staff/scheduling?classId='+classId);assert.deepEqual(page.data.schedules[0].teacherIds,['1','2']);
   const timetable=(await lecturer.req('/timetable?start=2026-11-02')).data;assert.ok(timetable.items.some(i=>i.id===slotId&&i.teachers.length===2));
   assert.equal((await lecturer.req(`/classes/${classId}/gradebook`)).status,200);
   const raw=staffSchedule({db:(await staff.req('/state')).data,user:{role:'academic'},filters:{},remoteStaffScheduling:{state:'ready',data:page.data},remoteRegistrationRequests:{state:'ready',data:{items:[],pagination:{page:1,pages:1,total:0}}}});
   assert.match(raw,/Thêm sinh viên đích danh/);assert.match(raw,/Gán \/ gỡ đối tượng/);assert.match(raw,/Thêm buổi học/);
  });
  await t.test('Sửa buổi để gỡ/thêm giảng viên; chống trùng phòng/giảng viên và giữ phiên bản cũ khi lỗi',async()=>{
   const original={day:7,start:'16:00',end:'17:00',from:'2026-11-02',to:'2026-11-08',roomId:'1'};
   assert.equal((await mutate(`/staff/course-sections/${classId}/schedules/${slotId}`,'PATCH',{...original,teacherIds:[]})).status,200);
   assert.ok(!(await lecturer.req('/timetable?start=2026-11-02')).data.items.some(i=>i.id===slotId));
   assert.equal((await mutate(`/staff/course-sections/${classId}/schedules/${slotId}`,'PATCH',{...original,teacherIds:['1','2']})).status,200);
   const other=await mutate('/staff/course-sections','POST',{code:'V14-CONFLICT',subjectId:'2',semesterId:'1',lecturerId:'',capacity:2,status:'open'});assert.equal(other.status,201);
   let conflict=await mutate(`/staff/course-sections/${other.data.id}/schedules`,'POST',{...original,roomId:'2',teacherIds:['1']});assert.equal(conflict.status,409);assert.equal(conflict.error.code,'TEACHER_CONFLICT');
   conflict=await mutate(`/staff/course-sections/${other.data.id}/schedules`,'POST',{...original,teacherIds:[]});assert.equal(conflict.status,409);assert.equal(conflict.error.code,'ROOM_CONFLICT');
   assert.equal((await mutate(`/staff/course-sections/${classId}/schedules/${slotId}`,'PATCH',{...original,start:'99:00',end:'99:30',teacherIds:[]})).status,422);
   assert.equal((await staff.req('/staff/scheduling?classId='+classId)).data.schedules[0].start,'16:00');
   assert.equal((await mutate('/staff/course-sections/'+other.data.id,'DELETE',{reason:'Xóa lớp thử không có dữ liệu'})).data.archived,false);
  });
  await t.test('Gán đối tượng theo lớp, khóa, khoa, ngành; lọc phạm vi tìm lại lớp đã gán',async()=>{
   for(const [scope,referenceId] of [['cohort','1'],['department','1'],['major','1'],['group',String(groupId)]]){
    const assigned=await mutate(`/staff/course-sections/${classId}/targets`,'POST',{scope,referenceId,mode:'add',syncStudents:false});assert.equal(assigned.status,200,JSON.stringify(assigned));assert.ok(assigned.data.groups>0);
    assert.equal((await mutate(`/staff/course-sections/${classId}/targets`,'POST',{scope,referenceId,mode:'remove',syncStudents:false})).status,200);
   }
   assert.equal((await mutate(`/staff/course-sections/${classId}/targets`,'POST',{scope:'group',referenceId:String(groupId),mode:'add',syncStudents:false})).status,200);
   assert.ok((await staff.req('/staff/scheduling?group='+groupId)).data.classes.some(c=>c.id===classId));
  });
  await t.test('Gửi đăng ký chưa có enrollment/lịch; chặn gửi hộ, cho rút và từ chối có lý do',async()=>{
   assert.equal((await student.req('/enrollment-requests','POST',{studentId:'2',classIds:[classId]})).status,403);
   let r=await student.req('/enrollment-requests','POST',{classIds:[classId]});assert.equal(r.status,202,JSON.stringify(r));requestId=r.data.requestIds[0];
   assert.equal((await db.get('SELECT COUNT(*) AS n FROM enrollments WHERE class_id=?',[classId])).n,0);
   assert.ok(!(await student.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   assert.equal((await second.req(`/enrollment-requests/${requestId}/cancel`,'POST',{})).status,404);
   assert.equal((await student.req(`/enrollment-requests/${requestId}/cancel`,'POST',{})).status,200);
   r=await student.req('/enrollment-requests','POST',{classIds:[classId]});requestId=r.data.requestIds[0];
   assert.equal((await student.req(`/enrollment-requests/${requestId}/review`,'POST',{decision:'approve'})).status,403);
   assert.equal((await staff.req(`/enrollment-requests/${requestId}/review`,'POST',{decision:'reject',reason:''})).status,422);
   assert.equal((await staff.req(`/enrollment-requests/${requestId}/review`,'POST',{decision:'reject',reason:'Em chọn một lớp khác phù hợp hơn.'})).status,200);
   assert.equal((await student.req('/enrollment-requests?status=rejected')).data.items[0].reason,'Em chọn một lớp khác phù hợp hơn.');
  });
  await t.test('Thêm đích danh sinh viên khác lớp có nhãn; duyệt thêm sinh viên mới tạo lịch và kiểm tra sĩ số',async()=>{
   let r=await mutate(`/staff/course-sections/${classId}/members`,'POST',{studentId:'2',reason:'Phân học ghép theo đề nghị'});assert.equal(r.status,200,JSON.stringify(r));
   const secondEnrollment=r.data.enrollmentId;
   let data=(await staff.req('/staff/scheduling?classId='+classId)).data;assert.equal(data.roster.find(s=>s.studentId==='2').external,true);
   assert.equal((await mutate('/staff/course-sections/'+classId,'PATCH',{code:'V14-SECTION',lecturerId:'',capacity:1,status:'open'})).status,200);
   r=await student.req('/enrollments','POST',{classIds:[classId]});assert.equal(r.status,409); // full at submission
   assert.equal((await mutate('/staff/course-sections/'+classId,'PATCH',{code:'V14-SECTION',lecturerId:'',capacity:2,status:'open'})).status,200);
   r=await student.req('/enrollment-requests','POST',{classIds:[classId]});assert.equal(r.status,202);requestId=r.data.requestIds[0];
   assert.equal((await mutate('/staff/course-sections/'+classId,'PATCH',{code:'V14-SECTION',lecturerId:'',capacity:1,status:'open'})).status,200);
   assert.equal((await staff.req(`/enrollment-requests/${requestId}/review`,'POST',{decision:'approve'})).status,409);
   assert.equal((await db.get('SELECT status FROM enrollment_requests WHERE request_id=?',[requestId])).status,'pending');
   assert.equal((await mutate('/staff/course-sections/'+classId,'PATCH',{code:'V14-SECTION',lecturerId:'',capacity:2,status:'open'})).status,200);
   r=await staff.req(`/enrollment-requests/${requestId}/review`,'POST',{decision:'approve',reason:'Đã đối chiếu đủ điều kiện'});assert.equal(r.status,200,JSON.stringify(r));
   assert.equal((await staff.req(`/enrollment-requests/${requestId}/review`,'POST',{decision:'approve'})).status,409);
   const own=(await student.req('/timetable?start=2026-11-02')).data.items.find(i=>i.classId===classId);assert.ok(own);assert.equal(own.external,true);
   data=(await staff.req('/staff/scheduling?classId='+classId)).data;assert.equal(data.roster.length,2);assert.equal(data.roster.find(s=>s.studentId==='1').source,'Đăng ký đã duyệt');
   assert.equal((await mutate('/staff/course-sections/'+classId,'PATCH',{code:'V14-SECTION',lecturerId:'',capacity:1,status:'open'})).status,409);
   assert.equal((await mutate(`/staff/course-sections/${classId}/members/${secondEnrollment}`,'DELETE',{reason:'Trả về lớp ban đầu theo đề nghị'})).status,200);
   assert.ok(!(await second.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
  });
  await t.test('Đối tượng từng buổi: gán/gỡ lớp riêng cập nhật lịch và snapshot đúng sinh viên',async()=>{
   await db.update('students','student_id',2,{student_group_id:2});
   assert.equal((await mutate(`/staff/course-sections/${classId}/members`,'POST',{studentId:'2',reason:'Thêm lại sinh viên để kiểm tra đối tượng buổi'})).status,200);
   for(const group of ['1','2'])assert.equal((await mutate(`/staff/course-sections/${classId}/targets`,'POST',{scope:'group',referenceId:group,mode:'add',syncStudents:false})).status,200);
   const path=`/staff/schedules/${slotId}/audiences`;
   assert.equal((await mutate(path,'POST',{scope:'group',referenceId:'1',mode:'add',syncStudents:false})).status,200);
   assert.ok((await student.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   assert.ok(!(await second.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   assert.equal((await mutate(path,'POST',{scope:'group',referenceId:'2',mode:'add',syncStudents:false})).status,200);
   assert.ok((await second.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   assert.equal((await mutate(path,'POST',{scope:'group',referenceId:'1',mode:'remove',syncStudents:false})).status,200);
   assert.ok(!(await student.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   assert.ok(!(await student.req('/state')).data.schedules.some(s=>s.id===slotId));
   assert.ok((await db.get("SELECT COUNT(*) AS n FROM enrollments WHERE class_id=? AND status='registered'",[classId])).n===2);
   assert.equal((await mutate(path,'POST',{scope:'inherit'})).status,200);
   assert.ok((await student.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   const member=(await staff.req('/staff/scheduling?classId='+classId)).data.roster.find(r=>r.studentId==='2');
   assert.equal((await mutate(`/staff/course-sections/${classId}/members/${member.id}`,'DELETE',{reason:'Hoàn tất kiểm tra đối tượng buổi'})).status,200);
  });
  await t.test('Đồng bộ cả lớp là giao dịch nguyên khối, không gán dở khi lớp hết chỗ giữa chừng',async()=>{
   const before=(await staff.req('/staff/scheduling?classId='+classId)).data;
   const r=await mutate(`/staff/course-sections/${classId}/targets`,'POST',{scope:'group',referenceId:String(groupId),mode:'add',syncStudents:true});assert.equal(r.status,409,JSON.stringify(r));assert.match(r.error.message,/V14000/);
   const after=(await staff.req('/staff/scheduling?classId='+classId)).data;assert.equal(after.roster.length,before.roster.length);assert.equal(after.revision,before.revision);
  });
  await t.test('Xóa buổi cập nhật lịch; xóa lớp đã phát sinh dữ liệu thành hủy, giữ lịch sử',async()=>{
   const stale=await revision();
   const r=await mutate('/staff/schedules/'+slotId,'DELETE',{reason:'Thay đổi kế hoạch giảng dạy'});assert.equal(r.status,200,JSON.stringify(r));
   assert.ok(!(await student.req('/timetable?start=2026-11-02')).data.items.some(i=>i.classId===classId));
   assert.equal((await staff.req('/staff/course-sections/'+classId,'PATCH',{revision:stale,code:'STALE',capacity:2,lecturerId:'',status:'open'})).status,409);
   const removed=await mutate('/staff/course-sections/'+classId,'DELETE',{reason:'Kết thúc lớp thử và giữ lịch sử đăng ký'});assert.equal(removed.status,200);assert.equal(removed.data.archived,true);
   assert.equal((await db.get('SELECT status FROM classes WHERE class_id=?',[classId])).status,'cancelled');
   assert.ok((await db.get('SELECT COUNT(*) AS n FROM enrollment_requests WHERE class_id=?',[classId])).n>0);
   await db.initialize();assert.equal((await db.get('SELECT capacity FROM group_settings WHERE student_group_id=?',[groupId])).capacity,2);
  });
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}
});
