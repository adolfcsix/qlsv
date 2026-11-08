import {ensure} from '../../core/errors.js';
import {listStudentGroups} from './organization.repository.js';

export function listParameters(searchParams){
  const number=(key,min,max)=>{
    const value=searchParams.get(key);
    if(value===null||value==='')return null;
    ensure(/^\d+$/.test(value)&&Number(value)>=min&&Number(value)<=max,
      `Bộ lọc ${key} không hợp lệ.`);
    return Number(value);
  };
  const search = (searchParams.get('search') || '').trim();
  ensure(search.length <= 100, 'Từ khóa tìm kiếm quá dài.');
  const normalized = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd').replaceAll('Đ', 'D').toLowerCase();
  const page=number('page',1,1000000)||1;
  const limit=number('limit',1,100)||20;
  return {admissionYear:number('admissionYear',2000,2100),
    departmentId:number('departmentId',1,100000000),
    majorId:number('majorId',1,100000000),
    curriculumId:number('curriculumId',1,100000000),
    search,normalized,page,limit,offset:(page-1)*limit};
}

export async function getStudentGroups(db,user,params){
  ensure(['ACADEMIC_STAFF','LECTURER','ADMIN'].includes(user.role),
    'Không có quyền tra cứu danh mục này.',403,'FORBIDDEN');
  const query=listParameters(params);
  const result=await listStudentGroups(db,user,query);
  return {items:result.rows,pagination:{page:query.page,limit:query.limit,
    total:result.total,pages:Math.max(1,Math.ceil(result.total/query.limit))}};
}
