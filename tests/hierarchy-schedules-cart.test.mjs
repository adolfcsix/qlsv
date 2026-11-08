import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { openDatabase } from '../backend/src/config/database.js';
import { initialHierarchy, hierarchyForm, hierarchyParams } from '../frontend/src/features/organization/dependent-selects.js';
import { renderClassSessions, classSessions } from '../frontend/src/features/timetable/class-sessions.js';
import { hierarchyOptions } from '../frontend/src/features/organization/hierarchy-filter.js';
import { getLookupOptions } from '../frontend/src/services/lookup-service.js';
import { registration } from '../frontend/src/pages/student/course-registration.js';
import { seed } from '../frontend/src/demo/data.js';

function client(base) {
    let cookie = '';
    return {
        async login(username) {
            const response = await fetch(`${base}/api/v1/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: 'Hocvu@2026' })
            });
            assert.equal(response.status, 200);
            cookie = response.headers.get('set-cookie').split(';')[0];
        },
        async get(path) {
            const response = await fetch(`${base}/api/v1${path}`, {
                headers: { Cookie: cookie }
            });
            return { status: response.status, payload: await response.json() };
        }
    };
}

test('Form chọn phụ thuộc giữ đúng khóa/khoa/ngành và không hiển thị lựa chọn sai', async () => {
    const db = seed();
    const first = db.programs[0];
    const values = initialHierarchy(db, 'programs', first);
    assert.equal(values.cohortId, first.cohortId);
    assert.equal(values.departmentId, db.majors.find(m => m.id === first.majorId).departmentId);
    assert.deepEqual(hierarchyParams('majorId', values), { departmentId: values.departmentId });
    assert.deepEqual(hierarchyParams('programId', values), {
        cohortId: values.cohortId, majorId: values.majorId
    });
    assert.equal(hierarchyParams('programId', { cohortId: values.cohortId }), null);
    const html = await hierarchyForm('groups', db, { programId: first.id },
        (type, placeholder, filters) => getLookupOptions(type, placeholder, filters));
    assert.match(html, /name="cohortId"/);
    assert.match(html, /name="departmentId"/);
    assert.match(html, /name="majorId"/);
    assert.match(html, /name="programId"/);
    assert.match(html, new RegExp(`value="${first.id}" selected`));
    const choices = await getLookupOptions('programs', 'Chọn CTĐT', {
        cohortId: first.cohortId, majorId: first.majorId
    });
    assert.ok(choices.length >= 2);
    assert.equal(choices.length - 1, db.programs.filter(p =>
        p.cohortId === first.cohortId && p.majorId === first.majorId).length);
    const groups = await getLookupOptions('groups', 'Chọn lớp', { programId: first.id });
    assert.equal(groups.length - 1, db.groups.filter(g => g.programId === first.id).length);
    const options = hierarchyOptions({ ...db, groups: [] });
    assert.equal(options.programs.length, db.programs.length, 'Chương trình chưa có lớp vẫn xem được');
});

test('Buổi học hiển thị đầy đủ và escape ký tự nguy hiểm', () => {
    const row = { schedules: [
        { day: 1, start: '07:30', end: '10:00', room: 'A1' },
        { day: 7, start: '13:00', end: '15:30', room: '<img src=x onerror=alert(1)>' }
    ] };
    const html = renderClassSessions(row);
    assert.equal(classSessions(row).length, 2);
    assert.match(html, /Thứ 2/);
    assert.match(html, /Chủ nhật/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
    assert.equal(classSessions({ day: 3, start: '08:00', end: '10:00' }).length, 1);
});

test('Giỏ đăng ký dùng bản tóm tắt API khi lớp không nằm trong snapshot hoặc trang hiện tại', () => {
    const db = seed();
    const student = db.accounts.find(a => a.role === 'student');
    const id = 'new-class-outside-snapshot';
    const row = { id, code: 'CNTT-TEST-01', status: 'open', subjectName: 'Môn học đặc biệt',
        credits: 4, count: 1, capacity: 30, schedules: [{ day: 5, start: '09:00', end: '11:00', room: 'C2' }] };
    const html = registration({ db, user: student, filters: {}, cart: [id],
        cartDetails: { [id]: row }, remoteList: { state: 'ready',
            data: { items: [], pagination: { page: 1, pages: 1, total: 0, limit: 10 } } } });
    assert.match(html, /Môn học đặc biệt/);
    assert.match(html, /4 TC/);
    assert.match(html, /Tổng tín chỉ/);
    assert.match(html, /Thứ 6/);
    assert.match(html, /CNTT-TEST-01/);
});

test('API chi tiết chỉ trả lớp được cấp quyền và đủ lịch học nhiều buổi', async () => {
    const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
    const { server } = await createApp({ db, seed: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const staff = client(base), student = client(base), lecturer = client(base);
    try {
        await Promise.all([staff.login('cb001'), student.login('20240001'), lecturer.login('gv001')]);
        const listed = await staff.get('/course-sections?limit=100');
        assert.equal(listed.status, 200);
        const entry = listed.payload.data.items.find(row => row.schedules.length);
        assert.ok(entry, 'Cần một lớp đã xếp lịch để kiểm tra');
        const original = entry.schedules.length;
        const room = await db.get('SELECT room_id FROM rooms LIMIT 1');
        await db.run(`INSERT INTO class_schedules
            (class_id, room_id, day_of_week, start_time, end_time, start_date, end_date)
            VALUES (?, ?, 7, '08:00:00', '10:00:00', '2026-09-01', '2027-01-31')`,
        [Number(entry.id), room.room_id]);
        const detail = await staff.get(`/course-sections/${entry.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.payload.data.schedules.length, original + 1);
        assert.ok(detail.payload.data.schedules.some(row => row.day === 7));
        assert.equal((await staff.get('/course-sections?limit=100')).payload.data.items
            .find(row => row.id === entry.id).schedules.length, original + 1);
        assert.equal((await staff.get('/course-sections/invalid')).status, 404);
        assert.equal((await staff.get('/course-sections/999999')).status, 404);
        // Sinh viên và giảng viên không được đọc chi tiết lớp ngoài phạm vi API danh sách của mình.
        for (const person of [student, lecturer]) {
            const allowed = (await person.get('/course-sections?limit=100')).payload.data.items;
            const own = allowed[0];
            if (own) assert.equal((await person.get(`/course-sections/${own.id}`)).status, 200);
            const denied = listed.payload.data.items.find(row => !allowed.some(item => item.id === row.id));
            if (denied) assert.equal((await person.get(`/course-sections/${denied.id}`)).status, 404);
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});
