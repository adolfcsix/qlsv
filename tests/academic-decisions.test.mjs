import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { createApp } from '../backend/src/app.js';

const apiClient = base => ({
    cookie:'', csrf:'',
    async call(path, method='GET', body) {
        const response = await fetch(`${base}/api/v1${path}`, { method,
            headers:{'Content-Type':'application/json',...(this.cookie?{Cookie:this.cookie}:{}),
                ...(this.csrf?{'X-CSRF-Token':this.csrf}:{})},
            body:body===undefined?undefined:JSON.stringify(body) });
        const cookie = response.headers.get('set-cookie');
        if(cookie) this.cookie=cookie.split(';')[0];
        const result=await response.json();
        if(result.data?.csrf) this.csrf=result.data.csrf;
        return { status:response.status, ...result };
    },
    async login(username) { const response=await this.call('/auth/login','POST',{username,password:'Hocvu@2026'});assert.equal(response.status,200,response.error?.message); },
    async revision() { const r=await this.call('/state');assert.equal(r.status,200);return r.data.revision; },
    async post(path, data={}) {return this.call(path,'POST',{revision:await this.revision(),...data});}
});

test('V06.11: migration, phiên bản CTĐT, công nhận tương đương và hồ sơ xét tốt nghiệp', async t => {
    const db=await openDatabase({driver:'sqlite',file:':memory:'});
    const {server}=await createApp({db,seed:true});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const staff=apiClient(base),student=apiClient(base),admin=apiClient(base);
    try {
        await Promise.all([staff.login('cb001'),student.login('20240001'),admin.login('quantri')]);
        await db.initialize(); // Migration must not duplicate tables on subsequent startup.
        const source=(await db.get('SELECT * FROM curricula ORDER BY curriculum_id LIMIT 1'));
        let version;
        await t.test('Tạo bản mới sao chép nội dung, bản gốc không đổi; duyệt khóa chỉnh sửa',async()=>{
            const before=await staff.call('/curriculum-plan?curriculumId='+source.curriculum_id);
            const originalCount=(await db.get('SELECT COUNT(*) AS n FROM student_groups WHERE curriculum_id=?',[source.curriculum_id])).n;
            assert.equal((await student.post('/curriculum-versions',{sourceCurriculumId:source.curriculum_id,code:'NOPE',name:'NOPE',note:'NOPE'})).status,403);
            const cloned=await staff.post('/curriculum-versions',{sourceCurriculumId:source.curriculum_id,
                code:'V0611-VERSION-2',name:'Phiên bản theo chính sách mới',note:'Giữ chương trình cũ và thử nghiệm phiên bản mới'});
            assert.equal(cloned.status,201,JSON.stringify(cloned.error));version=cloned.data;
            const after=await staff.call('/curriculum-plan?curriculumId='+version.targetCurriculumId);
            assert.equal(after.status,200);
            assert.equal(after.data.subjects.length,before.data.subjects.length);
            assert.equal(after.data.electiveGroups.length,before.data.electiveGroups.length);
            const groupBefore=before.data.electiveGroups[0],groupAfter=after.data.electiveGroups[0];
            if (groupBefore) assert.notEqual(groupBefore.id,groupAfter.id,'groups must be copied, not reused');
            assert.equal((await staff.call('/curriculum-versions?curriculumId='+source.curriculum_id)).data.length,1);
            assert.equal((await staff.post('/curriculum-versions',{sourceCurriculumId:source.curriculum_id,
                code:'ANOTHER',name:'another',note:'conflicting draft'})).status,409);
            const approved=await staff.post(`/curriculum-versions/${version.id}/approve`);
            assert.equal(approved.status,200,JSON.stringify(approved.error));
            assert.equal((await staff.call('/curriculum-plan?curriculumId='+version.targetCurriculumId)).data.editable,false);
            assert.equal((await staff.post('/curriculum-subjects',{curriculumId:version.targetCurriculumId,
                subjectId:source.subject_id||1,requirementType:'required'})).status,409);
            assert.equal((await staff.post(`/curriculum-versions/${version.id}/approve`)).status,409);
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM student_groups WHERE curriculum_id=?',[source.curriculum_id])).n,originalCount);
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM student_groups WHERE curriculum_id=?',[version.targetCurriculumId])).n,0);
            const programBefore=(await staff.call('/state')).data.programs.find(p=>Number(p.id)===source.curriculum_id);
            assert.equal((await staff.call('/programs/'+source.curriculum_id,'PATCH',{revision:await staff.revision(),
                before:programBefore,after:{...programBefore,name:'Sửa nguồn khi đã có phiên bản'}})).status,409);
        });
        const actor=(await db.get("SELECT user_id FROM users WHERE username='cb001'")).user_id;
        const policy=source.policy_id;
        const targetSubject=await db.insert('subjects',{subject_code:'V0611-TARGET',name:'Môn đích',department_id:1,credits:3,status:'active'});
        const sourceSubject=await db.insert('subjects',{subject_code:'V0611-SOURCE',name:'Môn nguồn',department_id:1,credits:3,status:'active'});
        const program=await db.insert('curricula',{code:'V0611-REVIEW',name:'CTĐT xét tốt nghiệp',major_id:source.major_id,
            policy_id:policy,admission_year:2032,required_credits:3});
        const assignment=await db.insert('curriculum_subjects',{curriculum_id:program,subject_id:targetSubject,
            requirement_type:'required',recommended_semester:1,elective_group_id:null});
        const group=await db.insert('student_groups',{group_code:'V0611-GROUP',name:'Lớp xét',curriculum_id:program});
        const profile=await db.insert('students',{student_code:'V0611-STUDENT',full_name:'Sinh viên xét',
            student_group_id:group,admission_date:'2032-09-01',status:'studying'});
        const semester=(await db.get('SELECT semester_id FROM semesters LIMIT 1')).semester_id;
        const section=await db.insert('classes',{class_code:'V0611-SECTION',subject_id:sourceSubject,
            semester_id:semester,capacity:12,status:'completed'});
        const enrollment=await db.insert('enrollments',{student_id:profile,class_id:section,
            status:'completed',enrollment_type:'first',created_by:actor});
        const resultId=await db.insert('course_results',{enrollment_id:enrollment,policy_id:policy,
            credits_snapshot:3,total_score:8,grade_point:3,letter_grade:'B',outcome:'passed',
            is_published:1,finalized_by:actor,finalized_at:'2032-10-15 10:00:00'});
        let recognition;
        await t.test('Quyết định tương đương có nguồn, chống dùng lại một kết quả, có thu hồi',async()=>{
            assert.equal((await staff.call('/curriculum-progress?studentId='+profile)).data.earnedCredits,0);
            assert.equal((await student.call('/credit-recognitions/candidates?studentId='+profile)).status,403);
            assert.equal((await admin.call('/credit-recognitions?studentId='+profile)).status,403);
            const candidates=await staff.call('/credit-recognitions/candidates?studentId='+profile);
            assert.ok(candidates.data.targets.some(item=>item.id===assignment));
            assert.ok(candidates.data.sources.some(item=>item.id===resultId));
            const approved=await staff.post('/credit-recognitions', {studentId:profile,targetAssignmentId:assignment,
                sourceResultId:resultId,decisionNumber:'CN-2026-01',decisionDate:'2026-11-08',
                explanation:'Công nhận theo đối chiếu đề cương và số tín chỉ'});
            assert.equal(approved.status,201,JSON.stringify(approved.error));recognition=approved.data;
            assert.equal((await staff.post('/credit-recognitions',{studentId:profile,targetAssignmentId:assignment,
                sourceResultId:resultId,decisionNumber:'CN-2026-02',decisionDate:'2026-11-08',explanation:'Trùng nguồn'})).status,409);
            const status=(await staff.call('/curriculum-progress?studentId='+profile)).data;
            assert.equal(status.earnedCredits,3);
            assert.equal(status.subjects[0].recognitionId,recognition.id);
            assert.equal(status.readyForManualReview,true);
            const revoked=await staff.post(`/credit-recognitions/${recognition.id}/revoke`,{reason:'Phát hiện hồ sơ tương đương cần đánh giá lại'});
            assert.equal(revoked.status,200);
            assert.equal((await staff.call('/curriculum-progress?studentId='+profile)).data.earnedCredits,0);
            const reapproved=await staff.post('/credit-recognitions',{studentId:profile,targetAssignmentId:assignment,
                sourceResultId:resultId,decisionNumber:'CN-2026-03',decisionDate:'2026-11-08',
                explanation:'Hội đồng đã đối chiếu và duyệt lại'});
            assert.equal(reapproved.status,201,JSON.stringify(reapproved.error));recognition=reapproved.data;
            const records=(await staff.call('/credit-recognitions?studentId='+profile)).data.records;
            assert.equal(records.filter(r=>!r.revokedAt).length,1);
            assert.equal(records.filter(r=>r.revokedAt).length,1);
        });
        let review;
        await t.test('Xét tốt nghiệp: bản nháp, bằng chứng ngoài hệ thống, từ chối tự động đổi trạng thái',async()=>{
            const created=await staff.post('/graduation-reviews',{studentId:profile,note:'Đối chiếu toàn bộ học phần và điều kiện bổ sung'});
            assert.equal(created.status,201,JSON.stringify(created.error)); review=created.data;
            assert.equal((await student.call('/graduation-reviews?studentId='+profile)).data.records.length,0);
            assert.equal((await student.post(`/graduation-reviews/${review.id}/approve`,{})).status,403);
            assert.equal((await staff.post('/graduation-reviews',{studentId:profile,note:'Bản nháp thứ hai'})).status,409);
            const invalid=await staff.post(`/graduation-reviews/${review.id}/approve`, {
                note:'Cần xác nhận đầy đủ',externalChecks:{conduct:true,discipline:true},evidence:'Đối chiếu tại trường',decisionNumber:'XN-2026-1'});
            assert.equal(invalid.status,422);
            // An approved result may be withdrawn before the review is signed.
            await db.run('UPDATE course_results SET is_published=0 WHERE result_id=?',[resultId]);
            assert.equal((await staff.post(`/graduation-reviews/${review.id}/approve`,{
                note:'Kiểm tra lại',externalChecks:{conduct:true,discipline:true,certificates:true,otherRequirements:true},
                evidence:'Chứng từ hiện tại',decisionNumber:'XN-2026-TEMP'})).status,409);
            await db.run('UPDATE course_results SET is_published=1 WHERE result_id=?',[resultId]);
            const validChecks={conduct:true,discipline:true,certificates:true,otherRequirements:true};
            const noSummary=await staff.post(`/graduation-reviews/${review.id}/approve`, {
                note:'Đã rà theo hồ sơ',externalChecks:validChecks,evidence:'Bộ chứng từ ký xác nhận',decisionNumber:'XN-2026-1'});
            assert.equal(noSummary.status,409,'Approved semester summary is required');
            await db.insert('semester_summaries',{student_id:profile,semester_id:semester,policy_id:policy,
                attempted_credits:3,earned_credits:3,cumulative_earned_credits:3,failed_credits:0,
                semester_gpa:3,cumulative_gpa:3,calculation_details:JSON.stringify({source:'V06.11 unit test'}),
                revision_no:1,status:'approved',approved_by:actor,approved_at:'2032-10-15 10:00:00',is_current:1});
            const accepted=await staff.post(`/graduation-reviews/${review.id}/approve`,{
                note:'Đã rà soát các điều kiện khác theo văn bản',externalChecks:validChecks,
                evidence:'Hồ sơ rèn luyện, kỷ luật, chứng chỉ được cán bộ đối chiếu',decisionNumber:'XN-2026-1'});
            assert.equal(accepted.status,200,JSON.stringify(accepted.error));
            assert.equal((await db.get('SELECT status FROM students WHERE student_id=?',[profile])).status,'studying');
            assert.equal((await db.get('SELECT decision_type FROM student_decisions WHERE decision_id=?',[accepted.data.decisionId])).decision_type,'graduation_review');
            const studentView=await staff.call('/graduation-reviews?studentId='+profile);
            assert.equal(studentView.data.records[0].status,'approved');
            const userTemplate=await db.get("SELECT u.password_hash,r.role_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.username='20240001'");
            const profileUser=await db.insert('users',{username:'v0611-student',email:'v0611@student.test',
                password_hash:userTemplate.password_hash,role_id:userTemplate.role_id,status:'active'});
            await db.update('students','student_id',profile,{user_id:profileUser});
            const own=apiClient(base);await own.login('v0611-student');
            const ownReview=await own.call('/graduation-reviews?studentId=999999');
            assert.equal(ownReview.status,200);
            assert.equal(ownReview.data.records.length,1);
            assert.equal((await own.call('/credit-recognitions?studentId=999999')).data.records.length,2);
            assert.equal((await student.call('/graduation-reviews?studentId='+profile)).data.records.length,0);
            assert.equal((await staff.post(`/credit-recognitions/${recognition.id}/revoke`,{reason:'Sửa sau khi duyệt'})).status,409);
            assert.equal((await staff.post(`/graduation-reviews/${review.id}/approve`,{
                note:'Đã duyệt',externalChecks:validChecks,evidence:'Như trên',decisionNumber:'XN-2026-2'})).status,409);
        });
        await t.test('Audit và migration an toàn khi khởi động lại',async()=>{
            const actions=await db.all("SELECT action FROM audit_logs WHERE action IN ('CLONE_CURRICULUM','APPROVE_CURRICULUM_VERSION','APPROVE_EQUIVALENCY','REVOKE_EQUIVALENCY','DRAFT_GRADUATION_REVIEW','APPROVE_GRADUATION_REVIEW')");
            assert.ok(actions.length>=6);
            await db.initialize();
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM graduation_reviews WHERE review_id=?',[review.id])).n,1);
        });
    } finally { await new Promise(resolve=>server.close(resolve));await db.close(); }
});
