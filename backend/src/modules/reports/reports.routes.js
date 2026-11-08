import { snapshot } from './snapshot.service.js';
export async function handleReports(ctx) {
    if (ctx.route !== '/api/v1/state' || ctx.method !== 'GET')
        return false;
    const state = await ctx.db.tx(() => snapshot(ctx.db, ctx.user));
    if (ctx.user.mustChange)
        for (const key of Object.keys(state))
            if (Array.isArray(state[key]) && key !== 'accounts')
                state[key] = [];
    ctx.json(200, { data: state });
    return true;
}
