import { requireAdministrator as assertAdministrator } from '../../middlewares/authorize.js';
import { createPersonnelWithin } from '../admin/personnel.service.js';
import { ensure } from '../../core/errors.js';
import { id, text, enumeration } from '../../utils/validation.js';
import { admin, required, duplicate } from '../operations/change-utils.js';
import { hashPassword } from '../auth/auth.service.js';
import { writeAudit } from '../audit/audit.service.js';
import { accountRoles, unlinkProfiles, accountHasHistory } from './accounts.repository.js';

const roleKey=role=>Object.keys(accountRoles).find(key=>accountRoles[key].name===role);
export async function accountRevision(db,body) {
    ensure(Number.isSafeInteger(body.revision),'Thiếu phiên bản dữ liệu. Hãy tải lại.');
    ensure((await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision===body.revision,
        'Danh sách tài khoản đã thay đổi. Hãy tải lại trước khi lưu.',409,'STALE_REVISION');
}
async function guardAdministrator(db,actor,row,nextRole,nextStatus,deleting=false) {
    if(row.user_id===actor.user_id)ensure(!deleting&&nextStatus==='active'&&nextRole==='ADMIN',
        'Không tự xóa, khóa hoặc hạ vai trò quản trị của tài khoản đang dùng.',409,'SELF_ADMIN_PROTECTED');
    if(row.role==='ADMIN'&&row.status==='active'&&(deleting||nextRole!=='ADMIN'||nextStatus!=='active')) {
        const others=await db.get(`SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.role_id=u.role_id
            WHERE r.name='ADMIN' AND u.status='active' AND u.user_id<>?
            AND NOT EXISTS(SELECT 1 FROM account_archives a WHERE a.user_id=u.user_id)`,[row.user_id]);
        ensure(Number(others.n)>0,'Phải giữ ít nhất một tài khoản quản trị đang hoạt động.',409,'LAST_ADMIN');
    }
}
async function resolveProfile(db,role,body,userId,currentRole,actor) {
    const def=accountRoles[role];let row;
    if(body.newProfile) {
        ensure(role!=='student','Cán bộ đào tạo phải lập hồ sơ sinh viên trước khi quản trị cấp tài khoản.');
        const p=body.newProfile;ensure(typeof p==='object'&&!Array.isArray(p),'Hồ sơ mới không hợp lệ.');
        const key=await createPersonnelWithin(db,actor,role==='lecturer'?'lecturer':'staff',{
            ...p,email:body.email,reason:body.reason || 'Tạo hồ sơ khi cấp tài khoản'
        });
        row=await required(db,def.table,def.key,key);
    } else if(body.profileId) row=await required(db,def.table,def.key,body.profileId);
    else if(userId&&accountRoles[currentRole]?.table===def.table)row=await db.get(`SELECT * FROM ${def.table} WHERE user_id=?`,[userId]);
    ensure(row,'Chọn hồ sơ liên kết đúng vai trò hoặc tạo hồ sơ mới.');
    ensure(row.user_id==null||Number(row.user_id)===Number(userId),'Hồ sơ đang gắn với một tài khoản khác.',409,'PROFILE_ASSIGNED');
    return {def,row,key:row[def.key]};
}
// Caller owns the transaction; used by both resource routes and the compatibility writer.
export async function writeAccountWithin(db,actor,userId,body) {
    await assertAdministrator(db,actor);
    const old=userId?await db.get('SELECT u.*,r.name AS role FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=?',[id(userId)]):null;
    ensure(!userId||old,'Không tìm thấy tài khoản.',404);
    ensure(!old||!await db.get('SELECT user_id FROM account_archives WHERE user_id=?',[old.user_id]),'Tài khoản đã xóa khỏi sử dụng. Hãy khôi phục trước khi sửa.',409);
    const role=body.role??roleKey(old?.role);
    ensure(typeof role==='string'&&Object.hasOwn(accountRoles,role),'Vai trò không hợp lệ.');
    const def=accountRoles[role];
    if(body.newProfile!==undefined)ensure(body.newProfile&&typeof body.newProfile==='object'&&!Array.isArray(body.newProfile),'Hồ sơ mới không hợp lệ.');
    ensure(!(body.profileId&&body.newProfile),'Chỉ chọn một hồ sơ có sẵn hoặc tạo hồ sơ mới.');
    const username=text(body.username??body.code??old?.username,'Tên đăng nhập',100);
    const email=text(body.email??old?.email,'Email đăng nhập',255);
    ensure(/^[A-Za-z0-9_.-]{3,100}$/.test(username),'Tên đăng nhập cần 3–100 ký tự, chỉ chứa chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.');
    ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Email không hợp lệ.');
    await duplicate(db,'users','username',username,'user_id',userId);await duplicate(db,'users','email',email,'user_id',userId);
    const status=enumeration(body.status??old?.status??'active',['active','locked']);
    if(old)await guardAdministrator(db,actor,old,def.name,status);
    const reason=text(body.reason||(old?'Cập nhật tài khoản':'Cấp tài khoản'),'Lý do',1000);
    const temp=body.temporaryPassword;
    if(!old||temp!==undefined)ensure(typeof temp==='string'&&temp.length>=10&&temp.length<=128,'Mật khẩu tạm cần từ 10 đến 128 ký tự.');
    if(old&&temp!==undefined)ensure(old.user_id!==actor.user_id,'Đổi mật khẩu của bạn tại Hồ sơ & bảo mật; không tự đặt lại mật khẩu tạm.',409);
    const security=old?await db.get('SELECT must_change_password FROM user_security WHERE user_id=?',[old.user_id]):null;
    if(old&&body.mustChange!==undefined&&body.mustChange!==Boolean(security?.must_change_password))ensure(temp!==undefined&&body.mustChange===true,'Chỉ yêu cầu đổi mật khẩu khi cấp mật khẩu tạm mới.');
    const linked=await resolveProfile(db,role,{...body,email},userId,roleKey(old?.role),actor);
    const roleRow=await db.get('SELECT role_id FROM roles WHERE name=?',[def.name]);
    const values={username,email,role_id:roleRow.role_id,status};
    if(temp!==undefined)values.password_hash=await hashPassword(temp);
    const key=old?.user_id||await db.insert('users',values);
    if(old)await db.update('users','user_id',key,values);
    await unlinkProfiles(db,key);
    await db.update(linked.def.table,linked.def.key,linked.key,{user_id:key});
    if(!old)await db.insert('user_security',{user_id:key,must_change_password:1,password_version:1});
    else if(temp!==undefined) {
        if(security)await db.run('UPDATE user_security SET must_change_password=1,password_version=password_version+1 WHERE user_id=?',[key]);
        else await db.insert('user_security',{user_id:key,must_change_password:1,password_version:1});
    }
    // Profile/role changes must not leave any browser operating under an old identity.
    const sensitive=!!old&&(old.username!==username||old.email!==email||old.role!==def.name||old.status!==status||temp!==undefined||body.profileId!==undefined||body.newProfile!==undefined);
    if(sensitive)await db.run('DELETE FROM sessions WHERE user_id=?',[key]);
    const after={username,email,role:def.name,profileId:linked.key,status,passwordReset:temp!==undefined};
    await writeAudit(db,actor,old?'UPDATE_ACCOUNT':'CREATE_ACCOUNT','users',key,old?{username:old.username,email:old.email,role:old.role,status:old.status}:null,after,reason);
    return {id:String(key),reauthenticate:sensitive&&key===actor.user_id};
}
export async function deleteAccountWithin(db,actor,userId,body) {
    await assertAdministrator(db,actor);const key=id(userId),row=await db.get('SELECT u.*,r.name AS role FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=?',[key]);ensure(row,'Không tìm thấy tài khoản.',404);
    ensure(!await db.get('SELECT user_id FROM account_archives WHERE user_id=?',[key]),'Tài khoản đã xóa khỏi sử dụng.',409);
    await guardAdministrator(db,actor,row,row.role,'locked',true);
    const reason=text(body.reason,'Lý do xóa',1000),archived=await accountHasHistory(db,key);
    await db.run('DELETE FROM sessions WHERE user_id=?',[key]);
    if(archived) {
        await db.update('users','user_id',key,{status:'locked'});
        await db.insert('account_archives',{user_id:key,deleted_at:new Date().toISOString(),deleted_by:actor.user_id,reason});
    } else {
        await unlinkProfiles(db,key);await db.run('DELETE FROM user_security WHERE user_id=?',[key]);await db.run('DELETE FROM users WHERE user_id=?',[key]);
    }
    await writeAudit(db,actor,archived?'ARCHIVE_ACCOUNT':'DELETE_ACCOUNT','users',key,{username:row.username,email:row.email,role:row.role}, {archived},reason);
    return {id:String(key),archived};
}
export async function restoreAccountWithin(db,actor,userId,body) {
    await assertAdministrator(db,actor);const key=id(userId),row=await db.get('SELECT * FROM account_archives WHERE user_id=?',[key]);ensure(row,'Tài khoản không nằm trong danh sách đã xóa.',404);
    const reason=text(body.reason,'Lý do khôi phục',1000);
    await db.run('DELETE FROM account_archives WHERE user_id=?',[key]);await db.update('users','user_id',key,{status:'locked'});await db.run('DELETE FROM sessions WHERE user_id=?',[key]);
    await writeAudit(db,actor,'RESTORE_ACCOUNT','users',key,null,{status:'locked'},reason);
    return {id:String(key),status:'locked'};
}
