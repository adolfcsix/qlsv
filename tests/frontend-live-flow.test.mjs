import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { openDatabase } from '../backend/src/config/database.js';

// Real API + frontend controller/actions; DOM is simulated, not a browser E2E test.
test('Giao diện lưu điểm dùng mốc đã hiển thị và không ghi đè thay đổi từ phiên khác', async () => {
  const db=await openDatabase({driver:'sqlite',file:':memory:'});
  const {server}=await createApp({db,seed:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const nativeFetch=globalThis.fetch;
  const keys=['document','window','location','history','sessionStorage','localStorage','FormData','fetch'];
  const original=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  let cookie='',csrf='';
  const calls=[];
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(input,origin);
    calls.push({path:url.pathname,method:options.method||'GET',body:options.body});
    const res=await nativeFetch(url,{...options,headers:{...options.headers,...(cookie?{Cookie:cookie}:{})}});
    if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
    return res;
  };
  const login=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'cb001',password:'Hocvu@2026'})});
  csrf=(await login.json()).data.csrf;
  const node=()=>({innerHTML:'',textContent:'',value:'',dataset:{},isConnected:true,disabled:false,inert:false,open:false,style:{},classList:{contains:()=>false,remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},remove(){},append(){},querySelectorAll(){return[];},querySelector(){return node();},showModal(){this.open=true;},close(){this.open=false;}});
  const app=node(),toast=node(),dialog=node(),form=node(),nodes=new Map(),listeners=[];
  form.dataset.class='1';
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  app.querySelector=selector=>selector==='.boot-error'?null:get(selector);
  const store=new Map();
  globalThis.sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  globalThis.localStorage={getItem:()=>null,setItem(){}};
  globalThis.document={body:node(),activeElement:node(),querySelector:selector=>({'#app':app,'#toast':toast,'#modal':dialog,'#grades-form':form}[selector]||get(selector)),querySelectorAll:()=>[],createElement:node,addEventListener:(name,fn)=>{if(name==='click')listeners.push(fn);}};
  globalThis.window={addEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},confirm:()=>true};
  globalThis.location={hash:'#/academic/grades/1'};
  globalThis.history={replaceState(){}};
  let values=new Map();
  globalThis.FormData=class {constructor(){return values;}};
  try {
    await import('../frontend/src/main.js');
    for(let i=0;i<100&&!app.innerHTML.includes('id="grades-form"');i++)await new Promise(r=>setTimeout(r,10));
    assert.match(app.innerHTML,/id="grades-form"/);
    const book=await (await fetch('/api/v1/classes/1/gradebook')).json();
    const row=book.data.items.find(r=>!r.published&&r.process!==null);
    assert.ok(row);
    const concurrent=row.process===6?5:6;
    const update=await fetch('/api/v1/classes/1/gradebook',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({rows:[{enrollmentId:row.id,scores:{process:concurrent,midterm:row.midterm}}]})});
    assert.equal(update.status,200);
    values=new Map([[`${row.id}_process`,'9'],[`${row.id}_midterm`,String(row.midterm??'')]]);
    const target={dataset:{action:'save-grades'},isConnected:true,disabled:false};
    await listeners[0]({target:{closest:()=>target}});
    assert.match(toast.textContent,/Dữ liệu điểm đã đổi/);
    const saved=await db.get("SELECT g.score FROM grades g JOIN assessments a ON a.assessment_id=g.assessment_id WHERE g.enrollment_id=? AND a.assessment_type='process'",[Number(row.id)]);
    assert.equal(Number(saved.score),concurrent);
    const submitted=calls.filter(c=>c.method==='POST'&&c.path==='/api/v1/classes/1/gradebook').at(-1);
    assert.equal(JSON.parse(submitted.body).rows[0].expected.process,row.process);
  } finally {
    for(const key of keys)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();
  }
});
