import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderChatPanel } from '../frontend/src/features/chatbot/chat-panel.js';
import { link } from '../frontend/src/components/buttons.js';
import { navigation } from '../frontend/src/app/navigation.js';
import { renderers } from '../frontend/src/app/routes.js';

const panelArgs = {
  wide: false, showHistory: false, chats: [], messages: [], busy: false,
  error: '', failed: '', draft: '',
  ctx: { user: { role: 'academic', name: 'Cán bộ đào tạo', id: '01' }, db: { students: [] } }
};

test('Chatbot mobile: có tiêu đề, nút đóng và không hiển thị mở rộng vô nghĩa', () => {
  const original = globalThis.window;
  try {
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    const html = renderChatPanel(panelArgs);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /data-chat="close"/);
    assert.match(html, /id="chat-input"/);
    assert.doesNotMatch(html, /data-chat="expand"/);
  } finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
});

test('Chatbot desktop: giữ nút điều chỉnh chiều rộng', () => {
  const original = globalThis.window;
  try {
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    const html = renderChatPanel(panelArgs);
    assert.match(html, /aria-modal="false"/);
    assert.match(html, /data-chat="expand"/);
  } finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
});

test('Menu 4 vai trò có trang render tương ứng, không có mục trắng', () => {
  for (const [role, items] of Object.entries(navigation)) {
    assert.ok(items.length > 0, `Thiếu menu ${role}`);
    const keys = items.map(i => i[0]);
    assert.equal(new Set(keys).size, keys.length, `Menu trùng ở ${role}`);
    for (const [key] of items) assert.equal(typeof renderers[key], 'function', `${role}/${key} chưa có renderer`);
  }
});

test('Liên kết đang chọn có aria-current, liên kết bình thường không gắn nhãn sai', () => {
  assert.match(link('Lớp', '/academic/organization', 'nav-link active'), /aria-current="page"/);
  assert.doesNotMatch(link('Khóa', '/academic/cohorts', 'nav-link'), /aria-current="page"/);
});

test('CSS sửa mobile được nạp sau bản biên dịch và có bảo vệ màn hình nhỏ', () => {
  const css = readFileSync(new URL('../frontend/src/styles/responsive.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../frontend/src/styles/main.css', import.meta.url), 'utf8');
  assert.ok(main.indexOf('generated.css') < main.indexOf('responsive.css'));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.table-scroll\s*\{/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.chat-composer textarea\s*\{\s*font-size: 16px;/);
});
