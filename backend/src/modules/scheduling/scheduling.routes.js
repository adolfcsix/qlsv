import { required, academic } from '../operations/change-utils.js';
import { loadStaffScheduling, saveSection, saveSchedule, deleteSchedule, changeTargets, addMember, removeMember, deleteSection } from './scheduling.service.js';
export async function handleScheduling(ctx) {
    const {route,method,db,user}=ctx;
    if(route==='/api/v1/staff/scheduling'&&method==='GET'){ctx.json(200,{data:await db.tx(()=>loadStaffScheduling(db,user,ctx.url.searchParams))});return true;}
    if(route==='/api/v1/staff/course-sections'&&method==='POST'){ctx.json(201,{data:await saveSection(db,user,null,await ctx.body())});return true;}
    const section=/^\/api\/v1\/staff\/course-sections\/(\d+)$/.exec(route);
    if(section&&['PATCH','DELETE'].includes(method)){ctx.json(200,{data:await (method==='PATCH'?saveSection:deleteSection)(db,user,section[1],await ctx.body())});return true;}
    const schedule=/^\/api\/v1\/staff\/course-sections\/(\d+)\/schedules(?:\/(\d+))?$/.exec(route);
    if(schedule&&['POST','PATCH'].includes(method)){ctx.json(200,{data:await saveSchedule(db,user,schedule[1],schedule[2]||null,await ctx.body())});return true;}
    const audience=/^\/api\/v1\/staff\/schedules\/(\d+)\/audiences$/.exec(route);
    if(audience&&method==='POST'){academic(user);const slot=await required(db,'class_schedules','schedule_id',audience[1]);ctx.json(200,{data:await changeTargets(db,user,slot.class_id,await ctx.body(),audience[1])});return true;}
    const removal=/^\/api\/v1\/staff\/schedules\/(\d+)$/.exec(route);
    if(removal&&method==='DELETE'){ctx.json(200,{data:await deleteSchedule(db,user,removal[1],await ctx.body())});return true;}
    const target=/^\/api\/v1\/staff\/course-sections\/(\d+)\/(targets|members)(?:\/(\d+))?$/.exec(route);
    if(target&&method==='POST'&&!target[3]){ctx.json(200,{data:await (target[2]==='targets'?changeTargets:addMember)(db,user,target[1],await ctx.body())});return true;}
    if(target&&target[2]==='members'&&target[3]&&method==='DELETE'){ctx.json(200,{data:await removeMember(db,user,target[1],target[3],await ctx.body())});return true;}
    return false;
}
