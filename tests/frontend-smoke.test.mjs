import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Chạy trình biên dịch/module graph như browser với DOM tối giản để phát hiện import hỏng.
// Không thay thế kiểm thử trên Chromium hoặc E2E với backend thật.
test('Frontend V06 khởi động và kết xuất trang đăng nhập trong chế độ giả lập DOM',()=>{
  const code = `
    import assert from 'node:assert/strict';
    const makeNode=()=>({innerHTML:'',inert:false,classList:{contains:()=>false,remove(){},toggle(){}},querySelector(selector){return selector==='.boot-error'?null:makeNode();},querySelectorAll(){return [];},addEventListener(){},focus(){},setAttribute(){},removeAttribute(){},append(){},remove(){},style:{}});
    const app=makeNode();
    const doc={body:makeNode(),activeElement:makeNode(),querySelector(selector){return selector==='#app'?app:makeNode();},querySelectorAll(){return [];},createElement(){return makeNode();},addEventListener(){}};
    globalThis.document=doc;
    globalThis.window={addEventListener(){},matchMedia(){return {matches:false,addEventListener(){}};},scrollTo(){},confirm(){return true;}};
    globalThis.location={hash:'#/login'};
    globalThis.history={replaceState(){}};
    const items=new Map();globalThis.sessionStorage={getItem:key=>items.get(key)||null,setItem:(k,v)=>items.set(k,v),removeItem:key=>items.delete(key)};
    globalThis.localStorage={getItem:()=>null,setItem(){}};
    globalThis.fetch=async()=>new Response('',{status:404,headers:{'Content-Type':'text/plain'}});
    await import('./frontend/src/main.js');
    assert.match(app.innerHTML,/Đăng nhập Lac Hong/);
    assert.match(app.innerHTML,/CỔNG THÔNG TIN ĐÀO TẠO/);
    assert.ok(!app.innerHTML.includes('undefined'));
    console.log('FRONTEND_BOOT_OK');
  `;
  const dir = fileURLToPath(new URL('../',import.meta.url));
  const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,encoding:'utf8',timeout:20000});
  assert.equal(run.status,0,run.stderr||run.stdout);
  assert.match(run.stdout,/FRONTEND_BOOT_OK/);
});

test('Lỗi tải module hiện thông báo và nút tải lại, không để màn hình trắng', async () => {
  const {readFile} = await import('node:fs/promises');
  const source=await readFile(new URL('../frontend/src/main.js',import.meta.url),'utf8');
  const code=`
    import assert from 'node:assert/strict';
    const message={textContent:''},button={addEventListener(name,fn){this.click=fn;}},app={innerHTML:'',querySelector(s){return s==='button'?button:message;}};
    globalThis.document={querySelector(){return app;}};
    let reloaded=false;globalThis.location={reload(){reloaded=true;}};
    console.error=()=>{};
    await import('data:text/javascript;base64,'+Buffer.from(${JSON.stringify(source)}).toString('base64'));
    assert.match(app.innerHTML,/Không tải được giao diện/);
    assert.ok(message.textContent);
    button.click();assert.equal(reloaded,true);
  `;
  const run=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000});
  assert.equal(run.status,0,run.stderr||run.stdout);
});
