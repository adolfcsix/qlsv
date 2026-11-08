import { getLookup } from './lookups.service.js';

export async function handleLookups(ctx) {
    const match = ctx.route.match(/^\/api\/v1\/lookups\/([a-z-]+)$/);
    if (!match || ctx.method !== 'GET') return false;
    ctx.json(200, { data: await getLookup(ctx.db, ctx.user, match[1], ctx.url.searchParams) });
    return true;
}
