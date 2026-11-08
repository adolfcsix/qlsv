import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { createApp } from '../backend/src/app.js';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { navigation } from '../frontend/src/app/navigation.js';
import { onlinePlan } from '../frontend/src/features/curriculum/progress-panel.js';

function client(base) {
    return {
        cookie: '', csrf: '',
        async call(route, method = 'GET', body) {
            const response = await fetch(base + '/api/v1' + route, {
                method, headers: {'Content-Type':'application/json',
                    ...(this.cookie ? {Cookie:this.cookie} : {}),
                    ...(this.csrf ? {'X-CSRF-Token':this.csrf} : {})},
                body:body === undefined ? undefined : JSON.stringify(body)
            });
            if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
            const json = await response.json();
            if (json.data?.csrf) this.csrf = json.data.csrf;
            return { status:response.status, ...json };
        },
        async login(user) {const response = await this.call('/auth/login','POST',{username:user,password:'Hocvu@2026'});assert.equal(response.status,200,response.error?.message);},
        async revision() { const response = await this.call('/state'); assert.equal(response.status,200);return response.data.revision; }
    };
}

test('V06.10: cấu trúc chương trình, tự chọn, tiên quyết, tiến độ và bảo toàn lịch sử', async t => {
    const db = await openDatabase({driver:'sqlite',file:':memory:'});
    const {server} = await createApp({db,seed:true});
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const staff = client(base), student = client(base), admin = client(base), lecturer = client(base);
    try {
        await Promise.all([staff.login('cb001'),student.login('20240001'),admin.login('quantri'),lecturer.login('gv001')]);
        const originalStudent = await db.get("SELECT s.student_id, g.curriculum_id FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id WHERE s.student_code='20240001'");
        await t.test('Phân quyền: chỉ đọc chương trình của mình, không xem tiến độ người khác',async()=>{
            const plan = await staff.call('/curriculum-plan?curriculumId='+originalStudent.curriculum_id);
            assert.equal(plan.status,200);
            assert.ok(plan.data.subjects.length >= 1);
            assert.equal(plan.data.editable,false,'Published results lock the program');
            assert.equal((await student.call('/curriculum-plan?curriculumId='+originalStudent.curriculum_id)).status,200);
            assert.equal((await student.call('/curriculum-plan?curriculumId=999999')).status,403);
            assert.equal((await lecturer.call('/curriculum-plan?curriculumId='+originalStudent.curriculum_id)).status,403);
            assert.equal((await admin.call('/curriculum-plan?curriculumId='+originalStudent.curriculum_id)).status,403);
            assert.equal((await student.call('/curriculum-progress?studentId=999999')).data.student.id,originalStudent.student_id,
                'A student cannot override identity through query parameters');
            assert.equal((await admin.call('/curriculum-progress?studentId='+originalStudent.student_id)).status,403);
            assert.equal((await staff.call('/curriculum-progress?studentId=bad')).status,422);
        });
        const originalProgram = await db.get('SELECT * FROM curricula WHERE curriculum_id=?',[originalStudent.curriculum_id]);
        const newProgram = await db.insert('curricula',{
            code:'DEMO-NEW-V0610',name:'Chương trình mới kiểm thử có phiên bản',
            major_id:originalProgram.major_id,policy_id:originalProgram.policy_id,
            admission_year:2030,required_credits:7
        });
        const newSubjects = [];
        for(const [code,credits] of [['TEST-A',3],['TEST-B',2],['TEST-C',2]]) {
            newSubjects.push(await db.insert('subjects',{
                subject_code:code,name:'Môn '+code,department_id:1,credits,status:'active'}));
        }
        const post = async (route, body) => staff.call(route,'POST',{revision:await staff.revision(),...body});
        const patch = async (route, body) => staff.call(route,'PATCH',{revision:await staff.revision(),...body});
        const del = async (route, body={}) => staff.call(route,'DELETE',{revision:await staff.revision(),...body});
        let group, coreAssignment, electiveAssignment;
        await t.test('Quản lý nhóm tự chọn và môn bắt buộc có phân quyền, FK và audit',async()=>{
            assert.equal((await student.call('/elective-groups','POST',{revision:await staff.revision(),curriculumId:newProgram,code:'C',name:'Nhóm',minimumCredits:4})).status,403);
            const res = await post('/elective-groups',{curriculumId:newProgram,code:'TC-1',name:'Nhóm tự chọn',minimumCredits:4});
            assert.equal(res.status,201,JSON.stringify(res.error));group=res.data.id;
            let edit = await post('/curriculum-subjects',{curriculumId:newProgram,subjectId:newSubjects[0],requirementType:'required',recommendedSemester:1,electiveGroupId:null});
            assert.equal(edit.status,201,JSON.stringify(edit.error));coreAssignment=edit.data.id;
            edit = await post('/curriculum-subjects',{curriculumId:newProgram,subjectId:newSubjects[1],requirementType:'elective',recommendedSemester:2,electiveGroupId:group});
            assert.equal(edit.status,201,JSON.stringify(edit.error));electiveAssignment=edit.data.id;
            const otherProgram=await db.insert('curricula',{code:'V0610-OTHER',name:'Chương trình khác',major_id:originalProgram.major_id,policy_id:originalProgram.policy_id,admission_year:2031,required_credits:8});
            assert.equal((await post('/curriculum-subjects',{curriculumId:otherProgram,subjectId:newSubjects[2],requirementType:'elective',electiveGroupId:group})).status,422,'Cannot attach elective group from another curriculum');
            assert.equal((await post('/curriculum-subjects',{curriculumId:newProgram,subjectId:newSubjects[1],requirementType:'elective',electiveGroupId:group})).status,409,'Must not duplicate a subject in a program');
            assert.equal((await del('/elective-groups/'+group)).status,409,'Referenced elective group must not be deleted');
            assert.equal((await patch('/curriculum-subjects/'+electiveAssignment,{requirementType:'elective',electiveGroupId:group,recommendedSemester:3})).status,200);
            assert.equal((await patch('/elective-groups/'+group,{code:'TC-1',name:'Nhóm tự chọn sửa',minimumCredits:4})).status,200);
            const data=await staff.call('/curriculum-plan?curriculumId='+newProgram);
            assert.equal(data.data.electiveGroups[0].name,'Nhóm tự chọn sửa');
            assert.equal(data.data.subjects.find(s=>Number(s.id)===electiveAssignment).recommendedSemester,3);
            assert.equal(data.data.editable,true);
        });
        await t.test('Vòng phụ thuộc gián tiếp bị chặn; gỡ quan hệ có nhật ký',async()=>{
            const insert = (a,b) => post('/subject-prerequisites',{subjectId:newSubjects[a],prerequisiteSubjectId:newSubjects[b]});
            assert.equal((await insert(0,1)).status,201);
            assert.equal((await insert(1,2)).status,201);
            const cycle = await insert(2,0);
            assert.equal(cycle.status,409);
            assert.equal(cycle.error.code,'PREREQUISITE_CYCLE');
            assert.equal((await insert(0,0)).status,422);
            assert.equal((await insert(0,1)).status,409);
            assert.equal((await del('/subject-prerequisites',{subjectId:newSubjects[0],prerequisiteSubjectId:newSubjects[1]})).status,200);
            assert.equal((await insert(0,1)).status,201);
            const count = await db.get('SELECT COUNT(*) AS count FROM subject_prerequisites WHERE subject_id=?',[newSubjects[2]]);
            assert.equal(count.count,0,'Failed cycle must not leave a row');
        });
        await t.test('Cập nhật cũ bị từ chối, không tồn đọng bản sao CRUD',async()=>{
            const stale=await staff.revision();
            assert.equal((await staff.call('/elective-groups/'+group,'PATCH',{revision:stale-1,code:'X',name:'X',minimumCredits:1})).status,409);
            assert.equal((await staff.call('/curriculum-subjects/'+coreAssignment,'PATCH',{revision:stale,requirementType:'elective',electiveGroupId:null})).status,422);
            assert.equal((await post('/curriculum-subjects',{curriculumId:newProgram,subjectId:newSubjects[2],requirementType:'elective',electiveGroupId:group,recommendedSemester:2})).status,201);
            const audit=await db.get("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_name IN ('elective_groups','curriculum_subjects','subject_prerequisites')");
            assert.ok(audit.n>=6);
        });
        let newStudent;
        await t.test('Tiến độ: bắt buộc + tự chọn, không cộng tín chỉ học lại, không tự duyệt tốt nghiệp',async()=>{
            const groupId=await db.insert('student_groups',{group_code:'V0610-NEWGROUP',name:'Lớp thử',curriculum_id:newProgram});
            newStudent=await db.insert('students',{student_code:'V0610-STU',full_name:'Sinh viên thử',admission_date:'2030-09-01',student_group_id:groupId,status:'studying'});
            const before=await staff.call('/curriculum-progress?studentId='+newStudent);
            assert.equal(before.status,200);
            assert.equal(before.data.requiredOutstanding,1);
            assert.equal(before.data.unmetElectives,1);
            assert.equal(before.data.readyForManualReview,false);
            const semester=(await db.get('SELECT semester_id FROM semesters LIMIT 1')).semester_id;
            const actor=(await db.get("SELECT user_id FROM users WHERE username='cb001'")).user_id;
            async function publish(subjectId, code, credits) {
                const classId=await db.insert('classes',{class_code:code,subject_id:subjectId,semester_id:semester,capacity:20,status:'completed'});
                const enrollmentId=await db.insert('enrollments',{student_id:newStudent,class_id:classId,enrollment_type:'first',status:'completed',created_by:actor});
                await db.insert('course_results',{enrollment_id:enrollmentId,policy_id:originalProgram.policy_id,credits_snapshot:credits,total_score:8,grade_point:3.5,letter_grade:'B+',outcome:'passed',is_published:1,finalized_by:actor,finalized_at:'2031-01-05 10:00:00'});
            }
            await publish(newSubjects[0],'V0610-CLS-A',3);
            await publish(newSubjects[1],'V0610-CLS-B',2);
            const partial=(await staff.call('/curriculum-progress?studentId='+newStudent)).data;
            assert.equal(partial.earnedCredits,5);
            assert.equal(partial.electiveGroups[0].remainingCredits,2);
            assert.equal(partial.readyForManualReview,false);
            await publish(newSubjects[2],'V0610-CLS-C',2);
            const complete=(await staff.call('/curriculum-progress?studentId='+newStudent)).data;
            assert.equal(complete.earnedCredits,7);
            assert.equal(complete.requiredOutstanding,0);
            assert.equal(complete.unmetElectives,0);
            assert.equal(complete.readyForManualReview,true);
            assert.match(complete.note,/không phải quyết định tốt nghiệp/);
            await publish(newSubjects[1],'V0610-CLS-B-REPEAT',2);
            const repeat=(await staff.call('/curriculum-progress?studentId='+newStudent)).data;
            assert.equal(repeat.earnedCredits,7,'One elective counted once regardless of repeat');
            assert.equal((await staff.call('/curriculum-plan?curriculumId='+newProgram)).data.editable,false);
            assert.equal((await post('/curriculum-subjects',{curriculumId:newProgram,subjectId:newSubjects[0],requirementType:'required'})).status,409,'Version required after published outcomes');
            assert.equal((await del('/elective-groups/'+group)).status,409,'Historical program cannot be edited');
            assert.equal((await post('/subject-prerequisites',{subjectId:newSubjects[1],prerequisiteSubjectId:newSubjects[0]})).status,409,'Existing enrollment protects global prerequisite history');
            assert.equal((await staff.call('/curriculum-progress?studentId=999999')).status,404);
            assert.equal((await student.call('/curriculum-progress?studentId='+newStudent)).data.student.id,originalStudent.student_id);
        });
    } finally { await new Promise(resolve=>server.close(resolve));await db.close(); }
});

test('V06.10 UI: chương trình có URL riêng và dữ liệu người dùng được escape',()=>{
    assert.equal(resourceQuery('curriculum-plan',{curriculumId:'9'},{}),'/curriculum-plan?curriculumId=9');
    assert.equal(resourceQuery('curriculum-progress',{},{}),'/curriculum-progress');
    assert.ok(navigation.academic.some(([code])=>code==='curriculum'));
    assert.ok(navigation.student.some(([code])=>code==='plan'));
    const html=onlinePlan({program:{name:'<img src=x onerror=alert(1)>'},
        subjects:[{name:'<svg/onload=alert(1)>',code:'<b>',credits:3,requirementType:'required',learningStatus:'passed',
            recommendedSemester:1,prerequisites:[]}],electiveGroups:[],earnedCredits:3,requiredCredits:3,
        remainingCredits:0,requiredOutstanding:0,unmetElectives:0,needsCreditReview:false,
        unrecognizedSubjects:[],readyForManualReview:true,note:'Không phải tốt nghiệp'});
    assert.ok(!html.includes('<svg/onload'));
    assert.match(html,/&lt;svg/);
    assert.ok(!html.includes('<img src=x'));
    assert.match(html,/&lt;img/);
});
