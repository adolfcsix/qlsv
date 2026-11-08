import { getPersonalWeek } from './timetable.service.js';
export async function handleTimetable(ctx) {
    if (ctx.route !== '/api/v1/timetable' || ctx.method !== 'GET') return false;
    ctx.json(200, { data: await getPersonalWeek(ctx.db, ctx.user, ctx.url.searchParams.get('start')) });
    return true;
}
