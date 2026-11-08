import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { openDatabase } from '../backend/src/config/database.js';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { getLookupOptions } from '../frontend/src/services/lookup-service.js';
import { seed } from '../frontend/src/demo/data.js';
import { registration } from '../frontend/src/pages/student/course-registration.js';
import { courses } from '../frontend/src/pages/academic/teaching/course-sections.js';

function client(base) {
    return {
        cookie: '', csrf: '',
        async call(path, method = 'GET', body) {
            const response = await fetch(base + '/api/v1' + path, {
                method,
                headers: { 'Content-Type': 'application/json',
                    ...(this.cookie ? { Cookie: this.cookie } : {}),
                    ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            const payload = await response.json();
            if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
            if (payload.data?.csrf) this.csrf = payload.data.csrf;
            return { status: response.status, ...payload };
        },
        async login(username) {
            const result = await this.call('/auth/login', 'POST', {username, password: 'Hocvu@2026'});
            assert.equal(result.status, 200, username);
        }
    };
}

test('API danh mục biểu mẫu lọc tại SQL và kiểm tra quyền', async t => {
    const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
    const { server } = await createApp({ db, seed: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const staff = client(base), student = client(base), lecturer = client(base), admin = client(base);
    try {
        await Promise.all([staff.login('cb001'), student.login('20240001'),
            lecturer.login('gv001'), admin.login('quantri')]);
        await t.test('Các lựa chọn có ID, tên; không cấp quyền đọc bừa', async () => {
            for (const type of ['cohorts', 'departments', 'majors', 'programs',
                'groups', 'lecturers', 'subjects', 'classes']) {
                const found = await staff.call(`/lookups/${type}?limit=2`);
                assert.equal(found.status, 200, type);
                assert.ok(found.data.pagination.total >= 1, type);
                assert.ok(found.data.items.length <= 2);
                assert.equal(typeof found.data.items[0].id, 'string');
                assert.ok(found.data.items[0].name);
                assert.equal((await student.call(`/lookups/${type}`)).status, 403);
                assert.equal((await lecturer.call(`/lookups/${type}`)).status, 403);
                assert.equal((await admin.call(`/lookups/${type}`)).status, 200);
            }
            assert.equal((await client(base).call('/lookups/groups')).status, 401);
            assert.equal((await staff.call('/lookups/secret')).status, 404);
        });
        await t.test('Bộ lọc phụ thuộc không làm rò hay trả sai lớp', async () => {
            const groups = await staff.call('/lookups/groups?limit=100');
            const group = groups.data.items[0];
            const byProgram = await staff.call(`/lookups/groups?programId=${group.programId}`);
            assert.equal(byProgram.status, 200);
            assert.ok(byProgram.data.items.length >= 1);
            assert.ok(byProgram.data.items.every(g => g.programId === group.programId));
            const major = (await staff.call('/lookups/majors?limit=100')).data.items[0];
            const majors = await staff.call(`/lookups/majors?departmentId=${major.departmentId}`);
            assert.ok(majors.data.items.every(m => m.departmentId === major.departmentId));
            assert.equal((await staff.call('/lookups/groups?programId=bad')).status, 422);
            assert.equal((await staff.call('/lookups/majors?cohortId=1')).status, 422);
            assert.equal((await staff.call('/lookups/groups?search=' + encodeURIComponent('x'.repeat(101)))).status, 422);
            assert.equal((await staff.call('/lookups/groups?search=%25')).data.pagination.total, 0);
            assert.equal((await staff.call('/lookups/programs?cohortId=999999')).data.pagination.total, 0);
        });
        await t.test('Danh sách lớp học phần: phạm vi theo sinh viên, giảng viên và phân trang', async () => {
            const staffRows = await staff.call('/course-sections?limit=2');
            assert.equal(staffRows.status, 200);
            assert.equal(staffRows.data.items.length, 2);
            assert.ok(staffRows.data.pagination.total > 1);
            const studentRows = await student.call('/course-sections?limit=100');
            assert.equal(studentRows.status, 200);
            assert.ok(studentRows.data.items.every(row => row.status === 'open'));
            const studentId = (await db.get('SELECT student_id FROM students WHERE user_id=(SELECT user_id FROM users WHERE username=?)', ['20240001'])).student_id;
            for (const row of studentRows.data.items) {
                const inCurriculum = await db.get(`SELECT cs.curriculum_subject_id FROM curriculum_subjects cs
                    JOIN student_groups g ON g.curriculum_id=cs.curriculum_id
                    JOIN students s ON s.student_group_id=g.student_group_id
                    WHERE s.student_id=? AND cs.subject_id=?`, [studentId, row.subjectId]);
                assert.ok(inCurriculum, `Lớp ${row.code} phải thuộc chương trình`);
            }
            const gvRows = await lecturer.call('/course-sections?limit=100');
            assert.equal(gvRows.status, 200);
            const assigned = await db.get('SELECT lecturer_id FROM lecturers WHERE user_id=(SELECT user_id FROM users WHERE username=?)', ['gv001']);
            assert.ok(gvRows.data.items.every(row => Number(row.lecturerId) === assigned.lecturer_id));
            assert.equal((await admin.call('/course-sections')).status, 403);
            assert.equal((await staff.call('/course-sections?status=invalid')).status, 422);
            assert.equal((await student.call('/course-sections?status=completed')).data.pagination.total, 0);
            assert.equal((await staff.call('/course-sections?search=%25')).data.pagination.total, 0);
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});

test('Trang frontend dùng đúng API mới, không quay về snapshot nếu API trả rỗng', async () => {
    const db = seed();
    const staff = db.accounts.find(a => a.role === 'academic');
    const student = db.accounts.find(a => a.role === 'student');
    assert.match(resourceQuery('course-sections', { search: 'Cơ sở dữ liệu', page: 2 }, db),
        /^\/course-sections\?page=2&limit=10&search=/);
    assert.match(resourceQuery('registration-sections', { page: 1 }, db), /status=open/);
    const remote = { state: 'ready', data: {
        items: [], pagination: { page: 1, pages: 1, total: 0, limit: 10 }
    } };
    const html = courses({ db, user: staff, filters: {}, remoteList: remote });
    assert.match(html, /Không có lớp phù hợp/);
    assert.doesNotMatch(html, /data-action="class-detail"/);
    const reg = registration({ db, user: student, cart: [], filters: {}, remoteList: remote });
    assert.match(reg, /0–0 \/ 0/);
    assert.doesNotMatch(reg, /data-action="cart"/);
    const offline = await getLookupOptions('departments', 'Chọn khoa');
    assert.deepEqual(offline[0], ['', 'Chọn khoa']);
    assert.ok(offline.length > 1);
});
