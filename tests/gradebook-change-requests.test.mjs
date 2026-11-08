import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { openDatabase } from '../backend/src/config/database.js';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { grades } from '../frontend/src/pages/academic/assessment/gradebook.js';

function client(origin) {
    return { cookie: '', csrf: '',
        async req(path, method='GET', body) {
            const res = await fetch(origin + '/api/v1' + path, { method, headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
            const payload = await res.json();
            if (res.headers.get('set-cookie')) this.cookie = res.headers.get('set-cookie').split(';')[0];
            if (payload.data?.csrf) this.csrf = payload.data.csrf;
            return { status: res.status, ...payload };
        },
        login(username) { return this.req('/auth/login', 'POST', { username, password: 'Hocvu@2026' }); }
    };
}

test('Sổ điểm V06.8: API phân quyền, lưu nháp, đề nghị và duyệt sửa điểm sau công bố', async t => {
    const db = await openDatabase({ driver:'sqlite', file:':memory:' });
    const { server } = await createApp({ db, seed:true });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const lecturer = client(origin), staff = client(origin), student = client(origin), admin = client(origin);
    try {
        for (const [c, name] of [[lecturer,'gv001'],[staff,'cb001'],[student,'20240001'],[admin,'quantri']]) assert.equal((await c.login(name)).status,200,name);
        let book, target, oldTotal, source, oldScore;
        await t.test('Phân quyền lớp, trang giao diện an toàn và đầu điểm thực', async () => {
            book = await lecturer.req('/classes/1/gradebook');
            assert.equal(book.status,200,JSON.stringify(book.error));
            assert.equal(book.data.meta.length,3);
            assert.ok(book.data.items.length>=2);
            assert.equal((await student.req('/classes/1/gradebook')).status,403);
            assert.equal((await admin.req('/classes/1/gradebook')).status,403);
            const different = await db.get('SELECT class_id FROM classes WHERE lecturer_id<>(SELECT lecturer_id FROM lecturers WHERE user_id=3) LIMIT 1');
            if (different) assert.equal((await lecturer.req(`/classes/${different.class_id}/gradebook`)).status,403);
            assert.equal(resourceQuery('gradebook',{classId:'1'},{}),'/classes/1/gradebook');
            assert.equal(resourceQuery('grade-changes',{classId:'1'},{}),'/grade-change-requests?classId=1');
            const state = await lecturer.req('/state');
            const html = grades({ db:state.data, user:state.data.accounts.find(a=>a.role==='lecturer'), parts:['lecturer','grades','1'], filters:{}, remoteGradebook:{state:'ready',data:book.data}, remoteGradeChanges:{state:'ready',data:{items:[]}} });
            assert.match(html,/Sổ điểm học phần/);
            assert.match(html,/Chưa có đề nghị sửa điểm/);
        });
        await t.test('Lưu nháp theo lô: điểm 0 khác null, rollback khi có dòng sai và chặn quyền', async () => {
            const row = book.data.items.find(x=>!x.published && x.process !== null && x.midterm !== null);
            assert.ok(row);
            const payload = {rows:[{enrollmentId:row.id,scores:{process:0,midterm:null}}]};
            assert.equal((await student.req('/classes/1/gradebook','POST',payload)).status,403);
            const result = await lecturer.req('/classes/1/gradebook','POST',payload);
            assert.equal(result.status,200,JSON.stringify(result.error));
            const saved = (await lecturer.req('/classes/1/gradebook')).data.items.find(x=>x.id===row.id);
            assert.equal(saved.process,0);
            assert.equal(saved.midterm,null);
            const bad = await staff.req('/classes/1/gradebook','POST',{rows:[
                {enrollmentId:row.id,scores:{process:5,midterm:6}},
                {enrollmentId:row.id,scores:{process:7,midterm:2}}
            ]});
            assert.equal(bad.status,422);
            const bad2 = await staff.req('/classes/1/gradebook','POST',{rows:[
                {enrollmentId:row.id,scores:{process:5,midterm:6}},
                {enrollmentId:book.data.items.find(x=>x.id!==row.id).id,scores:{process:99,midterm:2}}
            ]});
            assert.equal(bad2.status,422);
            assert.equal((await lecturer.req('/classes/1/gradebook')).data.items.find(x=>x.id===row.id).process,0);
            assert.equal((await lecturer.req('/classes/1/gradebook','POST',{rows:[{enrollmentId:row.id,scores:{process:9,midterm:8}}]})).status,200);
        });
        await t.test('Bộ phát hiện ghi đè điểm từ một phiên cũ trả 409', async () => {
            const row = (await lecturer.req('/classes/1/gradebook')).data.items.find(x => x.process !== null && !x.published);
            const expected = {process: row.process, midterm: row.midterm};
            const actualNext = row.process === 10 ? 9 : row.process + 1;
            assert.equal((await staff.req('/classes/1/gradebook','POST',{rows:[{enrollmentId:row.id,scores:{process:actualNext,midterm:row.midterm},expected}]})).status,200);
            const stale = await lecturer.req('/classes/1/gradebook','POST',{rows:[{enrollmentId:row.id,scores:{process:row.process,midterm:row.midterm},expected}]});
            assert.equal(stale.status,409);
            assert.equal(stale.error.code,'STALE_GRADE');
            assert.equal((await lecturer.req('/classes/1/gradebook')).data.items.find(x=>x.id===row.id).process,actualNext);
        });
        await t.test('Công bố và không cho sửa điểm trực tiếp sau công bố', async () => {
            const current = (await staff.req('/classes/1/gradebook')).data.items;
            target = current.find(x=>x.final!==null && !x.published && x.process !== null && x.midterm !== null);
            assert.ok(target);
            const pub = await staff.req('/enrollments/'+target.id+'/publish','POST',{});
            assert.equal(pub.status,200,JSON.stringify(pub.error));
            oldTotal = pub.data.total;
            const after = (await staff.req('/classes/1/gradebook')).data.items.find(x=>x.id===target.id);
            assert.equal(after.published,true);
            source = after.sources.process;
            oldScore = after.process;
            assert.ok(source.sourceId);
            assert.equal((await lecturer.req('/classes/1/gradebook','POST',{rows:[{enrollmentId:target.id,scores:{process:1,midterm:2}}]})).status,409);
        });
        let requestId;
        await t.test('Đề nghị sau công bố kiểm tra nguồn, thang điểm, trùng và vai trò', async () => {
            const body = {type:'grade',sourceId:source.sourceId,proposedScore:Math.min(10,oldScore+1),reason:'Đối chiếu lại biên bản chấm điểm có chữ ký.'};
            assert.equal((await student.req('/grade-change-requests','POST',body)).status,403);
            assert.equal((await lecturer.req('/grade-change-requests','POST',{...body,proposedScore:99})).status,422);
            assert.equal((await lecturer.req('/grade-change-requests','POST',{...body,reason:'Ngắn'})).status,422);
            const requested = await lecturer.req('/grade-change-requests','POST',body);
            assert.equal(requested.status,201,JSON.stringify(requested.error));
            requestId = requested.data.id;
            assert.equal((await lecturer.req('/grade-change-requests','POST',body)).status,409);
            assert.equal((await staff.req('/grade-change-requests?classId=1&status=submitted')).data.items.some(x=>x.id===requestId),true);
            assert.equal((await student.req('/grade-change-requests')).status,403);
            assert.equal((await admin.req('/grade-change-requests')).status,403);
            assert.equal((await db.get('SELECT score FROM grades WHERE grade_id=?',[source.sourceId])).score,oldScore);
        });
        await t.test('Duyệt đúng quyền, kết quả tính lại và nhật ký truy vết', async () => {
            const path = `/grade-change-requests/${requestId}/review`;
            const approve = {decision:'approve',reason:'Đã đối chiếu bản gốc và xác minh điểm sửa.'};
            assert.equal((await lecturer.req(path,'POST',approve)).status,403);
            const reviewed = await staff.req(path,'POST',approve);
            assert.equal(reviewed.status,200,JSON.stringify(reviewed.error));
            assert.equal(reviewed.data.status,'applied');
            assert.equal((await staff.req(path,'POST',approve)).status,409);
            const after = await db.get('SELECT score FROM grades WHERE grade_id=?',[source.sourceId]);
            assert.equal(Number(after.score),Math.min(10,oldScore+1));
            const result = await db.get('SELECT * FROM course_results WHERE enrollment_id=?',[target.id]);
            assert.notEqual(Number(result.total_score),oldTotal);
            assert.equal(Number(result.is_published),1);
            const component = await db.get('SELECT * FROM result_components WHERE result_id=? AND grade_id=?',[result.result_id,source.sourceId]);
            assert.equal(Number(component.score_snapshot),Number(after.score));
            const events = await db.all("SELECT action FROM audit_logs WHERE entity_name='grade_change_requests' AND entity_id=?",[requestId]);
            assert.ok(events.some(e=>e.action==='REQUEST_GRADE_CHANGE'));
            assert.ok(events.some(e=>e.action==='APPLY_GRADE_CHANGE'));
            assert.equal((await db.get("SELECT COUNT(*) AS n FROM audit_logs WHERE action='RECALCULATE_RESULT' AND entity_id=?",[String(result.result_id)])).n,1);
        });
        await t.test('Không cho cán bộ tự phê duyệt đề nghị do mình gửi; từ chối không thay điểm', async () => {
            const after = (await staff.req('/classes/1/gradebook')).data.items.find(x=>x.id===target.id);
            const midterm = after.sources.midterm;
            assert.ok(midterm?.sourceId);
            const self = await staff.req('/grade-change-requests','POST',{type:'grade',sourceId:midterm.sourceId,proposedScore:after.midterm===0?1:0,reason:'Cần xác minh lại biểu điểm kiểm tra giữa kỳ.'});
            assert.equal(self.status,201);
            assert.equal((await staff.req(`/grade-change-requests/${self.data.id}/review`,'POST',{decision:'approve',reason:'Tự mình xác minh các đầu điểm.'})).status,403);
            const response = await staff.req(`/grade-change-requests/${self.data.id}/review`,'POST',{decision:'reject',reason:'Người lập không được tự ra quyết định.'});
            assert.equal(response.status,403);
            assert.equal((await db.get('SELECT status FROM grade_change_requests WHERE change_request_id=?',[self.data.id])).status,'submitted');
        });
        await t.test('Từ chối giữ nguyên điểm nguồn; tổng kết duyệt chặn áp dụng', async () => {
            const after = (await lecturer.req('/classes/1/gradebook')).data.items.find(x=>x.id===target.id);
            const exam = after.sources.final;
            assert.equal(exam.type,'exam');
            const proposed = after.final >= 9 ? after.final - 1 : after.final + 1;
            const draft = { type:'exam', sourceId:exam.sourceId, proposedScore:proposed, reason:'Đối chiếu bảng ghi chấm thi và chữ ký giám thị.'};
            const first = await lecturer.req('/grade-change-requests','POST',draft);
            assert.equal(first.status,201,JSON.stringify(first.error));
            const oldExamScore = Number((await db.get('SELECT score FROM exam_registrations WHERE exam_registration_id=?',[exam.sourceId])).score);
            const rejected = await staff.req(`/grade-change-requests/${first.data.id}/review`,'POST', {decision:'reject',reason:'Chưa đủ hồ sơ gốc để xác nhận điểm mới.'});
            assert.equal(rejected.status,200,JSON.stringify(rejected.error));
            assert.equal(rejected.data.status,'rejected');
            assert.equal((await db.get('SELECT score FROM exam_registrations WHERE exam_registration_id=?',[exam.sourceId])).score,oldExamScore);
            const next = await lecturer.req('/grade-change-requests','POST',draft);
            assert.equal(next.status,201,JSON.stringify(next.error));
            const resultBefore = await db.get('SELECT * FROM course_results WHERE enrollment_id=?',[target.id]);
            const semester = await db.get('SELECT semester_id FROM classes WHERE class_id=1');
            const sid = await db.insert('semester_summaries', {
                student_id:Number(target.studentId),semester_id:semester.semester_id,policy_id:resultBefore.policy_id,
                attempted_credits:3,earned_credits:3,cumulative_earned_credits:3,failed_credits:0,
                semester_gpa:3,cumulative_gpa:3,calculation_details:JSON.stringify({source:'test'}),
                revision_no:1,status:'approved',approved_by:2,approved_at:'2026-11-01 11:00:00',is_current:1
            });
            const blocked = await staff.req(`/grade-change-requests/${next.data.id}/review`,'POST',{decision:'approve',reason:'Đã đối chiếu nhưng kết quả học kỳ đã chốt.'});
            assert.equal(blocked.status,409,JSON.stringify(blocked.error));
            assert.equal(blocked.error.code,'APPROVED_SUMMARY_EXISTS');
            assert.equal((await db.get('SELECT status FROM grade_change_requests WHERE change_request_id=?',[next.data.id])).status,'submitted');
            assert.equal((await db.get('SELECT score FROM exam_registrations WHERE exam_registration_id=?',[exam.sourceId])).score,oldExamScore);
            assert.equal(Number((await db.get('SELECT total_score FROM course_results WHERE enrollment_id=?',[target.id])).total_score),Number(resultBefore.total_score));
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM semester_summaries WHERE summary_id=?',[sid])).n,1);
        });
    } finally {
        await new Promise(resolve=>server.close(resolve));
        await db.close();
    }
});
