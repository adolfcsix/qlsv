import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../backend/src/config/database.js';
import {createApp} from '../backend/src/app.js';
import {personnel} from '../frontend/src/pages/sysadmin/personnel.js';
import {adminCalendar} from '../frontend/src/pages/sysadmin/calendar.js';
import {adminRooms} from '../frontend/src/pages/sysadmin/rooms.js';
import {adminOverview} from '../frontend/src/features/admin/overview.js';
function client(origin){return{cookie:'',csrf:'',async req(path,method='GET',body){const r=await fetch(origin+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});const p=await r.json();if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];if(p.data?.csrf)this.csrf=p.data.csrf;return{status:r.status,...p};},login(name){return this.req('/auth/login','POST',{username:name,password:'Hocvu@2026'});}};}
async function fixture(fn){const db=await openDatabase({driver:'sqlite',file:':memory:'}),{server}=await createApp({db,seed:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,admin=client(origin),staff=client(origin);await admin.login('quantri');await staff.login('cb001');const revision=async()=>Number((await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision);const mutate=async(path,method,body)=>admin.req(path,method,{revision:await revision(),...body});const academic=async(path,method,body)=>staff.req(path,method,method==='GET'?undefined:{revision:await revision(),...body});try{await fn({db,admin,staff,origin,revision,mutate,academic});}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}}
const reason='Đối chiếu và cập nhật theo kiểm thử';

test('V16 tổng quan toàn trường: phân quyền, lọc thống kê và danh sách chi tiết',async t=>fixture(async({db,admin,staff,origin})=>{
 await t.test('Chặn ba vai trò khác đọc/ghi workspace quản trị',async()=>{
  const student=client(origin),lecturer=client(origin);await student.login('20240001');await lecturer.login('gv001');
  for(const c of [student,lecturer,staff]){for(const path of ['/admin/overview','/admin/personnel','/admin/calendar','/admin/rooms','/admin/rooms/1/usage'])assert.equal((await c.req(path)).status,403,path);assert.equal((await c.req('/admin/rooms','POST',{revision:0,code:'FORBIDDEN',capacity:20,enabled:true})).status,403);}
 });
 await t.test('Thống kê khớp CSDL; bộ lọc lớp/khoa/khóa nhất quán và không lộ điểm/liên hệ',async()=>{
  const r=await admin.req('/admin/overview');assert.equal(r.status,200);const d=r.data;
  assert.equal(d.counts.students,Number((await db.get('SELECT COUNT(*) AS n FROM students')).n));assert.equal(d.byDepartment.reduce((n,a)=>n+a.students,0),d.counts.students);assert.equal(d.counts.rooms,6);
  assert.ok(d.items.every(s=>!('email'in s)&&!('phone'in s)&&!('dob'in s)));assert.ok(!JSON.stringify(d).includes('password_hash'));
  const group=(await admin.req('/admin/overview?groupId=1')).data;assert.equal(group.counts.students,Number((await db.get('SELECT COUNT(*) AS n FROM students WHERE student_group_id=1')).n));assert.ok(group.items.every(s=>s.group===group.options.groups.find(g=>g.id==='1').name));
  const unknown=(await admin.req('/admin/overview?cohortId=999999')).data;assert.equal(unknown.counts.students,0);assert.equal(unknown.counts.groups,0);
  const searched=(await admin.req('/admin/overview?search=nguyen&limit=1&page=999')).data;assert.equal(searched.pagination.page,searched.pagination.pages);assert.ok(searched.items.length<=1);
  assert.equal((await admin.req('/admin/overview?departmentId=bad')).status,422);assert.equal((await admin.req('/admin/overview?kind=constructor')).status,422);
  const html=adminOverview({db:{},filters:{},remoteAdminOverview:{state:'ready',data:d}});assert.match(html,/Tổng quan toàn trường/);assert.match(html,/Danh sách chi tiết/);assert.match(html,/Năm học & học kỳ/);
 });
 await t.test('Đăng ký pending xuất hiện trong giám sát, chưa chiếm chỗ',async()=>{
  const student=client(origin);await student.login('20240001');assert.equal((await student.req('/enrollment-requests','POST',{classIds:['2']})).status,202);
  const d=(await admin.req('/admin/overview?kind=pending')).data;assert.equal(d.counts.pending,1);assert.equal(d.items[0].code,'20240001');assert.equal((await db.get('SELECT COUNT(*) AS n FROM enrollments WHERE class_id=2')).n,0);
 });
}));

test('V16 hồ sơ nhân sự: CRUD và liên kết tài khoản/phân công',async t=>fixture(async({db,admin,mutate,academic,revision})=>{
 let lecturerId,staffId;
 await t.test('Thêm, tìm không dấu, sửa; dữ liệu giao diện được escape',async()=>{
  const created=await mutate('/admin/personnel/lecturer','POST',{code:'GV-V16',name:'Nhân sự mới',departmentId:'1',email:'gv16@example.com',phone:'0901234567',reason});assert.equal(created.status,201,JSON.stringify(created));lecturerId=created.data.id;
  let listed=(await admin.req('/admin/personnel?type=lecturer&search=nhan su moi')).data;assert.ok(listed.items.some(p=>p.id===lecturerId));
  const changed=await mutate('/admin/personnel/lecturer/'+lecturerId,'PATCH',{code:'GV-V16-EDIT',name:'Nguyễn <script>alert(1)</script>',departmentId:'1',email:'gv16@example.com',phone:'',reason});assert.equal(changed.status,200);
  listed=(await admin.req('/admin/personnel?type=lecturer&search=GV-V16')).data;const state=(await admin.req('/state')).data;
  const html=personnel({db:state,parts:['sysadmin','personnel','lecturer'],filters:{},remoteAdminPersonnel:{state:'ready',data:listed}});assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Cấp tài khoản/);
 });
 await t.test('Tạo cán bộ rồi cấp tài khoản dùng cùng hồ sơ, giữ hồ sơ đang liên kết',async()=>{
  const created=await mutate('/admin/personnel/staff','POST',{code:'CB-V16',name:'Cán bộ mới',departmentId:'1',email:'',phone:'',reason});assert.equal(created.status,201);staffId=created.data.id;
  const account=await mutate('/admin/accounts','POST',{username:'staff_v16',email:'staff_v16@example.com',role:'academic',profileId:staffId,temporaryPassword:'Temporary@2026',reason});assert.equal(account.status,201,JSON.stringify(account));
  const removed=await mutate('/admin/personnel/staff/'+staffId,'DELETE',{reason});assert.equal(removed.status,409);assert.equal(removed.error.code,'PROFILE_LINKED');
  assert.equal((await mutate('/admin/accounts/'+account.data.id,'DELETE',{reason})).status,200);
  assert.equal((await mutate('/admin/personnel/staff/'+staffId,'DELETE',{reason})).status,200);
 });
 await t.test('Không xóa giảng viên đã được phân công; xóa sau khi bỏ lớp chưa dùng',async()=>{
  const course=await academic('/staff/course-sections','POST',{code:'GV-V16-CLASS',subjectId:'2',semesterId:'1',lecturerId,capacity:30,status:'open'});assert.equal(course.status,201);
  const removed=await mutate('/admin/personnel/lecturer/'+lecturerId,'DELETE',{reason});assert.equal(removed.status,409);assert.equal(removed.error.code,'PERSONNEL_IN_USE');
  assert.equal((await academic('/staff/course-sections/'+course.data.id,'DELETE',{reason})).status,200);
  assert.equal((await mutate('/admin/personnel/lecturer/'+lecturerId,'DELETE',{reason})).status,200);
 });
 await t.test('Trùng mã, đơn vị sai, revision cũ được chặn và rollback',async()=>{
  const before=(await db.get('SELECT COUNT(*) AS n FROM staffs')).n;
  assert.equal((await mutate('/admin/personnel/staff','POST',{code:'CB001',name:'Trùng',departmentId:'1',reason})).status,409);
  assert.equal((await mutate('/admin/personnel/staff','POST',{code:'BAD16',name:'Sai đơn vị',departmentId:'999999',reason})).status,404);
  assert.equal((await admin.req('/admin/personnel/staff','POST',{revision:(await revision())-1,code:'STALE16',name:'Cũ',departmentId:'1',reason})).status,409);assert.equal((await db.get('SELECT COUNT(*) AS n FROM staffs')).n,before);
 });
}));

test('V16 năm học/học kỳ: cửa sổ đăng ký và bảo vệ lịch/kết quả đã dùng',async t=>fixture(async({db,admin,mutate,academic})=>{
 let yearId,termId,classId;
 const year={name:'2031–2032',start:'2031-09-01',end:'2032-08-31',reason};
 let term;
 await t.test('Thêm năm và học kỳ với thời gian địa phương Việt Nam',async()=>{
  const y=await mutate('/admin/academic-years','POST',year);assert.equal(y.status,201);yearId=y.data.id;term={yearId,name:'Học kỳ I',start:'2031-09-01',end:'2032-01-31',registrationStart:'2031-08-01T08:00',registrationEnd:'2031-09-10T17:00',reason};
  const s=await mutate('/admin/semesters','POST',term);assert.equal(s.status,201,JSON.stringify(s));termId=s.data.id;
  const row=await db.get('SELECT * FROM semesters WHERE semester_id=?',[termId]);assert.equal(row.registration_start,'2031-08-01 08:00:00');
  const d=(await admin.req('/admin/calendar')).data;assert.match(adminCalendar({filters:{},remoteAdminCalendar:{state:'ready',data:d}}),/ĐĂNG KÝ · GIỜ VIỆT NAM/);
 });
 await t.test('Ngày không tồn tại, khoảng ngoài năm, thiếu mốc và giờ sai không được ghi',async()=>{
  assert.equal((await mutate('/admin/academic-years','POST',{...year,name:'Bad year',start:'2031-02-30'})).status,422);
  for(const patch of [{registrationEnd:''},{registrationStart:'2031-08-01T99:99'},{end:'2033-01-31'},{registrationEnd:'2032-03-01T08:00'}])assert.equal((await mutate('/admin/semesters','PATCH',{...term,...patch})).status,404); // collection PATCH has no identity
  for(const patch of [{registrationEnd:''},{registrationStart:'2031-08-01T99:99'},{end:'2033-01-31'},{registrationEnd:'2032-03-01T08:00'}])assert.equal((await mutate('/admin/semesters/'+termId,'PATCH',{...term,...patch})).status,422);
  assert.equal((await mutate('/admin/semesters','POST',term)).status,409);assert.equal((await mutate('/admin/academic-years','POST',year)).status,409);
 });
 await t.test('Đóng cửa sổ học kỳ làm yêu cầu đăng ký mới bị chặn thật',async()=>{
  const old=(await admin.req('/admin/calendar')).data.semesters.find(s=>s.id==='1');
  assert.equal((await mutate('/admin/semesters/1','PATCH',{...old,registrationStart:'',registrationEnd:'',reason})).status,200);
  const row=await db.get('SELECT registration_start,registration_end FROM semesters WHERE semester_id=1');assert.equal(row.registration_start,null);assert.equal(row.registration_end,null);
  assert.equal((await academic('/enrollments','POST',{studentId:'1',classIds:['2']})).status,422);
  assert.equal((await mutate('/admin/semesters/1','PATCH',{...old,reason})).status,200);
 });
 await t.test('Sửa học kỳ, xếp lớp; không cắt mốc đang có lịch hoặc chuyển năm',async()=>{
  term={...term,name:'Học kỳ I điều chỉnh'};assert.equal((await mutate('/admin/semesters/'+termId,'PATCH',term)).status,200);
  const course=await academic('/staff/course-sections','POST',{code:'TERM-V16',subjectId:'2',semesterId:termId,lecturerId:'1',capacity:30,status:'open'});assert.equal(course.status,201);classId=course.data.id;
  assert.equal((await academic(`/staff/course-sections/${classId}/schedules`,'POST',{day:1,start:'15:00',end:'16:00',from:'2031-09-01',to:'2031-12-31',roomId:'1',teacherIds:['1']})).status,200);
  const cut=await mutate('/admin/semesters/'+termId,'PATCH',{...term,start:'2031-10-01'});assert.equal(cut.status,409);assert.equal(cut.error.code,'SCHEDULE_OUTSIDE_SEMESTER');
  assert.equal((await mutate('/admin/academic-years/'+yearId,'PATCH',{...year,end:'2031-11-30'})).status,409);
  assert.equal((await mutate('/admin/semesters/'+termId,'DELETE',{reason})).status,409);assert.equal((await mutate('/admin/academic-years/'+yearId,'DELETE',{reason})).status,409);
 });
 await t.test('Học kỳ có kết quả đã công bố giữ nguyên mốc học',async()=>{
  const old=(await admin.req('/admin/calendar')).data.semesters.find(s=>s.id==='2');const date=new Date(old.start+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+1);
  const r=await mutate('/admin/semesters/2','PATCH',{...old,start:date.toISOString().slice(0,10),registrationStart:'',registrationEnd:'',reason});assert.equal(r.status,409,JSON.stringify(r));assert.equal(r.error.code,'FINALIZED_SEMESTER');
 });
 await t.test('Xóa lớp chưa dùng rồi xóa học kỳ/năm được, không mất dữ liệu cũ',async()=>{
  assert.equal((await academic('/staff/course-sections/'+classId,'DELETE',{reason})).status,200);assert.equal((await mutate('/admin/semesters/'+termId,'DELETE',{reason})).status,200);assert.equal((await mutate('/admin/academic-years/'+yearId,'DELETE',{reason})).status,200);assert.equal((await db.get('SELECT COUNT(*) AS n FROM students')).n,8);
 });
}));

test('V16 phòng học: trạng thái, sức chứa liên thông xếp lịch và giữ lịch sử',async t=>fixture(async({db,admin,mutate,academic})=>{
 let roomId,secondRoom,classId,slotId;
 const room={code:'V16-ROOM',type:'Phòng thực hành',capacity:120,enabled:false,reason};
 await t.test('Thêm/sửa/tìm phòng; phòng ngừng sử dụng không vào danh mục xếp lịch',async()=>{
  const r=await mutate('/admin/rooms','POST',room);assert.equal(r.status,201,JSON.stringify(r));roomId=r.data.id;
  const d=(await admin.req('/admin/rooms?search=V16-ROOM')).data;assert.equal(d.items[0].enabled,false);assert.match(adminRooms({filters:{},remoteAdminRooms:{state:'ready',data:d}}),/Ngừng sử dụng/);
  const staffRooms=await academic('/staff/scheduling','GET');assert.ok(!staffRooms.data.rooms.some(r=>r.id===roomId));
  assert.equal((await mutate('/admin/rooms','POST',room)).status,409);assert.equal((await mutate('/admin/rooms/'+roomId,'PATCH',{...room,capacity:3.5})).status,422);
 });
 await t.test('Chặn xếp lịch/thi vào phòng ngừng, mở lại thì xếp được',async()=>{
  const year=await mutate('/admin/academic-years','POST',{name:'2050–2051',start:'2050-09-01',end:'2051-08-31',reason});const term=await mutate('/admin/semesters','POST',{yearId:year.data.id,name:'HK I',start:'2050-09-01',end:'2051-01-31',registrationStart:'',registrationEnd:'',reason});
  const course=await academic('/staff/course-sections','POST',{code:'ROOM-V16',subjectId:'2',semesterId:term.data.id,lecturerId:'',capacity:60,status:'open'});assert.equal(course.status,201);classId=course.data.id;
  const values={day:1,start:'15:00',end:'16:00',from:'2050-09-01',to:'2050-12-31',roomId,teacherIds:[]};
  const blocked=await academic(`/staff/course-sections/${classId}/schedules`,'POST',values);assert.equal(blocked.status,409);assert.equal(blocked.error.code,'ROOM_DISABLED');
  const exam=await academic('/changes','POST',{changes:[{table:'exams',id:'new',before:null,after:{classId,room:room.code,date:'2050-09-10',start:'08:00',end:'09:00',type:'Chính thức'}}]});assert.equal(exam.status,422);
  assert.equal((await mutate('/admin/rooms/'+roomId,'PATCH',{...room,enabled:true})).status,200);
  const slot=await academic(`/staff/course-sections/${classId}/schedules`,'POST',values);assert.equal(slot.status,200);slotId=slot.data.id;
  assert.ok((await admin.req('/admin/rooms/'+roomId+'/usage')).data.sessions.some(s=>s.code==='ROOM-V16'));
 });
 await t.test('Không giảm dưới sĩ số lớp, ngừng phòng có lịch hoặc xóa phòng đã dùng',async()=>{
  const small=await mutate('/admin/rooms/'+roomId,'PATCH',{...room,capacity:50,enabled:true});assert.equal(small.status,409);assert.equal(small.error.code,'ROOM_CAPACITY_CONFLICT');
  assert.equal((await mutate('/admin/rooms/'+roomId,'PATCH',{...room,enabled:false})).error.code,'ROOM_IN_USE');assert.equal((await mutate('/admin/rooms/'+roomId,'DELETE',{reason})).status,409);
 });
 await t.test('Chuyển buổi sang phòng khác cho ngừng phòng cũ, vẫn giữ lịch sử',async()=>{
  const target=await mutate('/admin/rooms','POST',{...room,code:'V16-NEW-ROOM',enabled:true});assert.equal(target.status,201);secondRoom=target.data.id;
  assert.equal((await academic(`/staff/course-sections/${classId}/schedules/${slotId}`,'PATCH',{day:1,start:'15:00',end:'16:00',from:'2050-09-01',to:'2050-12-31',roomId:secondRoom,teacherIds:[]})).status,200);
  assert.equal((await mutate('/admin/rooms/'+roomId,'PATCH',{...room,enabled:false})).status,200);
  assert.equal((await mutate('/admin/rooms/'+roomId,'DELETE',{reason})).status,409);
  assert.equal((await admin.req('/admin/rooms?enabled=false')).data.items.find(r=>r.id===roomId).usedBefore,true);
  assert.equal((await academic('/staff/course-sections/'+classId,'DELETE',{reason})).status,200);
  assert.equal((await mutate('/admin/rooms/'+secondRoom,'DELETE',{reason})).status,409);
  const unused=await mutate('/admin/rooms','POST',{...room,code:'V16-UNUSED',enabled:true});assert.equal((await mutate('/admin/rooms/'+unused.data.id,'DELETE',{reason})).status,200);
  await db.initialize();assert.equal((await db.get('SELECT enabled FROM room_settings WHERE room_id=?',[roomId])).enabled,0);
 });
}));
