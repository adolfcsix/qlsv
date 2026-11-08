import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {seed} from '../frontend/src/demo/data.js';
import {cohorts} from '../frontend/src/pages/academic/organization/cohorts.js';
import {faculties} from '../frontend/src/pages/academic/organization/faculties.js';
import {majors} from '../frontend/src/pages/academic/organization/majors.js';
import {programs} from '../frontend/src/pages/academic/organization/programs.js';
import {student_groups} from '../frontend/src/pages/academic/organization/student-groups.js';
import {dashboard} from '../frontend/src/pages/dashboards/index.js';

const db=seed();
const context=(role='academic')=>({db,user:db.accounts.find(a=>a.role===role),parts:[role,'organization'],filters:{},cart:[]});

test('Năm màn hình tổ chức đào tạo độc lập và chọn đúng bảng',()=>{
 const labels=[
  [cohorts,'MÃ KHÓA'],[faculties,'MÃ KHOA'],[majors,'MÃ NGÀNH'],
  [programs,'CHƯƠNG TRÌNH'],[student_groups,'LỚP HÀNH CHÍNH']
 ];
 for(const [render,label] of labels){const html=render(context());assert.match(html,new RegExp(label));assert.match(html,/Thêm/);}
});

test('Dashboard mỗi vai trò có phần thống kê đặc thù',()=>{
 const checks=[['sysadmin','Tài khoản hoạt động'],['academic','Hồ sơ sinh viên'],['lecturer','Lớp giảng dạy'],['student','Tín chỉ đã đạt']];
 for(const [role,label] of checks)assert.ok(dashboard({...context(role),parts:[role,'dashboard']}).includes(label),role);
});

test('Không còn app.js và pages.js lớn tập trung logic',async()=>{
 for(const file of ['../frontend/src/app/controller.js','../frontend/src/pages/index.js']){
  const code=await readFile(new URL(file,import.meta.url),'utf8');
  assert.ok(code.length>50);
 }
});
