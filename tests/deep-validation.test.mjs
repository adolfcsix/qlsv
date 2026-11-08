import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJson } from '../backend/src/core/request.js';
import { dateOnly, timeOnly, id } from '../backend/src/utils/validation.js';
import { createApp } from '../backend/src/app.js';
import { openDatabase } from '../backend/src/config/database.js';
import { bindExamAttemptSelection } from '../frontend/src/features/actions/exams.js';

 test('Ngày thực, giờ 24h và mã định danh lớn không bị làm tròn hoặc tự đổi ngày', () => {
    assert.equal(dateOnly('2024-02-29'),'2024-02-29');
    for (const value of ['2026-02-29','2026-02-30','2026-04-31',null,20261108]) assert.throws(()=>dateOnly(value));
    for (const value of ['24:00','12:60','99:99','7:30']) assert.throws(()=>timeOnly(value));
    assert.equal(timeOnly('23:59'),'23:59');
    assert.throws(()=>id('9007199254740993'));
 });
 test('JSON giữ nguyên tiếng Việt khi một ký tự UTF-8 bị chia giữa hai gói', async () => {
    const raw=Buffer.from(JSON.stringify({name:'Nguyễn Đặng Hải Phòng'}));
    const split=raw.indexOf(Buffer.from('ễ'))+1;
    const req=Readable.from([raw.subarray(0,split),raw.subarray(split)]);
    req.headers={'content-type':'application/json'};
    assert.deepEqual(await readJson(req),{name:'Nguyễn Đặng Hải Phòng'});
 });
 test('Đổi lần thi nạp đúng điểm, trạng thái, thang điểm và xóa căn cứ cũ', () => {
    const controls=Object.fromEntries(['attemptId','status','score','reason'].map(key=>[key,{value:'',addEventListener(type,fn){this[type]=fn;}}]));
    controls.attemptId.value='1';
    const dialog={querySelector(selector){return controls[selector.match(/name="(.*?)"/)[1]];}};
    bindExamAttemptSelection(dialog,[{id:1,status:'attended',score:8,maxScore:10},{id:2,status:'absent',score:null,maxScore:20}]);
    assert.equal(controls.score.value,8);
    controls.reason.value='Căn cứ của lần đầu';
    controls.attemptId.value='2';controls.attemptId.change();
    assert.equal(controls.status.value,'absent');assert.equal(controls.score.value,'');
    assert.equal(controls.score.max,'20');assert.equal(controls.score.disabled,true);assert.equal(controls.reason.value,'');
    controls.status.value='attended';controls.status.change();assert.equal(controls.score.disabled,false);
 });
 test('API từ chối payload hỏng và lịch sai, rollback không ghi dở dữ liệu', async t => {
    const db=await openDatabase({driver:'sqlite',file:':memory:'});
    const {server}=await createApp({db,seed:true});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}/api/v1`;
    let cookie='',csrf='';
    async function post(route,body){const res=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:JSON.stringify(body)});const payload=await res.json();if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];if(payload.data?.csrf)csrf=payload.data.csrf;return {status:res.status,...payload};}
    try {
        await t.test('Login null, array và chuỗi trả 400 thay vì 500',async()=>{for(const value of [null,[],123,'abc'])assert.equal((await post('/auth/login',value)).status,400);});
        assert.equal((await post('/auth/login',{username:'cb001',password:'Hocvu@2026'})).status,200);
        await t.test('Patch null và hàng điểm null được từ chối',async()=>{
            const revision=(await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision;
            assert.equal((await post('/changes',{revision,changes:[null]})).status,422);
            assert.equal((await post('/changes',{revision,changes:[{table:'cohorts',before:null,after:[]}]})).status,422);
            assert.equal((await post('/classes/1/gradebook',{rows:[null]})).status,422);
            assert.equal((await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision,revision);
        });
        await t.test('Khoản thu ngày 30/2 và khóa năm thập phân không được ghi',async()=>{
            const revision=(await db.get('SELECT revision FROM app_lock WHERE lock_id=1')).revision;
            for(const [table,after] of [['charges',{studentId:1,name:'Sai ngày',amount:1000,due:'2026-02-30'}],['cohorts',{code:'BADYEAR',name:'Sai năm',year:2027.5}]]){
                assert.equal((await post('/changes',{revision,changes:[{table,before:null,after}]})).status,422);
            }
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM charges WHERE name=?',['Sai ngày'])).n,0);
            assert.equal((await db.get('SELECT COUNT(*) AS n FROM cohorts WHERE code=?',['BADYEAR'])).n,0);
        });
        await t.test('Điểm lần thi không bị ghi đè từ biểu mẫu đã cũ',async()=>{
            const row=await db.get("SELECT er.* FROM exam_registrations er JOIN exam_sessions es ON es.exam_id=er.exam_id WHERE es.status IN ('published','completed') AND NOT EXISTS(SELECT 1 FROM course_results r WHERE r.enrollment_id=er.enrollment_id AND r.is_published=1) AND EXISTS(SELECT 1 FROM exam_eligibility ee WHERE ee.enrollment_id=er.enrollment_id AND ee.assessment_id=er.assessment_id AND ee.conclusion='eligible') LIMIT 1");
            assert.ok(row);
            const expected={status:row.status,score:row.score==null?null:Number(row.score)};
            const first=await post(`/exam-registrations/${row.exam_registration_id}/score`,{status:'attended',score:7,reason:'Đã kiểm tra bài thi lần một',expected});
            assert.equal(first.status,200,JSON.stringify(first));
            const second=await post(`/exam-registrations/${row.exam_registration_id}/score`,{status:'attended',score:9,reason:'Biểu mẫu đang giữ điểm cũ',expected});
            assert.equal(second.status,409);assert.equal(second.error.code,'STALE_EXAM_SCORE');
            assert.equal(Number((await db.get('SELECT score FROM exam_registrations WHERE exam_registration_id=?',[row.exam_registration_id])).score),7);
            await db.update('enrollments','enrollment_id',row.enrollment_id,{status:'withdrawn'});
            assert.equal((await post(`/exam-registrations/${row.exam_registration_id}/score`,{status:'attended',score:9,reason:'Không được nhập sau rút học'})).status,409);
            assert.equal((await post(`/enrollments/${row.enrollment_id}/publish`,{})).status,409);
        });
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}
 });
