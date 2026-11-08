// Danh sách hội thoại chỉ chịu trách nhiệm kết xuất HTML.
import { esc, icon } from '../../components/ui.js';
export function renderChatHistory(chats, busy, action) {
    return `<nav class="chat-history" aria-label="Lịch sử hội thoại"><h3>Hội thoại của bạn</h3>${chats.length ? chats.map(c => action('conversation', c.title, icon('file') + `<span>${esc(c.title)}</span>`, `data-id="${esc(c.id)}" ${busy ? 'disabled' : ''}`)).join('') : '<p>Chưa có cuộc trò chuyện được lưu.</p>'}</nav>`;
}
