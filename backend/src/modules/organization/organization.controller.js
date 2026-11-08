import {getStudentGroups} from './organization.service.js';
export async function listGroupsController({db,user,url,json}){
  const result=await getStudentGroups(db,user,url.searchParams);
  json(200,{data:result});
}
