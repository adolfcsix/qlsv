import { applyChanges } from './changes.service.js';
export async function handleChanges(ctx) {
    if (ctx.route !== '/api/v1/changes' || ctx.method !== 'POST')
        return false;
    ctx.json(200, { data: await applyChanges(ctx.db, ctx.user, await ctx.body()) });
    return true;
}
