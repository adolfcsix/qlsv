import { publishResult, publishClass } from './results.service.js';
import { getGradebook, saveClassDrafts } from './gradebook.service.js';
import { requestGradeChange, listGradeChanges, reviewGradeChange } from './grade-changes.service.js';

export async function handleAssessment(ctx) {
    const { route, method, db, user } = ctx;
    const gradebook = route.match(/^\/api\/v1\/classes\/(\d+)\/gradebook$/);
    if (gradebook && method === 'GET') {
        ctx.json(200, { data: await getGradebook(db, user, gradebook[1]) });
        return true;
    }
    if (gradebook && method === 'POST') {
        ctx.json(200, { data: await saveClassDrafts(db, user, gradebook[1], (await ctx.body()).rows) });
        return true;
    }
    if (route === '/api/v1/grade-change-requests') {
        if (method === 'GET') ctx.json(200, { data: await listGradeChanges(db, user, ctx.url.searchParams) });
        else if (method === 'POST') ctx.json(201, { data: await requestGradeChange(db, user, await ctx.body()) });
        else return false;
        return true;
    }
    const review = route.match(/^\/api\/v1\/grade-change-requests\/(\d+)\/review$/);
    if (review && method === 'POST') {
        ctx.json(200, { data: await reviewGradeChange(db, user, review[1], await ctx.body()) });
        return true;
    }
    const bulk = route.match(/^\/api\/v1\/classes\/(\d+)\/publish$/);
    if (bulk && method === 'POST') {
        ctx.json(200, { data: await publishClass(db, user, bulk[1]) });
        return true;
    }
    const single = route.match(/^\/api\/v1\/enrollments\/(\d+)\/publish$/);
    if (single && method === 'POST') {
        ctx.json(200, { data: await publishResult(db, user, single[1]) });
        return true;
    }
    return false;
}
