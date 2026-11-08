import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app.js';
import {openDatabase} from '../backend/src/config/database.js';

// Frontend controller + forms/actions with real HTTP and simulated DOM, not browser E2E.
test('Giao diện cán bộ: mở lớp → thêm buổi → thêm đích danh → duyệt đăng ký, không cần tải lại',async()=>{
 const db=await openDatabase({driver:'sqlite',file:':memory:'}),{server}=await createApp({db,seed:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`,nativeFetch=fetch;
 const keys=['document','window','location','history','sessionStorage','localStorage','FormData','fetch'];
 const original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let cookie='';
 const plain=async(path,method='GET',body,session='')=>{const res=await nativeFetch(origin+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Cookie:session},body:body===undefined?undefined:JSON.stringify(body)});return res;};
 globalThis.fetch=async(input,options={})=>{const res=await nativeFetch(new URL(input,origin),{...options,headers:{...options.headers,Cookie:cookie}});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;};
 await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'cb001',password:'Hocvu@2026'})});
 const node=()=>{const children=new Map();return {innerHTML:'',textContent:'',value:'',dataset:{},open:false,disabled:false,isConnected:true,style:{},classList:{contains:()=>false,remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},remove(){},append(){},querySelectorAll:()=>[],querySelector(s){if(!children.has(s))children.set(s,node());return children.get(s);},showModal(){this.open=true;},close(){this.open=false;}};};
 const app=node(),dialog=node(),toast=node(),events={},clicks=[],store=new Map();let values=new Map(),hash='#/academic/schedule';
 const location={reload(){}};Object.defineProperty(location,'hash',{get:()=>hash,set(value){const next=value.startsWith('#')?value:'#'+value;if(next!==hash){hash=next;queueMicrotask(()=>events.hashchange?.());}}});globalThis.location=location;
 globalThis.history={replaceState(_state,_title,value){hash=value;}};
 app.querySelector=selector=>selector==='.boot-error'?null:node();
 globalThis.document={body:node(),activeElement:node(),querySelector:selector=>({'#app':app,'#modal':dialog,'#toast':toast}[selector]||null),querySelectorAll:selector=>selector.includes('data-session-teacher')?[{value:'1'}]:[],createElement:node,addEventListener(type,fn){if(type==='click')clicks.push(fn);}};
 globalThis.window={addEventListener:(type,fn)=>events[type]=fn,dispatchEvent(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},confirm:()=>true};
 globalThis.sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.FormData=class{constructor(){return values;}};
 const click=async(action,dataset={})=>{const el={dataset:{action,...dataset},isConnected:true,disabled:false};await clicks[0]({target:{closest:()=>el}});};
 const submit=async(fields)=>{values=new Map(Object.entries(fields));await dialog.querySelector('form').onsubmit({preventDefault(){},target:{}});};
 const wait=async(fn)=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.fail('Giao diện chưa cập nhật: '+app.innerHTML.slice(0,180));};
 try{
  await import('../frontend/src/main.js');await wait(()=>app.innerHTML.includes('Danh sách sinh viên'));
  await click('new-class');assert.match(dialog.innerHTML,/Mở lớp học phần/);
  await submit({code:'V14-UI',subjectId:'2',semesterId:'1',lecturerId:'',capacity:'4',status:'open'});
  const course=await db.get('SELECT class_id FROM classes WHERE class_code=?',['V14-UI']);assert.ok(course,dialog.querySelector('.form-error').textContent);
  const id=String(course.class_id);await wait(()=>hash==='#/academic/schedule/'+id&&app.innerHTML.includes('V14-UI')&&app.innerHTML.includes('Danh sách sinh viên · 0/4'));
  await click('new-session',{class:id});assert.match(dialog.innerHTML,/Giảng viên của buổi học/);
  await submit({day:'7',start:'14:00',end:'15:00',from:'2026-11-02',to:'2026-11-08',roomId:'1'});
  assert.ok(await db.get('SELECT schedule_id FROM class_schedules WHERE class_id=?',[course.class_id]),dialog.querySelector('.form-error').textContent);
  await wait(()=>app.innerHTML.includes('14:00'));
  await click('add-member',{class:id});assert.match(dialog.innerHTML,/Thêm sinh viên đích danh/);
  await submit({studentId:'2',reason:'Cán bộ điều phối trực tiếp'});
  await wait(()=>app.innerHTML.includes('Danh sách sinh viên · 1/4'));
  const login=await plain('/auth/login','POST',{username:'20240001',password:'Hocvu@2026'});const studentCookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).data.csrf;
  const sent=await nativeFetch(origin+'/api/v1/enrollment-requests',{method:'POST',headers:{'Content-Type':'application/json',Cookie:studentCookie,'X-CSRF-Token':csrf},body:JSON.stringify({classIds:[id]})});assert.equal(sent.status,202);const requestId=(await sent.json()).data.requestIds[0];
  await click('refresh-data');await wait(()=>app.innerHTML.includes('data-id="'+requestId+'"')&&app.innerHTML.includes('approve-enrollment'));
  await click('approve-enrollment',{id:requestId});await submit({reason:'Đã xác nhận đủ điều kiện học'});
  await wait(()=>app.innerHTML.includes('Danh sách sinh viên · 2/4'));
  assert.equal((await db.get('SELECT status FROM enrollment_requests WHERE request_id=?',[requestId])).status,'approved');
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM enrollments WHERE class_id=? AND status='registered'",[course.class_id])).n,2);
 }finally{for(const key of keys)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}
});
