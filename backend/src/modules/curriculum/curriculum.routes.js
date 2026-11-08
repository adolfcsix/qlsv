import { listCurriculumVersions, cloneCurriculum, approveCurriculumVersion } from './curriculum-versions.service.js';
import { listRecognitions, recognitionCandidates, approveRecognition, revokeRecognition } from './credit-recognitions.service.js';
import { progress } from './curriculum-progress.service.js';
import { getPlan, saveElectiveGroup, removeElectiveGroup,
    saveCurriculumSubject, removeCurriculumSubject, updatePrerequisite } from './curriculum.service.js';

// Keep HTTP parsing here and domain rules in the service; no alternative CRUD path.
export async function handleCurriculum(ctx) {
    const { route, method, db, user } = ctx;
    if (route === '/api/v1/curriculum-plan' && method === 'GET') {
        ctx.json(200, { data: await getPlan(db, user, ctx.url.searchParams.get('curriculumId')) }); return true;
    }
    if (route === '/api/v1/curriculum-progress' && method === 'GET') {
        ctx.json(200, { data: await progress(db, user, ctx.url.searchParams.get('studentId')) }); return true;
    }
    if (route === '/api/v1/curriculum-versions' && method === 'GET') {
        ctx.json(200, { data: await listCurriculumVersions(db, user, ctx.url.searchParams.get('curriculumId')) }); return true;
    }
    if (route === '/api/v1/curriculum-versions' && method === 'POST') {
        ctx.json(201, { data: await cloneCurriculum(db, user, await ctx.body()) }); return true;
    }
    const versionApproval = route.match(/^\/api\/v1\/curriculum-versions\/([1-9]\d*)\/approve$/);
    if (versionApproval && method === 'POST') {
        ctx.json(200, { data: await approveCurriculumVersion(db, user, versionApproval[1], await ctx.body()) }); return true;
    }
    if (route === '/api/v1/credit-recognitions' && method === 'GET') {
        ctx.json(200, { data: await listRecognitions(db, user, ctx.url.searchParams.get('studentId')) }); return true;
    }
    if (route === '/api/v1/credit-recognitions/candidates' && method === 'GET') {
        ctx.json(200, { data: await recognitionCandidates(db, user, ctx.url.searchParams.get('studentId')) }); return true;
    }
    if (route === '/api/v1/credit-recognitions' && method === 'POST') {
        ctx.json(201, { data: await approveRecognition(db, user, await ctx.body()) }); return true;
    }
    const revoke = route.match(/^\/api\/v1\/credit-recognitions\/([1-9]\d*)\/revoke$/);
    if (revoke && method === 'POST') {
        ctx.json(200, { data: await revokeRecognition(db, user, revoke[1], await ctx.body()) }); return true;
    }
    const elective = route.match(/^\/api\/v1\/elective-groups(?:\/([1-9]\d*))?$/);
    if (elective && ((!elective[1] && method === 'POST') || (elective[1] && ['PATCH', 'DELETE'].includes(method)))) {
        const body = await ctx.body();
        const data = method === 'DELETE' ? await removeElectiveGroup(db, user, elective[1], body.revision) :
            await saveElectiveGroup(db, user, body, elective[1]);
        ctx.json(method === 'POST' ? 201 : 200, { data }); return true;
    }
    const subject = route.match(/^\/api\/v1\/curriculum-subjects(?:\/([1-9]\d*))?$/);
    if (subject && ((!subject[1] && method === 'POST') || (subject[1] && ['PATCH', 'DELETE'].includes(method)))) {
        const body = await ctx.body();
        const data = method === 'DELETE' ? await removeCurriculumSubject(db, user, subject[1], body.revision) :
            await saveCurriculumSubject(db, user, body, subject[1]);
        ctx.json(method === 'POST' ? 201 : 200, { data }); return true;
    }
    if (route === '/api/v1/subject-prerequisites' && ['POST', 'DELETE'].includes(method)) {
        ctx.json(method === 'POST' ? 201 : 200,
            { data: await updatePrerequisite(db, user, await ctx.body(), method === 'DELETE') }); return true;
    }
    return false;
}
