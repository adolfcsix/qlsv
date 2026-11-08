import { requireAdministrator } from '../../middlewares/authorize.js';
import { checkRevision } from '../operations/revision.js';
import { loadOverview } from './overview.service.js';
import { listPersonnel, savePersonnelWithin, deletePersonnelWithin } from './personnel.service.js';
import { loadCalendar, saveYearWithin, saveSemesterWithin, deleteCalendarWithin } from './academic-calendar.service.js';
import { listRooms, saveRoomWithin, deleteRoomWithin, roomUsage } from './rooms.service.js';
export async function handleAdminWorkspace(ctx){
    const {route,method,db,user}=ctx;
    const reads={'/api/v1/admin/overview':()=>loadOverview(db,user,ctx.url.searchParams),'/api/v1/admin/personnel':()=>listPersonnel(db,user,ctx.url.searchParams),'/api/v1/admin/calendar':()=>loadCalendar(db,user),'/api/v1/admin/rooms':()=>listRooms(db,user,ctx.url.searchParams)};
    if(method==='GET'&&Object.hasOwn(reads,route)){ctx.json(200,{data:await db.tx(reads[route])});return true;}
    const usage=/^\/api\/v1\/admin\/rooms\/(\d+)\/usage$/.exec(route);
    if(usage&&method==='GET'){ctx.json(200,{data:await db.tx(()=>roomUsage(db,user,usage[1]))});return true;}
    const personnel=/^\/api\/v1\/admin\/personnel\/(lecturer|staff)(?:\/(\d+))?$/.exec(route);
    const calendar=/^\/api\/v1\/admin\/(academic-years|semesters)(?:\/(\d+))?$/.exec(route);
    const room=/^\/api\/v1\/admin\/rooms(?:\/(\d+))?$/.exec(route);
    if(!personnel&&!calendar&&!room||!['POST','PATCH','DELETE'].includes(method))return false;
    const rowId=personnel?.[2]||calendar?.[2]||room?.[1]||null;
    if(method==='POST'&&rowId||method!=='POST'&&!rowId)return false;
    const body=await ctx.body();
    const result=await db.tx(async()=>{
        await requireAdministrator(db,user);await checkRevision(db,body.revision);let result;
        if(personnel)result=method==='DELETE'?await deletePersonnelWithin(db,user,personnel[1],rowId,body):await savePersonnelWithin(db,user,personnel[1],rowId,body);
        else if(calendar){const type=calendar[1]==='academic-years'?'year':'semester';result=method==='DELETE'?await deleteCalendarWithin(db,user,type,rowId,body):await (type==='year'?saveYearWithin:saveSemesterWithin)(db,user,rowId,body);}
        else result=method==='DELETE'?await deleteRoomWithin(db,user,rowId,body):await saveRoomWithin(db,user,rowId,body);
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');return result;
    });
    ctx.json(method==='POST'?201:200,{data:result});return true;
}
