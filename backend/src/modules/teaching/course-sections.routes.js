import { getCourseSections, getCourseSection } from './course-sections.service.js';

export async function handleCourseSections(ctx) {
    if (ctx.method !== 'GET') return false;
    if (ctx.route === '/api/v1/course-sections') {
        ctx.json(200, { data: await getCourseSections(ctx.db, ctx.user, ctx.url.searchParams) });
        return true;
    }
    const match = /^\/api\/v1\/course-sections\/(\d+)$/.exec(ctx.route);
    if (!match) return false;
    ctx.json(200, { data: await getCourseSection(ctx.db, ctx.user, match[1]) });
    return true;
}
