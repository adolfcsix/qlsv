import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { openDatabase } from '../backend/src/config/database.js';

function session(origin) {return {cookie:'',csrf:'',async request(path, method='GET',body) {
    const response=await fetch(origin+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(this.cookie?{Cookie:this.cookie}:{}),...(this.csrf?{'X-CSRF-Token':this.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
    if(data.data?.csrf)this.csrf=data.data.csrf;return {status:response.status,...data};
},login(username){return this.request('/auth/login','POST',{username,password:'Hocvu@2026'});}};}

test('V06.9: tổng kết GPA đúng quy chế demo, giữ phiên bản và cảnh báo có quyết định',async t=>{
    const db=await openDatabase({driver:'sqlite',file:':memory:'});
    const {server}=await createApp({db,seed:true});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const staff=session(origin),student=session(origin),other=session(origin),admin=session(origin),lecturer=session(origin);
    try {
        for(const [c,n] of [[staff,'cb001'],[student,'20240001'],[admin,'quantri'],[lecturer,'gv001']])assert.equal((await c.login(n)).status,200,n);
        const first=await db.get("SELECT student_id FROM students WHERE student_code='20240001'");
        const studentId=first.student_id;
        const term=(await db.get("SELECT semester_id FROM semesters WHERE name='HK II' ORDER BY semester_id LIMIT 1")).semester_id;
        const newTerm=(await db.get("SELECT semester_id FROM semesters WHERE name='HK I' ORDER BY semester_id LIMIT 1")).semester_id;
        const query=`?studentId=${studentId}&semesterId=${term}`;
        let draft;
        await t.test('Phân quyền và không tổng kết khi còn kết quả chưa công bố',async()=>{
            assert.equal((await staff.request('/academic-semesters')).status,200);
            assert.equal((await admin.request('/academic-semesters')).status,403);
            assert.equal((await lecturer.request('/semester-summaries/preview'+query)).status,403);
            assert.equal((await student.request('/semester-summaries/preview?studentId=2&semesterId='+term)).status,403);
            const incomplete=await staff.request(`/semester-summaries/preview?studentId=${studentId}&semesterId=${newTerm}`);
            assert.equal(incomplete.status,409);
            assert.equal(incomplete.error.code,'INCOMPLETE_RESULTS');
        });
        await t.test('Lần học và tín chỉ không bị cộng trùng; điểm 1.00 thất bại vẫn tính vào GPA demo',async()=>{
            const r=await staff.request('/semester-summaries/preview'+query);
            assert.equal(r.status,200,JSON.stringify(r.error));
            assert.equal(r.data.policyCode,'DEMO-01');assert.equal(r.data.demo,true);
            assert.equal(r.data.attemptedCredits,10);
            assert.equal(r.data.earnedCredits,7);
            assert.equal(r.data.cumulativeEarnedCredits,7);
            assert.equal(r.data.failedCredits,3);
            assert.equal(r.data.semesterGpa,2.45);
            assert.equal(r.data.cumulativeGpa,2.45);
            assert.equal((await student.request('/semester-summaries/preview'+query)).status,403);
            assert.equal((await student.request('/semester-summaries','POST',{studentId,semesterId:term})).status,403);
            const saved=await staff.request('/semester-summaries','POST',{studentId,semesterId:term});
            assert.equal(saved.status,201,JSON.stringify(saved.error));draft=saved.data.id;
            assert.equal((await student.request('/semester-summaries?studentId='+studentId)).data.length,0);
        });
        await t.test('Ghi đè điểm nguồn sau lúc lập nháp phải làm bản nháp cũ hết hiệu lực',async()=>{
            const r=await db.get('SELECT result_id,grade_point FROM course_results WHERE enrollment_id IN (SELECT enrollment_id FROM enrollments WHERE student_id=?) LIMIT 1',[studentId]);
            await db.run('UPDATE course_results SET grade_point=? WHERE result_id=?',[Number(r.grade_point)+0.5,r.result_id]);
            const denied=await staff.request(`/semester-summaries/${draft}/approve`,'POST',{});
            assert.equal(denied.status,409);assert.equal(denied.error.code,'STALE_SUMMARY');
            assert.equal((await db.get('SELECT status FROM semester_summaries WHERE summary_id=?',[draft])).status,'draft');
            await db.run('UPDATE course_results SET grade_point=? WHERE result_id=?',[r.grade_point,r.result_id]);
        });
        await t.test('Duyệt và thay phiên bản tổng kết trong một giao dịch, không mất lịch sử',async()=>{
            assert.equal((await admin.request(`/semester-summaries/${draft}/approve`,'POST',{})).status,403);
            const approved=await staff.request(`/semester-summaries/${draft}/approve`,'POST',{});
            assert.equal(approved.status,200,JSON.stringify(approved.error));
            assert.equal((await staff.request(`/semester-summaries/${draft}/approve`,'POST',{})).status,409);
            assert.equal((await student.request('/semester-summaries?studentId='+studentId)).data.length,1);
            const second=(await staff.request('/semester-summaries','POST',{studentId,semesterId:term})).data;
            assert.equal(second.revision,2);
            assert.equal((await staff.request(`/semester-summaries/${second.id}/approve`,'POST',{})).status,200);
            const all=(await staff.request('/semester-summaries?studentId='+studentId)).data;
            assert.equal(all.length,2); // previous approved and new approved
            assert.equal(all.filter(x=>x.isCurrent).length,1);
            assert.equal(all.find(x=>x.isCurrent).revision,2);
            assert.equal((await student.request('/semester-summaries?studentId='+studentId)).data.length,1);
            draft=second.id;
        });
        await t.test('Dự thảo cảnh báo, duyệt có số quyết định, thu hồi giữ lịch sử',async()=>{
            assert.equal((await student.request('/academic-warnings','POST',{summaryId:draft})).status,403);
            const proposed=await staff.request('/academic-warnings','POST',{summaryId:draft});
            assert.equal(proposed.status,201,JSON.stringify(proposed.error));
            assert.match(proposed.data.reason,/GPA/);
            assert.equal((await staff.request('/academic-warnings','POST',{summaryId:draft})).status,409);
            const warningId=proposed.data.id;
            assert.equal((await student.request('/academic-warnings?studentId='+studentId)).data.length,0);
            assert.equal((await student.request(`/academic-warnings/${warningId}/approve`,'POST',{decisionNumber:'QD-01'})).status,403);
            assert.equal((await staff.request(`/academic-warnings/${warningId}/approve`,'POST',{decisionNumber:'a'})).status,422);
            assert.equal((await staff.request(`/academic-warnings/${warningId}/approve`,'POST',{decisionNumber:'QD-01'})).status,200);
            assert.equal((await student.request('/academic-warnings?studentId='+studentId)).data.length,1);
            const otherDraft=(await staff.request('/semester-summaries','POST',{studentId,semesterId:term})).data;
            assert.equal((await staff.request(`/semester-summaries/${otherDraft.id}/approve`,'POST',{})).status,409);
            assert.equal((await staff.request(`/academic-warnings/${warningId}/revoke`,'POST',{reason:'Xác minh lại quyết định học vụ đã có sai sót.'})).status,200);
            assert.equal((await student.request('/academic-warnings?studentId='+studentId)).data.length,0);
            assert.equal((await staff.request(`/semester-summaries/${otherDraft.id}/approve`,'POST',{})).status,200);
            assert.equal((await db.get('SELECT status,revoke_reason FROM academic_warnings WHERE warning_id=?',[warningId])).status,'revoked');
        });
        await t.test('Không có summaryRules thì không tự đặt quy chế GPA',async()=>{
            const p=await db.get("SELECT policy_id,rules FROM academic_policies WHERE code='DEMO-01'");
            const rules=JSON.parse(p.rules);delete rules.summaryRules;
            await db.update('academic_policies','policy_id',p.policy_id,{rules:JSON.stringify(rules)});
            const response=await staff.request('/semester-summaries/preview'+query);
            assert.equal(response.status,409);assert.equal(response.error.code,'SUMMARY_POLICY_MISSING');
            await db.update('academic_policies','policy_id',p.policy_id,{rules:p.rules});
        });
        await t.test('Học lại đạt và học cải thiện không cộng trùng tín chỉ; điểm tích lũy chọn đúng lần',async()=>{
            // Keep published history intact, cancel unfinished demo registrations so they cannot become implicit zeroes.
            await db.run("UPDATE enrollments SET status='cancelled' WHERE student_id=? AND status NOT IN ('completed','cancelled','withdrawn')",[studentId]);
            const meta=await db.get('SELECT c.subject_id,c.lecturer_id,su.credits,e.enrollment_id,e.created_by FROM enrollments e JOIN classes c ON c.class_id=e.class_id JOIN subjects su ON su.subject_id=c.subject_id WHERE e.student_id=? AND su.subject_code=? ORDER BY e.enrollment_id LIMIT 1',[studentId,'IT301']);
            const improve=await db.get('SELECT c.subject_id,c.lecturer_id,su.credits,e.enrollment_id FROM enrollments e JOIN classes c ON c.class_id=e.class_id JOIN subjects su ON su.subject_id=c.subject_id WHERE e.student_id=? AND su.subject_code=? ORDER BY e.enrollment_id LIMIT 1',[studentId,'IT202']);
            for(const [label,source,type,gpa] of [['REPEAT',meta,'repeat',4],['IMPROVE',improve,'improve',3]]){
                const classId=await db.insert('classes',{class_code:'V069-'+label,subject_id:source.subject_id,lecturer_id:source.lecturer_id,semester_id:newTerm,capacity:20,status:'completed'});
                const enrollmentId=await db.insert('enrollments',{student_id:studentId,class_id:classId,previous_enrollment_id:source.enrollment_id,enrollment_type:type,status:'completed',created_by:meta.created_by});
                const policyId=(await db.get('SELECT policy_id FROM academic_policies LIMIT 1')).policy_id;
                await db.insert('course_results',{enrollment_id:enrollmentId,policy_id:policyId,credits_snapshot:source.credits,total_score:gpa===4?9:7,grade_point:gpa,letter_grade:gpa===4?'A':'B',outcome:'passed',is_published:1,finalized_by:meta.created_by,finalized_at:'2026-12-01 00:00:00'});
            }
            const current=await staff.request(`/semester-summaries/preview?studentId=${studentId}&semesterId=${newTerm}`);
            assert.equal(current.status,200,JSON.stringify(current.error));
            assert.equal(current.data.attemptedCredits,6);
            assert.equal(current.data.earnedCredits,3); // Only IT301 first pass is newly recognized.
            assert.equal(current.data.cumulativeEarnedCredits,10); // Old 7 + new 3, improvement adds zero.
            assert.equal(current.data.semesterGpa,3.5);
            assert.equal(current.data.cumulativeGpa,3.35); // IT202 keeps previously recognized pass 3.5 GPA.
            const history=await staff.request('/semester-summaries/preview'+query);
            assert.equal(history.data.cumulativeGpa,2.45); // Never backfill later retakes into old semester.
        });
        await t.test('Không tính học phần ngoài chương trình khi chưa có quyết định công nhận tương đương',async()=>{
            const otherSubject=await db.insert('subjects',{subject_code:'OTHER-069',name:'Học phần cần công nhận',department_id:1,credits:3,status:'active'});
            const newClass=await db.insert('classes',{class_code:'OTHER-069-01',subject_id:otherSubject,lecturer_id:1,semester_id:newTerm,capacity:30,status:'completed'});
            const staffId=(await db.get("SELECT user_id FROM users WHERE username='cb001'")).user_id;
            const enroll=await db.insert('enrollments',{student_id:studentId,class_id:newClass,previous_enrollment_id:null,enrollment_type:'first',status:'completed',created_by:staffId});
            await db.insert('course_results',{enrollment_id:enroll,policy_id:1,credits_snapshot:3,total_score:8,grade_point:3.5,letter_grade:'B+',outcome:'passed',is_published:1,finalized_by:staffId,finalized_at:'2026-12-01 00:00:00'});
            const rejected=await staff.request(`/semester-summaries/preview?studentId=${studentId}&semesterId=${newTerm}`);
            assert.equal(rejected.status,409);assert.equal(rejected.error.code,'TRANSFER_REVIEW_REQUIRED');
        });
        await t.test('Audit lưu quyết định, không có bản ghi bị xóa',async()=>{
            const rows=await db.all("SELECT action FROM audit_logs WHERE action IN ('DRAFT_SEMESTER','APPROVE_SEMESTER','DRAFT_WARNING','APPROVE_WARNING','REVOKE_WARNING')");
            for(const action of ['DRAFT_SEMESTER','APPROVE_SEMESTER','DRAFT_WARNING','APPROVE_WARNING','REVOKE_WARNING'])
                assert.ok(rows.some(r=>r.action===action),action);
        });
    } finally { await new Promise(resolve=>server.close(resolve));await db.close(); }
});
