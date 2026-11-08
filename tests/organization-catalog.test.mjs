import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { createApp } from '../backend/src/app.js';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { seed } from '../frontend/src/demo/data.js';
import { cohorts } from '../frontend/src/pages/academic/organization/cohorts.js';
import { faculties } from '../frontend/src/pages/academic/organization/faculties.js';
import { majors } from '../frontend/src/pages/academic/organization/majors.js';
import { programs } from '../frontend/src/pages/academic/organization/programs.js';

function client(base) {
    return {
        cookie: '', csrf: '',
        async call(path, method = 'GET', body) {
            const res = await fetch(base + '/api/v1' + path, {
                method, headers: { 'Content-Type': 'application/json',
                    ...(this.cookie ? { Cookie: this.cookie } : {}),
                    ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            const payload = await res.json();
            if (res.headers.get('set-cookie')) this.cookie = res.headers.get('set-cookie').split(';')[0];
            if (payload.data?.csrf) this.csrf = payload.data.csrf;
            return { status: res.status, ...payload };
        },
        async login(name) {
            const result = await this.call('/auth/login', 'POST', {
                username: name, password: 'Hocvu@2026'
            });
            assert.equal(result.status, 200);
        },
        async state() {
            const result = await this.call('/state');
            assert.equal(result.status, 200);
            return result.data;
        }
    };
}

test('Bốn danh mục khoa/ngành/khóa/chương trình có API riêng nhưng dùng chung xử lý ghi có audit', async t => {
    const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
    const { server } = await createApp({ db, seed: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const staff = client(url), student = client(url), lecturer = client(url), admin = client(url);
    try {
        await Promise.all([staff.login('cb001'), student.login('20240001'),
            lecturer.login('gv001'), admin.login('quantri')]);
        await t.test('Tra cứu riêng có phân trang, lọc quan hệ và kiểm soát truy cập', async () => {
            for (const type of ['cohorts', 'departments', 'majors', 'programs']) {
                const response = await staff.call('/' + type + '?limit=1&page=1');
                assert.equal(response.status, 200, type);
                assert.equal(response.data.items.length, 1);
                assert.equal(typeof response.data.items[0].id, 'string');
                assert.ok(response.data.pagination.total >= 1);
                assert.equal((await student.call('/' + type)).status, 403);
                assert.equal((await lecturer.call('/' + type)).status, 403);
                assert.equal((await admin.call('/' + type)).status, 200);
            }
            const state = await staff.state();
            const major = state.majors[0];
            const majorsFound = await staff.call('/majors?departmentId=' + major.departmentId);
            assert.equal(majorsFound.status, 200);
            assert.ok(majorsFound.data.items.every(item => item.departmentId === major.departmentId));
            const cohort = state.cohorts[0];
            const programsFound = await staff.call('/programs?cohortId=' + cohort.id);
            assert.equal(programsFound.status, 200);
            assert.ok(programsFound.data.items.every(item => item.admissionYear === cohort.year));
            assert.equal((await staff.call('/programs?cohortId=bad')).status, 422);
            assert.equal((await staff.call('/majors?departmentId=0')).status, 422);
            assert.equal((await staff.call('/cohorts?search=' + encodeURIComponent('x'.repeat(101)))).status, 422);
            const literal = await staff.call('/cohorts?search=%25');
            assert.equal(literal.status, 200);
            assert.equal(literal.data.pagination.total, 0, 'Wildcard should be literal search');
            const filtered = await staff.call('/programs?cohortId=999999');
            assert.equal(filtered.data.pagination.total, 0);
        });
        await t.test('CRUD có quyền, revision, FK và nhật ký; không tạo handler trùng', async () => {
            let state = await staff.state();
            const cohortDraft = { id: 'temp-cohort', code: 'K29T', name: 'Khóa thử 2029', year: 2029 };
            assert.equal((await student.call('/cohorts', 'POST', {revision: state.revision, after: cohortDraft})).status, 403);
            assert.equal((await staff.call('/cohorts', 'POST', {revision: state.revision, after: {...cohortDraft, isAdmin: true}})).status, 403);
            assert.equal((await staff.call('/cohorts', 'POST', {revision: state.revision, after: cohortDraft})).status, 201);
            assert.equal((await staff.call('/cohorts', 'POST', {revision: state.revision, after: cohortDraft})).status, 409);
            state = await staff.state();
            const createdCohort = state.cohorts.find(row => row.code === 'K29T');
            assert.ok(createdCohort);
            assert.equal((await staff.call('/cohorts', 'POST', {
                revision: state.revision, after: { ...cohortDraft, id:'another',code:'K29X' }
            })).status, 409, 'Year 2029 is already assigned to one cohort');
            const departmentDraft = { id: 'temp-dept', code: 'KHOA-T', name: 'Khoa kiểm thử' };
            assert.equal((await staff.call('/departments', 'POST', {revision: state.revision, after: departmentDraft})).status, 201);
            state = await staff.state();
            const createdDept = state.departments.find(row => row.code === departmentDraft.code);
            const majorDraft = { id: 'temp-major', code: 'NGANH-T', name: 'Ngành kiểm thử', departmentId: createdDept.id };
            assert.equal((await staff.call('/majors', 'POST', {revision: state.revision, after: majorDraft})).status, 201);
            state = await staff.state();
            const createdMajor = state.majors.find(row => row.code === majorDraft.code);
            assert.equal((await staff.call('/departments/' + createdDept.id, 'DELETE', {
                revision: state.revision, before: createdDept
            })).status, 409);
            const programDraft = { id: 'temp-prog', code: 'CT-T', name: 'Chương trình kiểm thử',
                cohortId: createdCohort.id, majorId: createdMajor.id, credits: 125 };
            assert.equal((await staff.call('/programs', 'POST', {revision: state.revision, after: programDraft})).status, 201);
            state = await staff.state();
            const createdProgram = state.programs.find(row => row.code === programDraft.code);
            assert.ok(createdProgram);
            assert.equal((await staff.call('/cohorts/' + createdCohort.id, 'DELETE', {
                revision: state.revision, before: createdCohort
            })).status, 409);
            assert.equal((await staff.call('/majors/' + createdMajor.id, 'DELETE', {
                revision: state.revision, before: createdMajor
            })).status, 409);
            assert.equal((await staff.call('/cohorts/' + createdCohort.id, 'PATCH', {
                revision: state.revision, before: createdCohort,
                after: { ...createdCohort, name: 'Khóa đã đổi tên' }
            })).status, 200);
            state = await staff.state();
            assert.equal((await staff.call('/programs/' + createdProgram.id, 'PATCH', {
                revision: state.revision, before: createdProgram,
                after: {...createdProgram, credits: 130}
            })).status, 200);
            state = await staff.state();
            const updated = state.programs.find(row => row.code === 'CT-T');
            assert.equal(updated.credits, 130);
            const programForeignKey = await db.get('SELECT admission_year, major_id FROM curricula WHERE curriculum_id=?', [updated.id]);
            assert.equal(programForeignKey.admission_year, 2029);
            assert.equal(programForeignKey.major_id, Number(createdMajor.id));
            for (const [type, row] of [['programs', updated], ['majors', createdMajor],
                ['departments', createdDept], ['cohorts', state.cohorts.find(r => r.id === createdCohort.id)]]) {
                state = await staff.state();
                const fresh = state[type].find(r => r.id === row.id);
                assert.equal((await staff.call('/' + type + '/' + row.id, 'DELETE', {
                    revision: state.revision, before: fresh
                })).status, 200);
            }
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM curricula WHERE code=?', ['CT-T'])).n, 0);
            const logged = await db.get(`SELECT COUNT(*) AS n FROM audit_logs WHERE
                entity_name IN ('cohorts','departments','majors','curricula')`);
            assert.ok(logged.n >= 9);
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});

test('Frontend dùng API riêng và ưu tiên kết quả phân trang thay vì snapshot', () => {
    const db = seed(), user = db.accounts.find(account => account.role === 'academic');
    const pages = [
        [cohorts, 'cohorts'], [faculties, 'departments'],
        [majors, 'majors'], [programs, 'programs']
    ];
    for (const [render, type] of pages) {
        assert.match(resourceQuery(type, { search:'K24', page:2 }, db),
            new RegExp('^/' + type + '\\?'));
        const remote = {state: 'ready', data: {items: [], pagination: {page: 1,limit:10,pages:1,total:0}}};
        const html = render({db,user,remoteList:remote,filters:{},parts:['academic','organization',type]});
        assert.match(html, /0–0 \/ 0/);
        assert.doesNotMatch(html, /data-action="edit-org"/, 'No fallback to stale snapshot while remote returned zero');
    }
});
