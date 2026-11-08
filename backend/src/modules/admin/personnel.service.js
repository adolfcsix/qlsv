import { ensure } from '../../core/errors.js';
import { id, text } from '../../utils/validation.js';
import { requireAdministrator } from '../../middlewares/authorize.js';
import { required, duplicate } from '../operations/change-utils.js';
import { writeAudit } from '../audit/audit.service.js';
import { listParameters } from '../organization/organization.service.js';

const defs={lecturer:{table:'lecturers',pk:'lecturer_id',code:'lecturer_code'},staff:{table:'staffs',pk:'staff_id',code:'staff_code'}};
function definition(type){ensure(Object.hasOwn(defs,type),'Loại nhân sự không hợp lệ.');return defs[type];}
function values(body,def){const code=text(body.code,'Mã hồ sơ',30);ensure(/^[A-Za-z0-9_.-]{2,30}$/.test(code),'Mã hồ sơ không hợp lệ.');const email=text(body.email||'','Email hồ sơ',255,false);ensure(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Email hồ sơ không hợp lệ.');return{[def.code]:code,full_name:text(body.name,'Họ tên',200),department_id:id(body.departmentId),email,phone:text(body.phone||'','Điện thoại',30,false)};}
export async function createPersonnelWithin(db,user,type,body){
    await requireAdministrator(db,user);const def=definition(type),v=values(body,def);
    await required(db,'departments','department_id',v.department_id);await duplicate(db,def.table,def.code,v[def.code],def.pk,null);
    const key=await db.insert(def.table,{...v,user_id:null});await writeAudit(db,user,'CREATE_PERSONNEL',def.table,key,null,v,text(body.reason||'Lập hồ sơ nhân sự','Lý do',1000));return key;
}
export async function savePersonnelWithin(db,user,type,rowId,body){
    if(!rowId)return {id:String(await createPersonnelWithin(db,user,type,body))};
    await requireAdministrator(db,user);const def=definition(type),old=await required(db,def.table,def.pk,rowId),v=values(body,def);
    await required(db,'departments','department_id',v.department_id);await duplicate(db,def.table,def.code,v[def.code],def.pk,old[def.pk]);
    await db.update(def.table,def.pk,old[def.pk],v);await writeAudit(db,user,'UPDATE_PERSONNEL',def.table,old[def.pk],old,v,text(body.reason,'Lý do cập nhật',1000));return{id:String(old[def.pk])};
}
export async function deletePersonnelWithin(db,user,type,rowId,body){
    await requireAdministrator(db,user);const def=definition(type),old=await required(db,def.table,def.pk,rowId),key=old[def.pk];
    ensure(old.user_id==null,'Hồ sơ đang gắn tài khoản. Xử lý liên kết tài khoản trước; hồ sơ có lịch sử cần được giữ.',409,'PROFILE_LINKED');
    if(type==='lecturer') {
        ensure(!await db.get('SELECT class_id FROM classes WHERE lecturer_id=? LIMIT 1',[key])&&!await db.get('SELECT student_group_id FROM student_groups WHERE advisor_lecturer_id=? LIMIT 1',[key])&&!await db.get('SELECT schedule_id FROM schedule_teachers WHERE lecturer_id=? LIMIT 1',[key]),'Giảng viên đã có phân công/cố vấn/lịch sử giảng dạy. Không xóa hồ sơ đang được tham chiếu.',409,'PERSONNEL_IN_USE');
    }
    await db.run(`DELETE FROM ${def.table} WHERE ${def.pk}=?`,[key]);await writeAudit(db,user,'DELETE_PERSONNEL',def.table,key,old,null,text(body.reason,'Lý do xóa',1000));return{removed:true};
}
export async function listPersonnel(db,user,params){
    await requireAdministrator(db,user);const type=params.get('type')||'lecturer',def=definition(type),q=listParameters(params),where=[],args=[];
    if(q.departmentId){where.push('p.department_id=?');args.push(q.departmentId);}
    if(q.search){const fields=[`p.${def.code}`,'p.full_name','p.email'].map(c=>db.driver==='sqlite'?`QLSV_NORMALIZE(${c})`:c);where.push('('+fields.map(c=>`${c} LIKE ? ESCAPE '!'`).join(' OR ')+')');const term='%'+(db.driver==='sqlite'?q.normalized:q.search).replace(/[!%_]/g,'!$&')+'%';args.push(...fields.map(()=>term));}
    const condition=where.length?' WHERE '+where.join(' AND '):'';
    const from=`FROM ${def.table} p JOIN departments d ON d.department_id=p.department_id LEFT JOIN users u ON u.user_id=p.user_id LEFT JOIN roles r ON r.role_id=u.role_id LEFT JOIN account_archives a ON a.user_id=u.user_id`;
    const count=await db.get(`SELECT COUNT(*) AS n ${from}${condition}`,args);
    const rows=await db.all(`SELECT p.*,d.name AS department,u.username,r.name AS role,u.status AS account_status,a.deleted_at ${from}${condition} ORDER BY p.${def.code} LIMIT ? OFFSET ?`,[...args,q.limit,q.offset]);
    return{type,items:rows.map(p=>({id:String(p[def.pk]),code:p[def.code],name:p.full_name,email:p.email||'',phone:p.phone||'',departmentId:String(p.department_id),department:p.department,userId:p.user_id?String(p.user_id):'',username:p.username||'',role:p.role||'',accountStatus:p.deleted_at?'archived':p.account_status||''})),pagination:{page:q.page,limit:q.limit,total:Number(count.n),pages:Math.max(1,Math.ceil(Number(count.n)/q.limit))}};
}
