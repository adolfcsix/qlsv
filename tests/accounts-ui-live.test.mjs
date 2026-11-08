import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app.js';
import {openDatabase} from '../backend/src/config/database.js';

// Real controller/form actions and HTTP; simulated DOM is not a visual E2E assertion.
test('Giao diện quản trị tạo cán bộ, đổi sang giảng viên, xóa và khôi phục tài khoản',async()=>{
 const db=await openDatabase({driver:'sqlite',file:':memory:'}),{server}=await createApp({db,seed:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,nativeFetch=fetch;
 const keys=['document','window','location','history','sessionStorage','localStorage','FormData','fetch'],original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let cookie='';
 globalThis.fetch=async(input,options={})=>{const r=await nativeFetch(new URL(input,origin),{...options,headers:{...options.headers,Cookie:cookie}});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;};
 await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'quantri',password:'Hocvu@2026'})});
 const nodes=new Map(),events={},clicks=[],storage=new Map();let values=new Map(),hash='#/sysadmin/accounts';
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
  await import('../frontend/src/main.js');await wait(()=>app.innerHTML.includes('Quản lý tài khoản'));
  await click('new-account');get('[name="role"]').value='academic';get('[name="role"]').change();get('[name="profileChoice"]').value='new';get('[name="profileChoice"]').change();
  await submit({username:'cb_ui15',email:'cb_ui15@example.com',role:'academic',status:'active',temporaryPassword:'Temporary@2026',profileCode:'CB-UI15',profileName:'Cán bộ giao diện',departmentId:'1',profilePhone:'',reason:'Cấp cán bộ trên giao diện'});
  const user=await db.get('SELECT user_id FROM users WHERE username=?',['cb_ui15']);assert.ok(user,get('.form-error').textContent);const id=String(user.user_id);await wait(()=>app.innerHTML.includes('cb_ui15'));
  await click('edit-account',{id});assert.match(dialog.innerHTML,/Sửa tài khoản/);get('[name="role"]').value='lecturer';get('[name="role"]').change();get('[name="profileChoice"]').value='new';get('[name="profileChoice"]').change();
  await submit({username:'gv_ui15',email:'gv_ui15@example.com',role:'lecturer',status:'active',profileCode:'GV-UI15',profileName:'Giảng viên giao diện',departmentId:'1',profilePhone:'',reason:'Điều chuyển vai trò có hồ sơ mới'});
  await wait(()=>app.innerHTML.includes('gv_ui15'));assert.ok(await db.get('SELECT lecturer_id FROM lecturers WHERE user_id=?',[user.user_id]));assert.equal((await db.get('SELECT user_id FROM staffs WHERE staff_code=?',['CB-UI15'])).user_id,null);
  await click('delete-account',{id});await submit({reason:'Xóa tài khoản cấp thử chưa hoạt động'});await wait(()=>!app.innerHTML.includes('gv_ui15'));assert.equal(await db.get('SELECT user_id FROM users WHERE user_id=?',[user.user_id]),undefined);
  await click('delete-account',{id:'2'});await submit({reason:'Cán bộ nghỉ công tác, giữ lịch sử'});assert.ok(await db.get('SELECT user_id FROM account_archives WHERE user_id=2'));
  location.hash='/sysadmin/accounts/deleted';await wait(()=>app.innerHTML.includes('cb001')&&app.innerHTML.includes('restore-account'));
  await click('restore-account',{id:'2'});await submit({reason:'Đã xác minh và khôi phục quyền sử dụng'});await wait(()=>!app.innerHTML.includes('cb001'));assert.equal((await db.get('SELECT status FROM users WHERE user_id=2')).status,'locked');
  get('[name="role"]').value='sysadmin';get('[name="profileChoice"]').value=String((await db.get('SELECT staff_id FROM staffs WHERE user_id=1')).staff_id);
  await click('edit-account',{id:'1'});
  await submit({username:'root_ui15',email:'root-ui15@example.com',role:'sysadmin',status:'active',reason:'Cập nhật đăng nhập tài khoản quản trị đang dùng'});
  await wait(()=>hash==='#/login'&&app.innerHTML.includes('Đăng nhập Lac Hong'));
  assert.equal((await db.get('SELECT username FROM users WHERE user_id=1')).username,'root_ui15');
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM sessions WHERE user_id=1')).n,0);
 }finally{for(const key of keys)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}
});
