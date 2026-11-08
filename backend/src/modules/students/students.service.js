import {ensure} from '../../core/errors.js';
import {listParameters} from '../organization/organization.service.js';
import {searchStudents} from './students.repository.js';

const statuses=['studying','on_leave','suspended','withdrawn','graduated'];
export async function getStudents(db,user,params){
  ensure(['ACADEMIC_STAFF','LECTURER','STUDENT'].includes(user.role),
    'Không có quyền xem danh sách hồ sơ.',403,'FORBIDDEN');
  const query=listParameters(params);
  query.groupId=params.get('groupId');
  if(query.groupId){ensure(/^\d+$/.test(query.groupId)&&Number(query.groupId)>0,'Bộ lọc groupId không hợp lệ.');query.groupId=Number(query.groupId);}
  const status=params.get('status');
  if(status){ensure(statuses.includes(status),'Trạng thái không hợp lệ.');query.status=status;}
  // listParameters already validates and normalizes the search text.
  const {total,items}=await searchStudents(db,user,query);
  return {items,pagination:{page:query.page,limit:query.limit,total,
    pages:Math.max(1,Math.ceil(total/query.limit))}};
}
