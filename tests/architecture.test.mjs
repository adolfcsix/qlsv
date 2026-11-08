import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {seed} from '../frontend/src/demo/data.js';
import {hierarchyOptions,renderHierarchyFilters} from '../frontend/src/features/organization/hierarchy-filter.js';
import {filteredStudents} from '../frontend/src/utils/view-model.js';
import {openDatabase} from '../backend/src/config/database.js';
import {seedDemo} from '../backend/database/seeds/demo.seed.js';
import {getStudentGroups} from '../backend/src/modules/organization/organization.service.js';
import {getStudents} from '../backend/src/modules/students/students.service.js';

const demo=seed();
const user=demo.accounts.find(account=>account.role==='academic');
const ctx=(filters={})=>({db:demo,user,filters});

test('Bộ lọc phân cấp thực sự sử dụng khóa, khoa, ngành, chương trình, lớp',()=>{
  const p=demo.programs[0], major=demo.majors.find(m=>m.id===p.majorId);
  const filters={cohort:p.cohortId,department:major.departmentId,major:major.id,program:p.id};
  const options=hierarchyOptions(demo,filters,user);
  assert.ok(options.majors.every(m=>m.departmentId===major.departmentId));
  assert.ok(options.programs.every(item=>item.id===p.id));
  assert.ok(options.groups.every(group=>group.programId===p.id));
  const html=renderHierarchyFilters(demo,filters,user);
  for(const key of ['cohort','department','major','program','group'])
    assert.match(html,new RegExp(`data-filter="${key}"`));
  const actual=filteredStudents(ctx(filters));
  assert.ok(actual.length>0);
  assert.ok(actual.every(s=>options.groups.some(g=>g.id===s.groupId)));
  assert.equal(filteredStudents(ctx({...filters,department:'d2'})).length,0);
});

test('Backend có API danh mục lớp và hồ sơ phân trang, kiểm tra quyền theo vai trò',async()=>{
  const db=await openDatabase({driver:'sqlite',file:':memory:'});
  try{
    await db.initialize();await seedDemo(db);
    const staff={user_id:2,role:'ACADEMIC_STAFF'};
    const admin={user_id:1,role:'ADMIN'};
    const student={user_id:4,role:'STUDENT'};
    const groups=await getStudentGroups(db,staff,new URLSearchParams({admissionYear:'2024',limit:'2'}));
    assert.ok(groups.pagination.total>=2);
    assert.equal(groups.items.length,2);
    assert.ok(groups.items.every(g=>g.admissionYear===2024));
    assert.ok(groups.items.every(g=>typeof g.studentCount==='number'));
    const self=await getStudents(db,student,new URLSearchParams());
    assert.equal(self.items.length,1);
    const staffRows=await getStudents(db,staff,new URLSearchParams({search:'nguyen minh anh'}));
    assert.ok(staffRows.pagination.total>=1);
    await assert.rejects(()=>getStudents(db,admin,new URLSearchParams()),e=>e.status===403);
    await assert.rejects(()=>getStudentGroups(db,student,new URLSearchParams()),e=>e.status===403);
    await assert.rejects(()=>getStudents(db,staff,new URLSearchParams({limit:'10000'})),e=>e.status===422);
  }finally{await db.close();}
});

test('Mã nguồn không còn file cũ, bản sao, import mất đích hoặc module không dùng',()=>{
  const output=execFileSync(process.execPath,['scripts/audit-source.mjs'],{encoding:'utf8'});
  const report=JSON.parse(output);
  for(const key of ['missingImports','duplicateFiles','unusedSources','obsoleteFiles','missingStyles','unusedStyles'])
    assert.deepEqual(report[key],[],key);
});

test('36 bảng SQL lõi giữ nguyên nội dung theo file QLSV đã cung cấp',async()=>{
  const sql=await readFile(new URL('../backend/database/qlsv-original.sql',import.meta.url));
  const digest=createHash('sha256').update(sql).digest('hex');
  assert.equal(digest,'836a625bfd4ed8ba058cb2749c9727a32919d80e43acd68fa8ccb58cfa221ddd');
});
