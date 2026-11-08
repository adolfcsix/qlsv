import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { seedDemo } from '../backend/database/seeds/demo.seed.js';
import { answer } from '../backend/src/modules/ai/ai.service.js';
import { aiEndpoint } from '../backend/src/modules/ai/ai-provider.js';
import { renderChatResult } from '../frontend/src/features/chatbot/chat-results.js';
import { chatAction } from '../frontend/src/features/chatbot/chat-panel.js';

test('AI cấu hình an toàn: HTTPS và loopback local, cấm HTTP mạng ngoài', () => {
  assert.equal(aiEndpoint({ AI_BASE_URL: 'https://api.example.net/v1', AI_TIMEOUT_MS: '5000' }).url, 'https://api.example.net/v1/chat/completions');
  assert.equal(aiEndpoint({ AI_BASE_URL: 'http://127.0.0.1:11434/v1' }).url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(aiEndpoint({ AI_BASE_URL: 'http://localhost:11434/v1' }).timeout, 8000);
  assert.throws(() => aiEndpoint({ AI_BASE_URL: 'http://example.com/v1' }), /HTTPS/);
  assert.throws(() => aiEndpoint({ AI_BASE_URL: 'http://localhost.evil.test/v1' }), /HTTPS/);
  assert.throws(() => aiEndpoint({ AI_BASE_URL: 'https://api.example.net/v1', AI_TIMEOUT_MS: '0' }), /AI_TIMEOUT_MS/); // 0 should be rejected, not used as default
  assert.throws(() => aiEndpoint({ AI_BASE_URL: 'https://api.example.net/v1', AI_TIMEOUT_MS: '100000' }), /AI_TIMEOUT_MS/);
  assert.throws(() => aiEndpoint({ AI_BASE_URL: 'https://alice:secret@api.example.net/v1' }), /thông tin đăng nhập/);
});

test('AI không có mạng: vẫn tra cứu dữ liệu thật, có thông báo chuyển chế độ, không vượt quyền', async () => {
  const originalFetch = globalThis.fetch;
  const previous = Object.fromEntries(['AI_API_KEY','AI_BASE_URL','AI_TIMEOUT_MS'].map(key => [key, process.env[key]]));
  const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
  try {
    await db.initialize();
    await seedDemo(db);
    process.env.AI_API_KEY = 'local-test-do-not-connect';
    process.env.AI_BASE_URL = 'https://mock.invalid/v1';
    process.env.AI_TIMEOUT_MS = '1000';
    globalThis.fetch = async () => { throw new Error('SIMULATED_NETWORK_DOWN'); };
    const user = { user_id: 2, role: 'ACADEMIC_STAFF' };
    const response = await answer(db, user, { message: 'Khóa K24 có bao nhiêu lớp?' });
    assert.equal(response.mode, 'local_lookup');
    assert.equal(response.result.replyMode, 'data');
    assert.equal(response.result.total, 10);
    assert.match(response.result.notice, /Không kết nối được mô hình AI/);
    assert.ok(response.result.sources.some(item => item.table === 'student_groups'));
    const html = renderChatResult(response.result, 0, chatAction);
    assert.match(html, /Tra cứu dữ liệu/);
    assert.match(html, /Không kết nối được mô hình AI/);
    assert.doesNotMatch(html, /SIMULATED_NETWORK_DOWN/);
    // Người khác không thể sử dụng fallback để đọc bảng điểm của sinh viên này.
    await assert.rejects(() => answer(db, { user_id: 4, role: 'STUDENT' }, { message: 'Bảng điểm 20240002' }), /quyền|truy cập/i);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.close();
  }
});

test('AI chọn đúng công cụ nhưng lỗi diễn giải: dữ liệu vẫn được giữ và ghi rõ trạng thái', async () => {
  const originalFetch = globalThis.fetch;
  const previous = Object.fromEntries(['AI_API_KEY','AI_BASE_URL'].map(key => [key, process.env[key]]));
  const db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
  try {
    await db.initialize();
    await seedDemo(db);
    process.env.AI_API_KEY = 'synthetic-key';
    process.env.AI_BASE_URL = 'https://mock.invalid/v1';
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 2) throw new Error('simulated provider reply failure');
      return new Response(JSON.stringify({ choices:[{message:{tool_calls:[{function:{arguments: JSON.stringify({intent:'cohort_classes',cohort:'2024'})}}]}}] }),{status:200,headers:{'Content-Type':'application/json'}});
    };
    const response = await answer(db, {user_id:2,role:'ACADEMIC_STAFF'}, {message:'Khóa K24 có bao nhiêu lớp?'});
    assert.equal(response.mode, 'local_lookup'); // Không nhận diện là AI nếu lời diễn giải không do mô hình trả về.
    assert.equal(response.result.replyMode, 'data');
    assert.equal(response.result.total, 10);
    assert.match(response.result.notice, /diễn giải AI tạm thời không phản hồi/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.close();
  }
});
