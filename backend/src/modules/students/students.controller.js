import {getStudents} from './students.service.js';
export async function listStudentsController({db,user,url,json}){
  json(200,{data:await getStudents(db,user,url.searchParams)});
}
