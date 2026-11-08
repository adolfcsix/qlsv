import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app.js';
import {openDatabase} from '../backend/src/config/database.js';

// Real controller/form actions and HTTP; simulated DOM is not a visual E2E assertion.
test('V16 giao diện quản trị: hồ sơ nhân sự, năm học, học kỳ, phòng và drilldown qua HTTP',async()=>{
 const db=await openDatabase({driver:'sqlite',file:':memory:'}),{server}=await createApp({db,seed:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,nativeFetch=fetch;
 const keys=['document','window','location','history','sessionStorage','localStorage','FormData','fetch'],original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let cookie='';
 globalThis.fetch=async(input,options={})=>{const r=await nativeFetch(new URL(input,origin),{...options,headers:{...options.headers,Cookie:cookie}});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;};
 await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'quantri',password:'Hocvu@2026'})});
 const nodes=new Map(),events={},clicks=[],storage=new Map();let values=new Map(),hash='#/sysadmin/personnel/lecturer';
 function node(){return {innerHTML:'',textContent:'',value:'',dataset:{},open:false,disabled:false,isConnected:true,style:{},classList:{contains:()=>false,remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(type,fn){this[type]=fn;},focus(){},remove(){},append(){},querySelectorAll:()=>[],querySelector:get,showModal(){this.open=true;},close(){this.open=false;}};}
 function get(selector){if(!nodes.has(selector)){const n=node();if(selector==='[name="role"]')n.value='student';nodes.set(selector,n);}return nodes.get(selector);}
 const app=node(),dialog=node(),toast=node();app.querySelector=s=>s==='.boot-error'?null:get(s);
 globalThis.document={body:node(),activeElement:node(),querySelector:s=>({'#app':app,'#modal':dialog,'#toast':toast}[s]||get(s)),querySelectorAll:()=>[],createElement:node,addEventListener(type,fn){if(type==='click')clicks.push(fn);}};
 globalThis.window={addEventListener:(type,fn)=>events[type]=fn,dispatchEvent(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},confirm:()=>true};
 const location={reload(){}};Object.defineProperty(location,'hash',{get:()=>hash,set(value){const next=value.startsWith('#')?value:'#'+value;if(next!==hash){hash=next;queueMicrotask(()=>events.hashchange?.());}}});globalThis.location=location;globalThis.history={replaceState(_a,_b,value){hash=value;}};
 globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.FormData=class{constructor(){return values;}};
 const click=async(action,dataset={})=>{const el={dataset:{action,...dataset},isConnected:true,disabled:false};await clicks[0]({target:{closest:()=>el}});};
 const submit=async(fields)=>{values=new Map(Object.entries(fields));await get('form').onsubmit({preventDefault(){},target:{}});};
 const wait=async check=>{for(let n=0;n<150;n++){if(check())return;await new Promise(r=>setTimeout(r,10));}assert.fail('UI chưa cập nhật: '+toast.textContent+' / '+get('.form-error').textContent);};
 try{
  await import('../frontend/src/main.js');await wait(()=>app.innerHTML.includes('admin-personnel-edit'));
  await click('admin-personnel-new');await submit({code:'GV-UI16',name:'Giảng viên giao diện 16',departmentId:'1',email:'ui16@example.com',phone:'',reason:'Kiểm tra biểu mẫu nhân sự'});
  await wait(()=>app.innerHTML.includes('GV-UI16'));const lecturer=await db.get('SELECT lecturer_id FROM lecturers WHERE lecturer_code=?',['GV-UI16']);assert.ok(lecturer);
  await click('admin-personnel-edit',{id:String(lecturer.lecturer_id)});await submit({code:'GV-UI16',name:'Giảng viên đã sửa',departmentId:'1',email:'ui16@example.com',phone:'0123456789',reason:'Cập nhật hồ sơ'});await wait(()=>app.innerHTML.includes('Giảng viên đã sửa'));
  await click('admin-personnel-delete',{id:String(lecturer.lecturer_id)});await submit({reason:'Xóa hồ sơ kiểm thử chưa dùng'});await wait(()=>!app.innerHTML.includes('GV-UI16'));
  location.hash='/sysadmin/calendar';await wait(()=>app.innerHTML.includes('admin-year-edit'));
  await click('admin-year-new');await submit({name:'UI 2040–2041',start:'2040-09-01',end:'2041-08-31',reason:'Tạo năm thử nghiệm'});await wait(()=>app.innerHTML.includes('UI 2040–2041'));
  const year=await db.get('SELECT academic_year_id FROM academic_years WHERE name=?',['UI 2040–2041']);assert.ok(year);
  await click('admin-semester-new',{year:String(year.academic_year_id)});await submit({yearId:String(year.academic_year_id),name:'Học kỳ UI',start:'2040-09-01',end:'2041-01-31',registrationStart:'2040-08-01T08:00',registrationEnd:'2040-08-31T17:00',reason:'Tạo cửa sổ đăng ký'});
  const term=await db.get('SELECT semester_id FROM semesters WHERE name=?',['Học kỳ UI']);assert.ok(term,get('.form-error').textContent);
  location.hash='/sysadmin/rooms';await wait(()=>app.innerHTML.includes('admin-room-edit'));
  await click('admin-room-new');await submit({code:'UI16-A',type:'Phòng thực hành',capacity:'60',enabled:'true',reason:'Thêm phòng kiểm thử'});await wait(()=>app.innerHTML.includes('UI16-A'));
  const room=await db.get('SELECT room_id FROM rooms WHERE room_code=?',['UI16-A']);assert.ok(room);
  await click('admin-room-edit',{id:String(room.room_id)});await submit({code:'UI16-B',type:'Phòng thực hành',capacity:'70',enabled:'false',reason:'Sửa phòng và tạm ngừng'});await wait(()=>app.innerHTML.includes('UI16-B'));assert.equal((await db.get('SELECT enabled FROM room_settings WHERE room_id=?',[room.room_id])).enabled,0);
  await click('admin-room-usage',{id:String(room.room_id)});assert.match(dialog.innerHTML,/Lịch học/);
  await click('admin-room-delete',{id:String(room.room_id)});await submit({reason:'Xóa phòng chưa sử dụng'});await wait(()=>!app.innerHTML.includes('UI16-B'));
  location.hash='/sysadmin/dashboard';await wait(()=>app.innerHTML.includes('admin-overview-list'));
  await click('admin-overview-list',{list:'sections',issue:'no-schedule'});await wait(()=>app.innerHTML.includes('Chưa có buổi học'));
 }finally{for(const key of keys)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}
});
