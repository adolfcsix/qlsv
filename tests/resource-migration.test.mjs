import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { createApp } from '../backend/src/app.js';
import { resourceQuery, createResourcePages, paginatedRows } from '../frontend/src/services/resource-pages.js';
import { student_groups } from '../frontend/src/pages/academic/organization/student-groups.js';
import { students as studentList } from '../frontend/src/pages/academic/students/student-list.js';
import { seed } from '../frontend/src/demo/data.js';

const client = base => ({
    cookie: '', csrf: '',
    async call(route, method = 'GET', body, headers = {}) {
        const res = await fetch(base + '/api/v1' + route, {
            method, headers: { 'Content-Type': 'application/json',
                ...(this.cookie ? { Cookie: this.cookie } : {}),
                ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}), ...headers },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const json = await res.json();
        if (res.headers.get('set-cookie')) this.cookie = res.headers.get('set-cookie').split(';')[0];
        if (json.data?.csrf) this.csrf = json.data.csrf;
        return { status: res.status, ...json };
    },
    async login(name) { assert.equal((await this.call('/auth/login', 'POST', {
        username: name, password: 'Hocvu@2026' })).status, 200); },
    async state() { const response = await this.call('/state');
        assert.equal(response.status, 200); return response.data; }
});

test('API riêng lớp hành chính và sinh viên dùng chung nghiệp vụ cũ, có bảo mật và audit', async t => {
    const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
    const { server } = await createApp({ db, seed: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const staff = client(base), learner = client(base), admin = client(base), lecturer = client(base);
    try {
        await Promise.all([staff.login('cb001'), learner.login('20240001'), admin.login('quantri'), lecturer.login('gv001')]);
        await t.test('GET có lọc khóa/ngành/chương trình, tìm kiếm, phân trang và phạm vi', async () => {
            const filtered = await staff.call('/student-groups?admissionYear=2024&search=CNTT&limit=1&page=1');
            assert.equal(filtered.status, 200);
            assert.equal(filtered.data.items.length, 1);
            assert.ok(filtered.data.pagination.total >= 2);
            assert.ok(filtered.data.items.every(g => g.admissionYear === 2024 && g.code.includes('CNTT')));
            const next = await staff.call('/student-groups?admissionYear=2024&search=CNTT&limit=1&page=2');
            assert.equal(next.status, 200);
            assert.notEqual(filtered.data.items[0].id, next.data.items[0].id);
            const searched = await staff.call('/students?search=nguyen%20minh%20anh&admissionYear=2024&limit=2');
            assert.equal(searched.status, 200);
            assert.ok(searched.data.items.some(s => s.code === '20240001'));
            const allowed = await learner.call('/students?limit=100');
            assert.equal(allowed.status, 200);
            assert.equal(allowed.data.pagination.total, 1);
            assert.equal((await learner.call('/student-groups')).status, 403);
            assert.equal((await admin.call('/students')).status, 403);
            assert.equal((await staff.call('/student-groups?search=' + encodeURIComponent('a'.repeat(101)))).status, 422);
            const advised = await lecturer.call('/students?limit=100');
            assert.equal(advised.status, 200);
            assert.ok(advised.data.items.length >= 1);
        });
        await t.test('Tạo/sửa/xóa lớp theo revision, chặn trùng mã và chặn xóa lớp có sinh viên', async () => {
            let state = await staff.state();
            const data = { id: 'temporary-group', code: 'KT-TEST-063', name: 'Lớp kiểm thử V063',
                programId: state.programs[0].id, advisor: '' };
            assert.equal((await learner.call('/student-groups', 'POST', { revision: state.revision, after: data })).status, 403);
            assert.equal((await staff.call('/student-groups', 'POST', { revision: state.revision, after: data }, { 'X-CSRF-Token': 'invalid' })).status, 403);
            const created = await staff.call('/student-groups', 'POST', { revision: state.revision, after: data });
            assert.equal(created.status, 201);
            assert.equal((await staff.call('/student-groups', 'POST', { revision: state.revision, after: data })).status, 409);
            state = await staff.state();
            const row = state.groups.find(group => group.code === data.code);
            assert.ok(row);
            assert.equal((await staff.call('/student-groups/' + row.id, 'PATCH', {
                revision: state.revision, before: row, after: { ...row, privateKey: 'bad' }
            })).status, 403);
            const updated = await staff.call('/student-groups/' + row.id, 'PATCH', {
                revision: state.revision, before: row, after: { ...row, name: 'Lớp đã sửa' }
            });
            assert.equal(updated.status, 200);
            state = await staff.state();
            assert.equal(state.groups.find(group => group.id === row.id).name, 'Lớp đã sửa');
            const protectedGroup = state.groups.find(group =>
                state.students.some(student => student.groupId === group.id));
            assert.equal((await staff.call('/student-groups/' + protectedGroup.id, 'DELETE', {
                revision: state.revision, before: protectedGroup
            })).status, 409);
            assert.equal((await staff.call('/student-groups/' + row.id, 'DELETE', {
                revision: state.revision, before: { ...row, name: 'Lớp đã sửa' }
            })).status, 200);
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM student_groups WHERE group_code=?', [data.code])).n, 0);
            assert.ok((await db.get('SELECT COUNT(*) AS n FROM audit_logs WHERE entity_name=?', ['student_groups'])).n >= 3);
        });
        await t.test('Tạo và sửa hồ sơ qua API, chặn trạng thái không có quyết định, không mở xóa', async () => {
            let state = await staff.state();
            const record = { id: 'temporary-student', code: 'SV063777', name: 'Sinh viên kiểm thử',
                dob: '2004-04-11', gender: 'Nam', email: '', phone: '', address: '',
                admissionDate: '2024-09-01', groupId: state.groups[0].id, status: 'studying' };
            assert.equal((await learner.call('/students', 'POST', { revision: state.revision, after: record })).status, 403);
            assert.equal((await staff.call('/students', 'POST', { revision: state.revision, after: record })).status, 201);
            state = await staff.state();
            const student = state.students.find(s => s.code === record.code);
            assert.ok(student);
            assert.equal((await staff.call('/students/' + student.id, 'PATCH', {
                revision: state.revision, before: student,
                after: { ...student, status: 'on_leave' }
            })).status, 422);
            assert.equal((await staff.call('/students/' + student.id, 'PATCH', {
                revision: state.revision, before: student,
                after: { ...student, name: 'Đã chỉnh sửa' }
            })).status, 200);
            assert.equal((await staff.call('/students/' + student.id, 'DELETE', {
                revision: (await staff.state()).revision, before: student
            })).status, 404);
            assert.equal((await db.get('SELECT full_name FROM students WHERE student_code=?', [record.code])).full_name, 'Đã chỉnh sửa');
            state = await staff.state();
            const changed = state.students.find(s => s.code === record.code);
            const historyBefore = (await db.get('SELECT COUNT(*) AS n FROM student_status_history')).n;
            const invalid = await staff.call('/students/' + changed.id, 'PATCH', {
                revision: state.revision, before: changed,
                after: { ...changed, status: 'on_leave' },
                decision: { date: '2100-01-01', decision: 'QD-FUTURE', reason: 'Không hợp lệ' }
            });
            assert.equal(invalid.status, 422);
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM student_status_history')).n, historyBefore);
            const accepted = await staff.call('/students/' + changed.id, 'PATCH', {
                revision: state.revision, before: changed,
                after: { ...changed, status: 'on_leave' },
                decision: { date: '2026-09-15', decision: 'QD-063-77', reason: 'Bảo lưu theo quyết định được duyệt' }
            });
            assert.equal(accepted.status, 200);
            const history = await db.get('SELECT * FROM student_status_history WHERE student_id=? ORDER BY history_id DESC LIMIT 1', [changed.id]);
            assert.equal(history.decision_number, 'QD-063-77');
            assert.equal(history.new_status, 'on_leave');
            assert.equal((await db.get('SELECT status FROM students WHERE student_id=?', [changed.id])).status, 'on_leave');
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM student_status_history')).n, historyBefore + 1);
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});

test('Danh sách remote giữ IDs dạng chuỗi, phân trang máy chủ và không phụ thuộc toàn bộ snapshot', () => {
    const db = seed(), user = db.accounts.find(account => account.role === 'academic');
    const program = db.programs[0];
    const group = db.groups.find(group => group.programId === program.id);
    const filters = { cohort: program.cohortId, program: program.id, search: 'K24', page: 2 };
    const query = resourceQuery('groups', filters, db);
    assert.match(query, /student-groups\?/);
    assert.match(query, /admissionYear=2024/);
    assert.match(query, /curriculumId=/);
    assert.match(query, /page=2/);
    const page = { page: 1, pages: 2, total: 11, limit: 10 };
    const remote = { state: 'ready', data: { items: [{ id: 17, code: group.code,
        name: group.name, programId: Number(program.id), advisor: 'Cố vấn', studentCount: 73 }], pagination: page } };
    const html = student_groups({ db, user, parts: ['academic', 'organization', 'groups'], filters: {}, remoteList: remote });
    assert.match(html, /73/);
    assert.match(html, /11 lớp hành chính/);
    assert.match(html, /data-id="17"/);
    const stud = { state: 'ready', data: { items: [{ id: 999, code: 'SV063999',
        name: 'Nguyễn Minh Anh', status: 'studying', groupId: Number(group.id) }],
    pagination: { page: 1, pages: 1, total: 1, limit: 8 } } };
    const htmlStudents = studentList({ db, user, parts: ['academic', 'students'], filters: {}, remoteList: stud });
    assert.match(htmlStudents, /SV063999/);
    assert.match(htmlStudents, /1 hồ sơ/);
    assert.deepEqual(paginatedRows({ items: [1], pagination: page }).rows, [1]);
});

test('Cache danh sách bỏ kết quả đã hết hạn sau khi chỉnh sửa và xử lý lỗi API', async () => {
    let complete = 0, accept;
    const pages = createResourcePages(() => new Promise(resolve => { accept = resolve; }), () => { complete++; });
    const db = seed();
    assert.equal(pages.get('students', {}, db).state, 'loading');
    pages.clear();
    accept({ items: [], pagination: { page: 1, pages: 1, total: 0, limit: 8 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(complete, 0, 'Yêu cầu trước khi lưu không được ghi đè dữ liệu mới');
    const fresh = pages.get('students', {}, db);
    assert.equal(fresh.state, 'loading');
    accept({ items: [1], pagination: { page: 1, pages: 1, total: 1, limit: 8 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pages.get('students', {}, db).state, 'ready');
    assert.equal(complete, 1);
});
