import { examAttempts, saveExamScore } from '../assessment/results.service.js';
export async function handleExams(ctx) {
    const { route, method, db, user } = ctx;
    const list = route.match(/^\/api\/v1\/enrollments\/(\d+)\/exam-attempts$/);
    if (list && method === 'GET') {
        ctx.json(200, { data: await db.tx(() => examAttempts(db, user, list[1])) });
        return true;
    }
    const score = route.match(/^\/api\/v1\/exam-registrations\/(\d+)\/score$/);
    if (score && method === 'POST') {
        ctx.json(200, { data: await saveExamScore(db, user, score[1], await ctx.body()) });
        return true;
    }
    return false;
}
