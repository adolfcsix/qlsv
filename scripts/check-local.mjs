// Kiểm tra độc lập, không ghi vào cơ sở dữ liệu thật của người dùng.
// Có thể chạy ngay cả khi máy chưa cài MySQL hoặc chưa có API key AI.
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/src/config/database.js';
import { createApp } from '../backend/src/app.js';
import { aiEndpoint } from '../backend/src/modules/ai/ai-provider.js';

const tests = [];
function check(label, action) {
  return Promise.resolve().then(action).then(() => {
    tests.push({ label, result: 'ĐẠT' });
    console.log('✓ ' + label);
  }, error => {
    tests.push({ label, result: 'LỖI' });
    console.error('✗ ' + label + ': ' + error.message);
  });
}

await check('Node.js >= 22.13', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || major === 22 && minor >= 13, 'Cần nâng cấp Node.js.');
});
let db, server, origin;
try {
  db = await openDatabase({ driver: 'sqlite', file: ':memory:' });
  const app = await createApp({ db, seed: true });
  server = app.server;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = 'http://127.0.0.1:' + server.address().port;

  await check('SQLite mẫu được khởi tạo độc lập (không chạm dữ liệu thật)', async () => {
    const count = await db.get('SELECT COUNT(*) AS total FROM students');
    assert.ok(count.total > 0);
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    for (const name of ['students', 'student_groups', 'course_results', 'ai_conversations', 'graduation_reviews']) {
      assert.ok(tables.some(row => row.name === name), 'Thiếu bảng ' + name);
    }
  });

  await check('Frontend và API hoạt động qua HTTP trên localhost', async () => {
    for (const [path, type] of [['/', 'text/html'], ['/src/main.js', 'text/javascript'], ['/src/styles/main.css', 'text/css'], ['/api/v1/health', 'application/json']]) {
      const r = await fetch(origin + path);
      assert.equal(r.status, 200, path);
      assert.ok((r.headers.get('content-type') || '').includes(type), path + ' MIME');
    }
  });

  const sessions = {}, csrfTokens = {};
  await check('Đăng nhập được bốn vai trò bằng dữ liệu demo', async () => {
    for (const [role, username] of Object.entries({ admin: 'quantri', academic: 'cb001', lecturer: 'gv001', student: '20240001' })) {
      const r = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'Hocvu@2026' }) });
      assert.equal(r.status, 200, role);
      const cookie = r.headers.get('set-cookie')?.split(';')[0];
      assert.ok(cookie?.startsWith('qlsv_session='), role);
      sessions[role] = cookie;
      csrfTokens[role] = (await r.json()).data.csrf;
      const me = await fetch(origin + '/api/v1/auth/me', { headers: { Cookie: cookie } });
      assert.equal(me.status, 200, role + ' /me');
    }
  });

  await check('Chatbot tra cứu CSDL thật và ngăn sinh viên vượt quyền', async () => {
    const staff = await fetch(origin + '/api/v1/lookup', { method: 'POST', headers: { Cookie: sessions.academic, 'X-CSRF-Token': csrfTokens.academic, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'cohort_classes', cohort: '2024' }) });
    assert.equal(staff.status, 200);
    const data = (await staff.json()).data;
    assert.ok(data.total > 0);
    assert.ok(data.sources?.some(source => source.table === 'student_groups'));
    const blocked = await fetch(origin + '/api/v1/lookup', { method: 'POST', headers: { Cookie: sessions.student, 'X-CSRF-Token': csrfTokens.student, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'student_transcript', studentCode: '20240002' }) });
    assert.equal(blocked.status, 403);
  });

  await check('Truy vấn không đăng nhập bị chặn', async () => {
    const r = await fetch(origin + '/api/v1/ai/conversations');
    assert.equal(r.status, 401);
  });

  await check('Cấu hình AI có định dạng hợp lệ (không gọi nhà cung cấp)', () => {
    if (process.env.AI_API_KEY) aiEndpoint();
  });
} catch (error) {
  tests.push({ label: 'Khởi tạo kiểm tra local', result: 'LỖI' });
  console.error('✗ Không thể khởi tạo môi trường kiểm thử:', error.message);
} finally {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  if (db) await db.close();
}
console.log('\nKẾT QUẢ LOCAL:', tests.filter(t => t.result === 'ĐẠT').length + '/' + tests.length, 'mục đạt.');
if (process.env.AI_API_KEY) console.log('AI: Có cấu hình nhà cung cấp; kết nối và trả lời thực tế CHƯA được kiểm tra.');
else console.log('AI: Chế độ tra cứu CSDL nội bộ; chưa cấu hình mô hình hội thoại.');
console.log('MySQL và trình duyệt thực tế không nằm trong lệnh kiểm tra độc lập này.');
if (tests.some(t => t.result !== 'ĐẠT')) process.exitCode = 1;
