import {openDatabase} from '../src/config/database.js';
import {ensure} from '../src/core/errors.js';
import {hashPassword} from '../src/modules/auth/auth.service.js';
import {text} from '../src/utils/validation.js';
const db=await openDatabase();try{
 await db.initialize();ensure(!await db.get('SELECT user_id FROM users LIMIT 1'),'Chỉ khởi tạo tài khoản trên CSDL mới chưa có người dùng.');
 const entries=[{role:'ADMIN',username:process.env.BOOTSTRAP_ADMIN_USERNAME,email:process.env.BOOTSTRAP_ADMIN_EMAIL,password:process.env.BOOTSTRAP_ADMIN_PASSWORD,code:'ADMIN-INIT',name:'Quản trị khởi tạo'},{role:'ACADEMIC_STAFF',username:process.env.BOOTSTRAP_STAFF_USERNAME,email:process.env.BOOTSTRAP_STAFF_EMAIL,password:process.env.BOOTSTRAP_STAFF_PASSWORD,code:'STAFF-INIT',name:'Cán bộ đào tạo khởi tạo'}];
 for(const e of entries){text(e.username,'Tên đăng nhập',100);ensure(/^[A-Za-z0-9_.-]{3,100}$/.test(e.username),'Tên đăng nhập không hợp lệ.');ensure(typeof e.email==='string'&&/^\S+@\S+\.\S+$/.test(e.email),'Email không hợp lệ.');ensure(typeof e.password==='string'&&e.password.length>=12&&e.password.length<=128,'Mật khẩu khởi tạo cần từ 12 đến 128 ký tự.');e.hash=await hashPassword(e.password);}
 await db.tx(async()=>{let dept=await db.get('SELECT department_id FROM departments ORDER BY department_id LIMIT 1');if(!dept)dept={department_id:await db.insert('departments',{department_code:'DT-INIT',name:'Đơn vị đào tạo — cần cập nhật'})};for(const e of entries){const role=await db.get('SELECT role_id FROM roles WHERE name=?',[e.role]);const uid=await db.insert('users',{username:e.username,email:e.email,password_hash:e.hash,role_id:role.role_id,status:'active'});await db.insert('user_security',{user_id:uid,must_change_password:1,password_version:1});await db.insert('staffs',{staff_code:e.code,full_name:e.name,department_id:dept.department_id,user_id:uid});}});
 console.log('Đã tạo hai tài khoản khởi tạo; bắt buộc đổi mật khẩu khi đăng nhập. Xóa các biến BOOTSTRAP khỏi .env sau khi bàn giao.');
}finally{await db.close();}
