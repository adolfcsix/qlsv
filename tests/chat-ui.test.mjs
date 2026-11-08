import test from 'node:test';
import assert from 'node:assert/strict';
import { renderChatHistory } from '../frontend/src/features/chatbot/chat-history.js';
import { renderChatResult } from '../frontend/src/features/chatbot/chat-results.js';
import { renderChatPanel, chatAction } from '../frontend/src/features/chatbot/chat-panel.js';

const user = { role: 'student', id: '4', profileId: '11', code: 'SV24015', name: 'Nguyễn Minh Anh' };
const ctx = { user, db: { students: [{ id: '11', code: 'SV24015' }] } };

test('Giao diện lịch sử hội thoại hiển thị đúng và không chèn HTML từ tên hội thoại', () => {
  const safe = renderChatHistory([{ id: '1', title: '<img src=x onerror=alert(1)>' }], false, chatAction);
  assert.match(safe, /Lịch sử hội thoại/);
  assert.ok(safe.includes('&lt;img'));
  assert.ok(!safe.includes('<img'));
  assert.match(renderChatHistory([], false, chatAction), /Chưa có cuộc trò chuyện/);
});

test('Kết quả tra cứu hiển thị bảng, nguồn và chặn liên kết không hợp lệ', () => {
  const result = {
    reply: '<script>hello</script>',
    columns: [{key:'name',label:'Tên'}],
    rows: [{name: 'Nguyễn Minh Anh'}],
    links: [
      {label:'Hồ sơ sinh viên', href:'/academic/profile/11/overview'},
      {label:'Ra ngoài',href:'https://example.com/'}
    ],
    sources: [{table:'students'}],
    asOf:'2026-11-07T08:00:00.000Z'
  };
  const html = renderChatResult(result, 0, chatAction);
  assert.ok(html.includes('&lt;script&gt;hello&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.match(html, /Nguyễn Minh Anh/);
  assert.match(html, /Nguồn mẫu/);
  assert.match(html, /data-chat="export"/);
  assert.ok(html.includes('#/academic/profile/11/overview'));
  assert.ok(!html.includes('example.com'));
});

test('Cửa sổ chatbot có gợi ý theo vai trò, nút đóng, gửi, lịch sử và nhãn dữ liệu demo', () => {
  const previous = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    const initial = renderChatPanel({wide:false,showHistory:false,chats:[],messages:[],busy:false,error:'',failed:'',draft:'',ctx});
    assert.match(initial, /Thông tin sinh viên SV24015/);
    assert.match(initial, /name="message"/);
    assert.match(initial, /Lịch sử hội thoại/);
    assert.match(initial, /Dữ liệu mẫu/);
    const history = renderChatPanel({wide:false,showHistory:true,chats:[],messages:[],busy:false,error:'',failed:'',draft:'',ctx});
    assert.match(history, /Chưa có cuộc trò chuyện/);
    assert.ok(!history.includes('chat-welcome'));
    const pending = renderChatPanel({wide:false,showHistory:false,chats:[],messages:[],busy:true,error:'',failed:'',draft:'',ctx});
    assert.match(pending, /Đang tra cứu/);
    assert.match(pending, /Dừng chờ phản hồi/);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
