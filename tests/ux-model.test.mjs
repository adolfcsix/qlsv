import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../frontend/src/demo/data.js';
import {navigation,canonicalRoute,memberTabs,securityRoute} from '../frontend/src/app/navigation.js';
import {filteredStudents,pageSlice,gradeTotal,scheduleEvents,weekRange} from '../frontend/src/utils/view-model.js';
import {demoChat} from '../frontend/src/demo/chat.js';
import * as pages from '../frontend/src/pages/index.js';
const context=role=>{const db=seed();return {db,user:db.accounts.find(u=>u.role===role),parts:[role,'dashboard'],filters:{},cart:[]};};
test('Điều hướng chỉ có một khu vực bảo mật; đường cũ chuyển về đúng hồ sơ',()=>{
 for(const role of Object.keys(navigation)){const ctx=context(role);assert.ok(!navigation[role].some(([key])=>['password','account','assistant','create-account'].includes(key)));assert.equal(canonicalRoute(ctx.user,[role,'password']),securityRoute(ctx.user));}
 const ctx=context('student');assert.equal(canonicalRoute(ctx.user,['student','profile',ctx.user.profileId,'fees']),'/student/fees');assert.deepEqual(memberTabs.map(([key])=>key),['personal','contacts','account']);
});
test('Tìm không dấu, lọc kết hợp và phân trang không sinh trang rỗng',()=>{
 const ctx=context('academic');ctx.filters={search:'nguyen minh anh'};assert.deepEqual(filteredStudents(ctx).map(s=>s.code),['20240001']);ctx.filters={cohort:'k24',major:'m1',status:'studying'};assert.ok(filteredStudents(ctx).every(s=>s.status==='studying'));
 const pg=pageSlice([1,2,3],{page:99},2);assert.equal(pg.page,2);assert.deepEqual(pg.rows,[3]);assert.equal(pageSlice([],{},8).from,0);
});
test('Tổng điểm dùng thang tối đa và trọng số thật, NULL khác 0',()=>{
 const meta=[{key:'process',weight:10,max:5},{key:'midterm',weight:40,max:20},{key:'final',weight:50,max:10}];assert.equal(gradeTotal({process:5,midterm:10,final:8},meta),7);assert.equal(gradeTotal({process:0,midterm:0,final:0},meta),0);assert.equal(gradeTotal({process:null,midterm:10,final:8},meta),null);
});
test('Lịch giữ nhiều buổi/lớp, Chủ nhật, ngày hiệu lực và lịch thi đã công bố',()=>{
 const db={schedules:[{classId:'1',day:1,start:'07:00',end:'09:00',from:'2026-11-02',to:'2026-11-08'},{classId:'1',day:7,start:'09:00',end:'10:00',from:'2026-11-02',to:'2026-11-08'}],exams:[{classId:'1',date:'2026-11-06',start:'08:00',status:'draft'},{classId:'1',date:'2026-11-07',start:'08:00',status:'published'}]};const rows=scheduleEvents(db,[{id:'1'}],'2026-11-02','2026-11-08');assert.equal(rows.length,3);assert.equal(rows[2].date,'2026-11-08');assert.equal(rows.filter(r=>r.type==='exam').length,1);assert.equal(scheduleEvents(db,[{id:'1'}],'2026-11-09','2026-11-15').length,0);assert.deepEqual(weekRange(0,new Date('2026-11-08T10:00:00Z')).dates,['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
});
test('Chatbot dữ liệu mẫu hỏi tiếp được và giữ kiểm tra quyền',()=>{
 const ctx=context('academic'),first=demoChat(ctx,'Khóa K24 có bao nhiêu lớp?');assert.equal(first.result.total,10);assert.equal(demoChat(ctx,'Riêng ngành CNTT thì sao?',first.result.query).result.total,2);assert.equal(demoChat(ctx,'Sinh viên tên Nguyen Minh Anh').result.total,1);
 assert.throws(()=>demoChat(context('student'),'Bảng điểm 20240002'),/phạm vi/);assert.throws(()=>demoChat(context('sysadmin'),'Bảng điểm 20240001'),/không có quyền/);assert.match(demoChat(context('student'),'Xin chào').result.reply,/Chào bạn/);
});
test('Kế hoạch không lặp bảng điểm; chỉ dùng học phần trong chương trình',()=>{
 const ctx=context('student');ctx.db.curriculum=[{programId:ctx.db.groups.find(g=>g.id===ctx.db.students.find(s=>s.id===ctx.user.profileId).groupId).programId,subjectId:ctx.db.subjects[0].id,requirement_type:'required',recommended_semester:3}];const html=pages.plan(ctx);assert.ok(!html.includes('THANG 10'));assert.ok(!html.includes('THANG 4'));assert.equal((html.match(/<tbody>/g)||[]).length,1);
 const profile=pages.profile({...ctx,parts:['student','profile',ctx.user.profileId,'account']});assert.equal((profile.match(/id="password-form"/g)||[]).length,1);assert.ok(!profile.includes('href="#/student/profile/'+ctx.user.profileId+'/fees"'));
});
test('Danh mục URL lạ và kết quả miễn học/null không làm vỡ trang',()=>{
 const ctx=context('academic');assert.doesNotThrow(()=>pages.organization({...ctx,parts:['academic','organization','not-a-table']}));ctx.db.results[0].score=null;ctx.db.results[0].gpa=null;assert.doesNotThrow(()=>pages.results({...ctx,user:context('student').user}));assert.match(pages.details([['Số lượng',0]]),/<dd>0<\/dd>/);
});
