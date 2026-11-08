import { getStudentPhoto } from './student-photo.service.js';
import { listStudentsController } from './students.controller.js';
import { writeResource } from '../operations/resource-write.js';
import { executeLookup } from '../ai/ai-tools.js';

export async function handleStudents(ctx) {
    const photo = /^\/api\/v1\/students\/([1-9]\d*)\/photo$/.exec(ctx.route);
    if (photo && ctx.method === 'GET') {
        const result = await getStudentPhoto(ctx.db, ctx.user, photo[1]);
        ctx.res.writeHead(200, {'Content-Type':result.mime,'Cache-Control':'private, no-store'});
        ctx.res.end(result.bytes);
        return true;
    }
    if (ctx.route === '/api/v1/students') {
        if (ctx.method === 'GET') await listStudentsController(ctx);
        else if (ctx.method === 'POST') await writeResource(ctx, 'students', 'POST');
        else return false;
        return true;
    }
    const id = ctx.route.match(/^\/api\/v1\/students\/([1-9]\d*)$/);
    if (id && ctx.method === 'PATCH') {
        await writeResource(ctx, 'students', 'PATCH', id[1]);
        return true;
    }
    // Detail/transcript lookups are intentionally read-only and enforce scope in AI tools.
    const student = ctx.route.match(/^\/api\/v1\/students\/([A-Za-z0-9_-]{3,30})(\/transcript)?$/);
    if (!student || ctx.method !== 'GET') return false;
    const result = await ctx.db.tx(() => executeLookup(ctx.db, ctx.user, {
        intent: student[2] ? 'student_transcript' : 'student_profile', studentCode: student[1]
    }));
    ctx.json(200, { data: result });
    return true;
}
