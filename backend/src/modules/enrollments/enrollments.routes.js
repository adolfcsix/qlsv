import { submitEnrollmentRequests, listEnrollmentRequests, reviewEnrollmentRequest, cancelEnrollmentRequest } from './enrollment-requests.service.js';
import { ensure } from '../../core/errors.js';
import { registerCourse } from './enrollments.service.js';
import { myEnrollments, cancelEnrollment, requestWithdrawal, withdrawEnrollment } from './enrollment-lifecycle.service.js';

export async function handleEnrollments(ctx) {
    if (ctx.route === '/api/v1/enrollment-requests') {
        if (ctx.method === 'GET') ctx.json(200,{data:await listEnrollmentRequests(ctx.db,ctx.user,ctx.url.searchParams)});
        else if (ctx.method === 'POST') ctx.json(202,{data:await submitEnrollmentRequests(ctx.db,ctx.user,await ctx.body())});
        else return false;
        return true;
    }
    const request = /^\/api\/v1\/enrollment-requests\/(\d+)\/(review|cancel)$/.exec(ctx.route);
    if (request && ctx.method === 'POST') {
        const body = await ctx.body();
        const result = request[2] === 'review' ? await reviewEnrollmentRequest(ctx.db,ctx.user,request[1],body) :
            await cancelEnrollmentRequest(ctx.db,ctx.user,request[1]);
        ctx.json(200,{data:result});return true;
    }

    if (ctx.route === '/api/v1/enrollments' && ctx.method === 'GET') {
        ctx.json(200, { data: await myEnrollments(ctx.db, ctx.user) });
        return true;
    }
    if (ctx.route === '/api/v1/enrollments' && ctx.method === 'POST') {
        const body = await ctx.body();
        if (ctx.user.role === 'STUDENT') {
            ctx.json(202,{data:await submitEnrollmentRequests(ctx.db,ctx.user,body)});return true;
        }
        ensure(Array.isArray(body.classIds) && body.classIds.length > 0 && body.classIds.length <= 20,
            'Danh sách lớp không hợp lệ.');
        const ids = await ctx.db.tx(async () => {
            const result = [];
            for (const classId of new Set(body.classIds))
                result.push(await registerCourse(ctx.db, ctx.user, body.studentId, classId));
            await ctx.db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
            return result;
        });
        ctx.json(200, { data: { enrollmentIds: ids } });
        return true;
    }
    const match = /^\/api\/v1\/enrollments\/(\d+)\/(cancel|withdraw|withdraw-request)$/.exec(ctx.route);
    if (!match || ctx.method !== 'POST') return false;
    const body = await ctx.body();
    const result = match[2] === 'cancel' ? await cancelEnrollment(ctx.db, ctx.user, match[1]) :
        match[2] === 'withdraw' ? await withdrawEnrollment(ctx.db, ctx.user, match[1], body.reason, body.requestId) :
            await requestWithdrawal(ctx.db, ctx.user, match[1], body.reason);
    ctx.json(200, { data: result });
    return true;
}
