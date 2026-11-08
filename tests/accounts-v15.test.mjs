import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app.js';
import {openDatabase} from '../backend/src/config/database.js';

function client(origin){return {cookie:'',csrf:'',async req(path,method='GET',body){const res=await fetch(origin+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});const payload=await res.json();if(res.headers.get('set-cookie'))this.cookie=res.headers.get('set-cookie').split(';')[0];if(payload.data?.csrf)this.csrf=payload.data.csrf;return {status:res.status,...payload};},login(username,password='Hocvu@2026'){return this.req('/auth/login','POST',{username,password});}};}
async function fixture(run){const db=await openDatabase({driver:'sqlite',file:':memory:'}),{server}=await createApp({db,seed:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,admin=client(origin);assert.equal((await admin.login('quantri')).status,200);const revision=async()=>Number((await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision);const mutate=async(path,method,body)=>admin.req(path,method,{revision:await revision(),...body});try{await run({db,admin,origin,mutate,revision});}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}}
const profile=(code,name='Nhân sự kiểm thử')=>({code,name,departmentId:'1'});
const fresh=(username,role='academic')=>({username,email:username+'@example.com',role,temporaryPassword:'Temporary@2026',newProfile:profile('P-'+username),reason:'Cấp tài khoản kiểm thử'});

test('V15 cấp đủ ba nhóm, không cấp hồ sơ trùng và không lộ mật khẩu',async t=>fixture(async({db,admin,origin,mutate})=>{
 await t.test('Chặn sinh viên/giảng viên/cán bộ quản lý tài khoản',async()=>{
  for(const name of ['20240001','gv001','cb001']){const user=client(origin);assert.equal((await user.login(name)).status,200);assert.equal((await user.req('/admin/accounts','POST',{})).status,403);assert.deepEqual((await user.req('/state')).data.accountProfiles,[]);}
 });
 await t.test('Cấp từ hồ sơ sinh viên chưa có tài khoản, giữ nguyên học vụ',async()=>{
  const s=await db.get('SELECT * FROM students WHERE user_id IS NULL LIMIT 1');assert.ok(s);
  const r=await mutate('/admin/accounts','POST',{username:'sv_v15',email:'sv_v15@example.com',role:'student',profileId:String(s.student_id),temporaryPassword:'Temporary@2026',reason:'Đối chiếu hồ sơ sinh viên'});assert.equal(r.status,201,JSON.stringify(r));
  assert.equal((await db.get('SELECT user_id FROM students WHERE student_id=?',[s.student_id])).user_id,Number(r.data.id));
  assert.equal((await db.get('SELECT must_change_password FROM user_security WHERE user_id=?',[r.data.id])).must_change_password,1);
  assert.match((await db.get('SELECT password_hash FROM users WHERE user_id=?',[r.data.id])).password_hash,/^scrypt:/);
  const u=client(origin);assert.equal((await u.login('SV_V15','Temporary@2026')).status,200);const me=await u.req('/auth/me');assert.equal(me.data.user.role,'student');assert.equal(me.data.user.mustChange,true);
  assert.equal((await mutate('/admin/accounts','POST',{username:'sv_taken',email:'taken@example.com',role:'student',profileId:String(s.student_id),temporaryPassword:'Temporary@2026'})).status,409);
 });
 await t.test('Tạo giảng viên/cán bộ kèm hồ sơ nhân sự; cấp từ hồ sơ giảng viên có sẵn',async()=>{
  for(const role of ['lecturer','academic']){const r=await mutate('/admin/accounts','POST',fresh('new_'+role,role));assert.equal(r.status,201,JSON.stringify(r));const def=role==='lecturer'?['lecturers','lecturer_id']:['staffs','staff_id'];assert.ok(await db.get(`SELECT ${def[1]} FROM ${def[0]} WHERE user_id=?`,[r.data.id]));}
  const lecturer=await db.get('SELECT lecturer_id FROM lecturers WHERE user_id IS NULL LIMIT 1');assert.ok(lecturer);
  assert.equal((await mutate('/admin/accounts','POST',{username:'gv_existing',email:'gv-existing@example.com',role:'lecturer',profileId:String(lecturer.lecturer_id),temporaryPassword:'Temporary@2026'})).status,201);
  const state=(await admin.req('/state')).data;assert.ok(state.accountProfiles.some(p=>p.kind==='staff'&&p.userId));assert.ok(!JSON.stringify(state).includes('scrypt:'));assert.ok(!JSON.stringify(state).includes('Temporary@2026'));
 });
 await t.test('Username/email trùng, phòng ban sai, hồ sơ sinh viên tự tạo đều rollback',async()=>{
  const before=await db.get('SELECT (SELECT COUNT(*) FROM staffs) AS staffs,(SELECT COUNT(*) FROM users) AS users');
  assert.equal((await mutate('/admin/accounts','POST',{...fresh('quantri'),newProfile:profile('NO-INSERT')})).status,409);
  assert.equal((await mutate('/admin/accounts','POST',{...fresh('duplicate_email'),email:(await db.get('SELECT email FROM users WHERE user_id=1')).email.toUpperCase()})).status,409);
  assert.equal((await mutate('/admin/accounts','POST',{...fresh('bad_dept'),newProfile:{...profile('BAD-DEPT'),departmentId:'999999'}})).status,404);
  assert.equal((await mutate('/admin/accounts','POST',{...fresh('fake_student','student')})).status,422);
  for(const role of ['__proto__','constructor','unknown'])assert.equal((await mutate('/admin/accounts','POST',{...fresh('bad_role'),role})).status,422);
  assert.deepEqual({...await db.get('SELECT (SELECT COUNT(*) FROM staffs) AS staffs,(SELECT COUNT(*) FROM users) AS users')},{...before});
  const audit=await db.all('SELECT before_data,after_data FROM audit_logs');assert.ok(!JSON.stringify(audit).includes('Temporary@2026'));assert.ok(!JSON.stringify(audit).includes('scrypt:'));
 });
}));

test('V15 sửa đăng nhập và chuyển vai trò đúng hồ sơ, thu hồi mọi phiên cũ',async t=>fixture(async({db,admin,origin,mutate})=>{
 const student=client(origin);assert.equal((await student.login('20240001')).status,200);
 const before=await db.get('SELECT (SELECT COUNT(*) FROM students) AS students,(SELECT COUNT(*) FROM enrollments) AS enrollments');
 await t.test('Sửa username/email và buộc đăng nhập lại',async()=>{
  assert.equal((await mutate('/admin/accounts/4','PATCH',{username:'sv_renamed',email:'renamed@example.com',reason:'Sửa thông tin đăng nhập'})).status,200);
  assert.equal((await student.req('/state')).status,401);assert.equal((await student.login('sv_renamed')).status,200);assert.equal((await student.req('/auth/me')).data.user.profileId,'1');
 });
 await t.test('Sinh viên → cán bộ → giảng viên: hồ sơ cũ giữ, liên kết chuyển và quyền đổi theo',async()=>{
  let r=await mutate('/admin/accounts/4','PATCH',{role:'academic',newProfile:profile('CONVERT-CB'),reason:'Chuyển sang công tác cán bộ'});assert.equal(r.status,200,JSON.stringify(r));assert.equal((await db.get('SELECT user_id FROM students WHERE student_id=1')).user_id,null);assert.equal((await student.req('/state')).status,401);
  assert.equal((await student.login('sv_renamed')).status,200);assert.equal((await student.req('/auth/me')).data.user.role,'academic');assert.equal((await student.req('/staff/scheduling')).status,200);
  r=await mutate('/admin/accounts/4','PATCH',{role:'lecturer',newProfile:profile('CONVERT-GV'),reason:'Điều chuyển sang giảng viên'});assert.equal(r.status,200,JSON.stringify(r));assert.equal((await db.get('SELECT user_id FROM staffs WHERE staff_code=?',['CONVERT-CB'])).user_id,null);assert.equal((await student.req('/state')).status,401);
  assert.equal((await student.login('sv_renamed')).status,200);assert.equal((await student.req('/auth/me')).data.user.role,'lecturer');assert.equal((await student.req('/staff/scheduling')).status,403);
  assert.deepEqual({...await db.get('SELECT (SELECT COUNT(*) FROM students) AS students,(SELECT COUNT(*) FROM enrollments) AS enrollments')},{...before});
 });
 await t.test('Không lấy hồ sơ người khác; chuyển lại sinh viên dùng hồ sơ cũ',async()=>{
  const r=await mutate('/admin/accounts/4','PATCH',{role:'student',profileId:'2'});assert.equal(r.status,409);assert.equal(r.error.code,'PROFILE_ASSIGNED');
  assert.equal((await mutate('/admin/accounts/4','PATCH',{role:'student',profileId:'1',reason:'Quay lại đúng hồ sơ sinh viên'})).status,200);
  assert.equal((await db.get('SELECT user_id FROM students WHERE student_id=1')).user_id,4);assert.equal((await db.get('SELECT user_id FROM lecturers WHERE lecturer_code=?',['CONVERT-GV'])).user_id,null);
 });
 await t.test('Revision cũ và endpoint changes không vượt bảo vệ tài khoản',async()=>{
  assert.equal((await admin.req('/admin/accounts/4','PATCH',{revision:-1,email:'stale@example.com'})).status,409);
  const state=(await admin.req('/state')).data,own=state.accounts.find(a=>a.id==='1');
  assert.equal((await admin.req('/changes','POST',{revision:state.revision,changes:[{table:'accounts',id:'1',before:own,after:{...own,status:'locked'}}]})).status,409);
  assert.equal((await mutate('/admin/accounts/1','PATCH',{role:'academic'})).status,409);assert.equal((await mutate('/admin/accounts/1','DELETE',{reason:'Không cho tự xóa'})).status,409);
 });
}));

test('V15 xóa thật tài khoản không có lịch sử, lưu trữ tài khoản có hoạt động và khôi phục có kiểm soát',async t=>fixture(async({db,admin,origin,mutate})=>{
 let staff=client(origin);assert.equal((await staff.login('cb001')).status,200);
 await t.test('Xóa tài khoản mới giữ hồ sơ, bỏ liên kết đăng nhập',async()=>{
  const created=await mutate('/admin/accounts','POST',fresh('delete_unused'));assert.equal(created.status,201);const key=created.data.id;
  const r=await mutate('/admin/accounts/'+key,'DELETE',{reason:'Cấp nhầm tài khoản chưa dùng'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.archived,false);
  assert.equal(await db.get('SELECT user_id FROM users WHERE user_id=?',[key]),undefined);assert.equal((await db.get('SELECT user_id FROM staffs WHERE staff_code=?',['P-delete_unused'])).user_id,null);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM user_security WHERE user_id=?',[key])).n,0);
 });
 await t.test('Xóa cán bộ có lịch sử giữ actor/đăng ký, không đăng nhập lại được',async()=>{
  const old=await db.get('SELECT COUNT(*) AS n FROM enrollments WHERE created_by=2');assert.ok(old.n>0);
  const r=await mutate('/admin/accounts/2','DELETE',{reason:'Cán bộ nghỉ công tác'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.archived,true);
  assert.equal((await staff.req('/state')).status,401);assert.equal((await staff.login('cb001')).status,403);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM enrollments WHERE created_by=2')).n,old.n);
  assert.equal((await admin.req('/state')).data.accounts.find(a=>a.id==='2').archived,true);
  assert.equal((await mutate('/admin/accounts/2','PATCH',{status:'active'})).status,409);
 });
 await t.test('Khôi phục vẫn khóa; reset mật khẩu thu hồi phiên và bắt đổi',async()=>{
  assert.equal((await mutate('/admin/accounts/2/restore','POST',{reason:'Xác minh và khôi phục tài khoản'})).status,200);assert.equal((await staff.login('cb001')).status,403);
  assert.equal((await mutate('/admin/accounts/2','PATCH',{temporaryPassword:'Reset-Test@2026',reason:'Cấp lại sau khôi phục'})).status,200);
  assert.equal((await mutate('/admin/accounts/2','PATCH',{status:'active',reason:'Đã đối chiếu nhân sự'})).status,200);
  assert.equal((await staff.login('cb001')).status,401);assert.equal((await staff.login('cb001','Reset-Test@2026')).status,200);
  assert.equal((await staff.req('/auth/me')).data.user.mustChange,true);assert.equal((await staff.req('/staff/scheduling')).status,403);
  assert.equal((await staff.req('/auth/password','POST',{current:'Reset-Test@2026',password:'Changed-Reset@2026'})).status,200);assert.equal((await staff.req('/state')).status,401);
 });
}));

test('V15 hai quản trị thao tác đồng thời không khóa hết quyền quản trị',async()=>fixture(async({db,admin,origin,mutate,revision})=>{
 const created=await mutate('/admin/accounts','POST',fresh('admin_two','sysadmin'));assert.equal(created.status,201,JSON.stringify(created));const id=created.data.id;
 await db.update('user_security','user_id',Number(id),{must_change_password:0});
 const another=client(origin);assert.equal((await another.login('admin_two','Temporary@2026')).status,200);
 const rev=await revision();const results=await Promise.all([admin.req('/admin/accounts/'+id,'PATCH',{revision:rev,status:'locked',reason:'Khóa quản trị thứ hai'}),another.req('/admin/accounts/1','PATCH',{revision:rev,status:'locked',reason:'Khóa quản trị thứ nhất'})]);
 assert.equal(results.filter(r=>r.status===200).length,1);assert.ok(results.every(r=>[200,401,403,409].includes(r.status)));
 assert.equal((await db.get("SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.name='ADMIN' AND u.status='active'")).n,1);
 const active=await db.get("SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.name='ADMIN' AND u.status='active'");const actor=active.user_id===1?admin:another;
 assert.equal((await actor.req('/admin/accounts/'+active.user_id,'DELETE',{revision:await revision(),reason:'Chặn xóa quản trị cuối cùng'})).status,409);
}));
