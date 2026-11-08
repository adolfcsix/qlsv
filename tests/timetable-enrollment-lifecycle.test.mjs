import { weekRange } from '../frontend/src/utils/view-model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { createApp } from '../backend/src/app.js';
import { parseWeekStart } from '../backend/src/modules/timetable/timetable.service.js';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { schedule } from '../frontend/src/pages/academic/teaching/timetable.js';
import { registration } from '../frontend/src/pages/student/course-registration.js';

function client(origin) {
    return {
        cookie: '', csrf: '',
        async req(path, method = 'GET', body) {
            const res = await fetch(origin + '/api/v1' + path, { method,
                headers: { 'Content-Type': 'application/json',
                    ...(this.cookie ? { Cookie: this.cookie } : {}),
                    ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body) });
            const payload = await res.json();
            if (res.headers.get('set-cookie')) this.cookie = res.headers.get('set-cookie').split(';')[0];
            if (payload.data?.csrf) this.csrf = payload.data.csrf;
            return { status: res.status, ...payload };
        },
        login(username) { return this.req('/auth/login', 'POST', { username, password: 'Hocvu@2026' }); }
    };
}

test('Lịch tuần cá nhân và hủy/rút học từ API: quyền, điều kiện, audit', async t => {
    const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
    const { server } = await createApp({ db, seed: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const student = client(origin), second = client(origin), lecturer = client(origin);
    const staff = client(origin), admin = client(origin);
    try {
        await db.update('user_security', 'user_id', 5, { must_change_password: 0 });
        for (const [c, name] of [[student, '20240001'], [second, '20240002'],
            [lecturer, 'gv001'], [staff, 'cb001'], [admin, 'quantri']]) {
            assert.equal((await c.login(name)).status, 200, name);
        }
        async function registerAndApprove() {
            const submitted=await student.req('/enrollments','POST',{studentId:'1',classIds:['2']});
            if(submitted.status!==202)return submitted;
            const reviewed=await staff.req(`/enrollment-requests/${submitted.data.requestIds[0]}/review`,'POST',{decision:'approve',reason:'Đã đối chiếu đăng ký trong kiểm thử'});
            return reviewed.status===200?{status:200,data:{enrollmentIds:[reviewed.data.enrollmentId]}}:reviewed;
        }
        await t.test('Lịch tuần: sinh viên/giảng viên đúng phạm vi, chặn vai trò khác', async () => {
            const route = '/timetable?start=2026-11-02';
            const sv = await student.req(route), gv = await lecturer.req(route);
            assert.equal(sv.status, 200);
            assert.equal(gv.status, 200);
            assert.ok(sv.data.items.length > 0);
            assert.ok(sv.data.items.every(row => row.date >= '2026-11-02' && row.date <= '2026-11-08'));
            assert.ok(sv.data.items.every(row => row.subject && row.room));
            assert.equal((await staff.req(route)).status, 403);
            assert.equal((await admin.req(route)).status, 403);
            assert.equal((await student.req('/timetable?start=2026-11-03')).status, 422);
            assert.equal((await student.req('/timetable?start=2026-02-30')).status, 422);
            assert.equal((await client(origin).req(route)).status, 401);
        });
        await t.test('Lịch nhiều buổi và giới hạn theo enrollment/lecturer từ SQL', async () => {
            const base = await student.req('/timetable?start=2026-11-02');
            const assigned = await db.get(`SELECT c.class_id FROM classes c JOIN enrollments e ON e.class_id=c.class_id
                WHERE e.student_id=1 AND e.status IN ('registered','studying')
                AND NOT EXISTS (SELECT 1 FROM enrollments other WHERE other.class_id=c.class_id
                    AND other.student_id=2 AND other.status IN ('registered','studying'))
                ORDER BY c.class_id LIMIT 1`);
            assert.ok(assigned);
            const room = await db.get('SELECT room_id FROM rooms LIMIT 1');
            const id = await db.insert('class_schedules', { class_id: assigned.class_id, room_id: room.room_id,
                day_of_week: 7, start_time: '14:00', end_time: '15:00',
                start_date: '2026-11-02', end_date: '2026-11-08' });
            const after = await student.req('/timetable?start=2026-11-02');
            assert.equal(after.data.items.filter(e => e.id === String(id) && e.date === '2026-11-08').length, 1);
            assert.equal(after.data.items.length, base.data.items.length + 1);
            const other = await second.req('/timetable?start=2026-11-02');
            assert.ok(!other.data.items.some(e => e.id === String(id)));
        });
        await t.test('Danh sách đăng ký không trả dữ liệu sinh viên khác', async () => {
            const mine = await student.req('/enrollments'), another = await second.req('/enrollments');
            assert.equal(mine.status, 200);
            assert.equal(another.status, 200);
            assert.ok(mine.data.items.length > 0);
            assert.ok(mine.data.items.every(e => !another.data.items.some(o => o.id === e.id)));
            assert.equal((await admin.req('/enrollments')).status, 403);
            assert.equal((await lecturer.req('/enrollments')).status, 403);
        });
        let newEnrollmentId;
        await t.test('Đăng ký/hủy trong hạn: quyền, lịch sử và giải phóng chỗ', async () => {
            const initial = await student.req('/enrollments');
            const registered = await registerAndApprove();
            assert.equal(registered.status, 200, JSON.stringify(registered.error));
            newEnrollmentId = String(registered.data.enrollmentIds[0]);
            assert.ok(!initial.data.items.some(r => r.id === newEnrollmentId));
            assert.equal((await second.req(`/enrollments/${newEnrollmentId}/cancel`, 'POST', {})).status, 403);
            const cancel = await student.req(`/enrollments/${newEnrollmentId}/cancel`, 'POST', {});
            assert.equal(cancel.status, 200, JSON.stringify(cancel.error));
            assert.equal(cancel.data.status, 'cancelled');
            assert.equal((await student.req(`/enrollments/${newEnrollmentId}/cancel`, 'POST', {})).status, 409);
            assert.equal((await db.get('SELECT status FROM enrollments WHERE enrollment_id=?', [newEnrollmentId])).status, 'cancelled');
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM audit_logs WHERE action=? AND entity_id=?',
                ['CANCEL_ENROLLMENT', newEnrollmentId])).n, 1);
        });
        await t.test('Hết thời hạn: không cho hủy; đề nghị rút học không trực tiếp đổi trạng thái', async () => {
            const registered = await registerAndApprove();
            assert.equal(registered.status, 200);
            assert.equal(String(registered.data.enrollmentIds[0]), newEnrollmentId);
            const row = await db.get('SELECT c.semester_id FROM classes c JOIN enrollments e ON e.class_id=c.class_id WHERE e.enrollment_id=?', [newEnrollmentId]);
            const semester = await db.get('SELECT registration_end FROM semesters WHERE semester_id=?', [row.semester_id]);
            await db.update('semesters', 'semester_id', row.semester_id, { registration_end: '2026-01-01 01:00:00' });
            try {
                assert.equal((await student.req(`/enrollments/${newEnrollmentId}/cancel`, 'POST', {})).status, 409);
                assert.equal((await db.get('SELECT status FROM enrollments WHERE enrollment_id=?', [newEnrollmentId])).status, 'registered');
                assert.equal((await second.req(`/enrollments/${newEnrollmentId}/withdraw-request`, 'POST',
                    { reason: 'Em cần rút lớp này do lịch cá nhân.' })).status, 403);
                const requested = await student.req(`/enrollments/${newEnrollmentId}/withdraw-request`, 'POST',
                    { reason: 'Em có lịch học bắt buộc khác trùng vào thời gian này.' });
                assert.equal(requested.status, 200, JSON.stringify(requested.error));
                const again = await student.req(`/enrollments/${newEnrollmentId}/withdraw-request`, 'POST',
                    { reason: 'Em muốn đăng ký một đề nghị khác nữa.' });
                assert.equal(again.data.requestId, requested.data.requestId);
                assert.equal(again.data.existing, true);
                const pendingList = await student.req('/enrollments');
                assert.equal(pendingList.data.items.find(item => item.id === newEnrollmentId).withdrawalStatus, 'submitted');
                assert.equal((await db.get('SELECT status FROM enrollments WHERE enrollment_id=?', [newEnrollmentId])).status, 'registered');
                assert.equal((await student.req(`/enrollments/${newEnrollmentId}/withdraw`, 'POST',
                    { reason: 'Sinh viên không có quyền rút học trực tiếp.' })).status, 403);
                assert.equal((await staff.req(`/enrollments/${newEnrollmentId}/withdraw`, 'POST',
                    { reason: 'Cán bộ xử lý chưa có quyết định.', requestId: requested.data.requestId })).status, 409);
                await db.update('academic_requests', 'request_id', requested.data.requestId, {
                    status: 'approved', processed_by: 2, processed_at: '2026-11-07 10:00:00', response: 'Đã đối chiếu hồ sơ'
                });
                const approved = await staff.req(`/enrollments/${newEnrollmentId}/withdraw`, 'POST',
                    { reason: 'Đã đối chiếu và có quyết định chấp thuận rút học.', requestId: requested.data.requestId });
                assert.equal(approved.status, 200, JSON.stringify(approved.error));
                assert.equal((await db.get('SELECT status FROM enrollments WHERE enrollment_id=?', [newEnrollmentId])).status, 'withdrawn');
                assert.equal((await db.get('SELECT status FROM academic_requests WHERE request_id=?',
                    [requested.data.requestId])).status, 'executed');
                assert.equal((await staff.req(`/enrollments/${newEnrollmentId}/withdraw`, 'POST',
                    { reason: 'Xử lý yêu cầu rút học một lần nữa.' })).status, 409);
                const finishedList = await student.req('/enrollments');
                const finished = finishedList.data.items.find(item => item.id === newEnrollmentId);
                assert.equal(finished.status, 'withdrawn');
                assert.equal(finished.withdrawalStatus, 'executed');
            } finally {
                await db.update('semesters', 'semester_id', row.semester_id, { registration_end: semester.registration_end });
            }
        });
        await t.test('Trùng lịch nhiều buổi chặn đăng ký lại và không ghi đè lịch sử', async () => {
            const first = await db.get(`SELECT sc.* FROM class_schedules sc JOIN enrollments e ON e.class_id=sc.class_id
                WHERE e.student_id=1 AND e.status='studying' ORDER BY sc.schedule_id LIMIT 1`);
            assert.ok(first);
            await db.insert('class_schedules', {
                class_id: 2, room_id: first.room_id, day_of_week: first.day_of_week,
                start_time: first.start_time, end_time: first.end_time,
                start_date: first.start_date, end_date: first.end_date
            });
            const result = await registerAndApprove();
            assert.equal(result.status, 409);
            assert.match(result.error.message, /Trùng lịch/);
            assert.equal((await db.get('SELECT status FROM enrollments WHERE enrollment_id=?', [newEnrollmentId])).status, 'withdrawn');
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});

test('Giao diện sử dụng API lịch và danh sách học phần riêng, không cần snapshot cho trang tương ứng', () => {
    assert.equal(resourceQuery('timetable', { week: 0 }, {}).startsWith('/timetable?start='), true);
    assert.equal(resourceQuery('my-enrollments', {}, {}), '/enrollments');
    assert.throws(() => parseWeekStart('2026-11-07'));
    const demo = { subjects: [], classes: [], schedules: [], exams: [], enrollments: [],
        students: [], term: { name: 'HK I', year: '2026–2027' } };
    const ctx = { db: demo, user: { role: 'student', profileId: '1' }, filters: { week: 0 }, cart: [],
        remoteSchedule: { state: 'ready', data: { items: [
            { type: 'study', date: weekRange().start, start: '07:00', end: '09:00',
                subject: '<script>alert(1)</script>', room: 'A101' } ] } } };
    const page = schedule(ctx);
    assert.ok(page.includes('&lt;script&gt;'));
    assert.ok(!page.includes('<script>'));
    const html = registration({ ...ctx, filters: {}, remoteEnrollments: { state: 'ready', data: { items: [
        { id: '8', classId: '2', subject: 'Cơ sở dữ liệu', classCode: 'IT201', status: 'registered', canCancel: true },
        { id: '9', classId: '3', subject: 'Tin học', classCode: 'IT301', status: 'studying', canCancel: false }
    ] } }, remoteList: { state: 'ready', data: { items: [], pagination: { page: 1, limit: 10, pages: 1, total: 0 } } } });
    assert.match(html, /data-action="cancel-enrollment"/);
    assert.match(html, /data-action="request-withdrawal"/);
});
