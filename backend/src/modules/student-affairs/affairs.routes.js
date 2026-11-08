import { listGraduationReviews, draftGraduationReview, completeGraduationReview } from './graduation.service.js';
import { ensure } from '../../core/errors.js';
import { previewSummary,listSummaries,draftSummary,approveSummary } from './semester-summary.service.js';
import { listWarnings,draftWarning,approveWarning,revokeWarning } from './warnings.service.js';

export async function handleAffairs(ctx) {
    const {route,method,user,db}=ctx;
    if (route==='/api/v1/academic-semesters' && method==='GET') {
        ensure(['ACADEMIC_STAFF','STUDENT'].includes(user.role),'Không có quyền tra cứu học kỳ.',403);
        const rows=await db.all('SELECT semester_id AS id,name,start_date AS startDate,end_date AS endDate FROM semesters ORDER BY start_date DESC LIMIT 60');
        ctx.json(200,{data:rows}); return true;
    }
    if (route==='/api/v1/semester-summaries/preview' && method==='GET') {
        ctx.json(200,{data:await previewSummary(db,user,ctx.url.searchParams.get('studentId'),ctx.url.searchParams.get('semesterId'))});return true;
    }
    if(route==='/api/v1/semester-summaries') {
        if(method==='GET') ctx.json(200,{data:await listSummaries(db,user,ctx.url.searchParams.get('studentId'))});
        else if(method==='POST') { const body=await ctx.body();ctx.json(201,{data:await draftSummary(db,user,body.studentId,body.semesterId)}); }
        else return false;
        return true;
    }
    const approval=route.match(/^\/api\/v1\/semester-summaries\/(\d+)\/approve$/);
    if(approval && method==='POST') {ctx.json(200,{data:await approveSummary(db,user,approval[1])});return true;}
    if(route==='/api/v1/academic-warnings') {
        if(method==='GET') ctx.json(200,{data:await listWarnings(db,user,ctx.url.searchParams.get('studentId'))});
        else if(method==='POST') ctx.json(201,{data:await draftWarning(db,user,(await ctx.body()).summaryId)});
        else return false;
        return true;
    }
    const action=route.match(/^\/api\/v1\/academic-warnings\/(\d+)\/(approve|revoke)$/);
    if(action && method==='POST') {
        const body=await ctx.body();
        const data=action[2]==='approve' ? await approveWarning(db,user,action[1],body.decisionNumber) :
            await revokeWarning(db,user,action[1],body.reason);
        ctx.json(200,{data});return true;
    }
    if (route === '/api/v1/graduation-reviews') {
        if (method === 'GET') ctx.json(200,{data:await listGraduationReviews(db,user,ctx.url.searchParams.get('studentId'))});
        else if (method === 'POST') ctx.json(201,{data:await draftGraduationReview(db,user,await ctx.body())});
        else return false;
        return true;
    }
    const graduationAction = route.match(/^\/api\/v1\/graduation-reviews\/([1-9]\d*)\/(approve|reject)$/);
    if (graduationAction && method === 'POST') {
        const data = await completeGraduationReview(db,user,graduationAction[1],await ctx.body(),graduationAction[2]==='reject');
        ctx.json(200,{data}); return true;
    }
    return false;
}
