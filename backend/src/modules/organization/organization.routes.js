import { listGroupsController } from './organization.controller.js';
import { getCatalog, catalogPaths } from './catalog.service.js';
import { writeResource } from '../operations/resource-write.js';

// Catalog routes and student groups use ONE write path: applyChanges -> handleCatalog.
export async function handleOrganization(ctx) {
    if (ctx.route === '/api/v1/student-groups') {
        if (ctx.method === 'GET') await listGroupsController(ctx);
        else if (ctx.method === 'POST') await writeResource(ctx, 'groups', 'POST');
        else return false;
        return true;
    }
    const group = ctx.route.match(/^\/api\/v1\/student-groups\/([1-9]\d*)$/);
    if (group && ['PATCH', 'DELETE'].includes(ctx.method)) {
        await writeResource(ctx, 'groups', ctx.method, group[1]);
        return true;
    }
    const match = ctx.route.match(/^\/api\/v1\/(cohorts|departments|majors|programs)(?:\/([1-9]\d*))?$/);
    if (!match || !Object.hasOwn(catalogPaths, match[1])) return false;
    const [, type, id] = match;
    if (!id && ctx.method === 'GET') {
        ctx.json(200, { data: await getCatalog(ctx.db, ctx.user, type, ctx.url.searchParams) });
        return true;
    }
    if ((!id && ctx.method === 'POST') || (id && ['PATCH', 'DELETE'].includes(ctx.method))) {
        await writeResource(ctx, type, ctx.method, id || null);
        return true;
    }
    return false;
}
