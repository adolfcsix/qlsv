import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDatabase } from '../backend/src/config/database.js';
import { seedDemo } from '../backend/database/seeds/demo.seed.js';
import { answer } from '../backend/src/modules/ai/ai.service.js';
import { createApp } from '../backend/src/app.js';
import { verifyProvider } from '../backend/src/modules/ai/ai-provider.js';

// Mô phỏng CHUẨN GIAO THỨC của provider; không có mạng hay API key thật.
// Kiểm tra mô hình được gọi, backend thực thi SQL có quyền và mô hình được gọi lần hai.
test('Kịch bản AI thật: mô hình chọn tool -> SQL thật -> mô hình diễn giải', async () => {
  const previous = Object.fromEntries(['AI_API_KEY','AI_BASE_URL','AI_MODEL','AI_REQUIRE_LIVE'].map(k=>[k, process.env[k]]));
  const calls = [];
  const modelServer = http.createServer(async (req,res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer integration-test');
    let text = '';
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); calls.push(body);
    if (body.tools) {
      assert.ok(body.tools.some(t=>t.function?.name==='lookup'));
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{tool_calls:[{type:'function',function:{name:'lookup',arguments:JSON.stringify({intent:'cohort_classes',cohort:'2024'})}}]}}]}));
    } else {
      const verified = JSON.parse(body.messages.at(-1).content).verifiedLookup;
      assert.equal(verified.total, verified.rows.some(row=>row.code==='DEMO-01') ? 2 : 10);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:`Mô hình diễn giải từ dữ liệu: ${verified.total} lớp.`}}]}));
    }
  });
  const db = await openDatabase({driver:'sqlite',file:':memory:'});
  let appServer;
  try {
    await new Promise(resolve=>modelServer.listen(0,'127.0.0.1',resolve));
    await db.initialize(); await seedDemo(db);
    process.env.AI_API_KEY='integration-test';
    process.env.AI_BASE_URL=`http://127.0.0.1:${modelServer.address().port}/v1`;
    process.env.AI_MODEL='fake-compatible-tool-model';
    process.env.AI_REQUIRE_LIVE='1';
    const verify = await verifyProvider();
    assert.equal(verify.connected, true);
    assert.equal(verify.toolCalling, true);
    const chat = await answer(db,{user_id:2,role:'ACADEMIC_STAFF'},{message:'Khóa K24 có bao nhiêu lớp?'});
    assert.equal(chat.mode,'ai_tools');
    assert.equal(chat.result.replyMode,'llm');
    assert.equal(chat.result.total,10);
    assert.match(chat.result.reply,/10 lớp/);
    assert.ok(chat.result.sources.some(s=>s.table==='student_groups'));
    assert.equal(calls.length,4);
    // Người dùng không thể vượt quyền dù intent của model là hợp lệ.
    await assert.rejects(()=>answer(db,{user_id:4,role:'STUDENT'},{message:'Khóa K24 có bao nhiêu lớp?'}), /cán bộ và quản trị/);
    assert.equal(calls.length,5); // Chặn sau lượt chọn tool, không gọi lượt diễn giải.

    // Kiểm chứng HTTP/API thật từ luồng frontend, không chỉ gọi các hàm backend trực tiếp.
    const app = await createApp({db});
    appServer = app.server;
    await new Promise(resolve=>appServer.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${appServer.address().port}`;
    const login = await fetch(origin+'/api/v1/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'cb001',password:'Hocvu@2026'})});
    assert.equal(login.status,200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    const csrf = (await login.json()).data.csrf;
    const headers = {Cookie: cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
    const check = await fetch(origin+'/api/v1/ai/verify',{method:'POST',headers,body:'{}'});
    assert.equal(check.status,200);
    const checked = (await check.json()).data;
    assert.equal(checked.connected,true);
    assert.equal(checked.toolCalling,true);
    assert.ok(!JSON.stringify(checked).includes('integration-test'));
    const sent = await fetch(origin+'/api/v1/ai/messages',{method:'POST',headers,body:JSON.stringify({message:'Khóa K24 có bao nhiêu lớp?'})});
    assert.equal(sent.status,200);
    const actual = (await sent.json()).data;
    assert.equal(actual.result.replyMode,'llm');
    assert.equal(actual.result.total,10);
    assert.equal(calls.length,9);
  } finally {
    for (const [key,value] of Object.entries(previous)) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
    if (appServer?.listening) await new Promise(resolve=>appServer.close(resolve));
    await db.close();
    await new Promise(resolve=>modelServer.close(resolve));
  }
});

test('Bắt buộc AI thật: thiếu key thì không được giả làm AI', async () => {
  const previous={key:process.env.AI_API_KEY, mode:process.env.AI_REQUIRE_LIVE};
  const db=await openDatabase({driver:'sqlite',file:':memory:'});
  try {
    await db.initialize(); await seedDemo(db);
    delete process.env.AI_API_KEY;
    process.env.AI_REQUIRE_LIVE='1';
    await assert.rejects(()=>answer(db,{user_id:2,role:'ACADEMIC_STAFF'},{message:'Khóa K24'}),/Chưa cấu hình mô hình AI thật/);
  } finally {
    if(previous.key===undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY=previous.key;
    if(previous.mode===undefined) delete process.env.AI_REQUIRE_LIVE; else process.env.AI_REQUIRE_LIVE=previous.mode;
    await db.close();
  }
});
