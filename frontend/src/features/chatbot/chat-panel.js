// Tạo giao diện cửa sổ chat. Không truy vấn máy chủ hoặc thay đổi trạng thái.
import { brandMark } from '../../components/brand.js';
import { esc, icon } from '../../components/ui.js';
import { isOnline, backendInfo } from '../../services/repository.js';
import { renderChatHistory } from './chat-history.js';
import { renderChatResult } from './chat-results.js';

export const chatAction = (name, label, content, extra = '') =>
    `<button type="button" data-chat="${name}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${content}</button>`;

function suggestions(ctx) {
    const role = ctx.user.role;
    const code = ctx.db.students.find(student => student.id === ctx.user.profileId)?.code || ctx.user.code;
    if (role === 'student') return ['Giúp tôi đăng ký học phần', `Thông tin sinh viên ${code}`, `Bảng điểm ${code}`];
    if (role === 'lecturer') return ['Sinh viên đang học', 'Xin chào'];
    if (role === 'sysadmin') return ['Khóa K24 có bao nhiêu lớp?', 'Tổng quan hệ thống'];
    return ['Thêm khoa mới', 'Thêm khóa tuyển sinh', 'Giúp tôi xếp lịch học', 'Khóa K24 có bao nhiêu lớp?'];
}

function chatBody({ showHistory, chats, messages, busy, error, failed, ctx }) {
    if (showHistory) return renderChatHistory(chats, busy, chatAction);
    const content = messages.length
        ? messages.map((message, index) => message.role === 'user'
            ? `<article class="chat-message user-message"><span>Bạn</span><p>${esc(message.message)}</p></article>`
            : renderChatResult(message.result, index, chatAction)).join('')
        : `<div class="chat-welcome"><span>${brandMark()}</span><h3>Chào ${esc(ctx.user.name.split(' ').at(-1))},<br>tôi có thể giúp gì?</h3><p>Tìm thông tin học vụ bằng hội thoại.<br>Bạn có thể hỏi tiếp mà không cần nhập lại từ đầu.</p><div class="chat-prompts">${suggestions(ctx).map(question => chatAction('suggest', question, esc(question) + icon('arrow'), `data-question="${esc(question)}"`)).join('')}</div></div>`;
    return `<div class="chat-scroll" role="log" aria-live="polite" aria-relevant="additions text">
        ${content}
        ${busy ? '<div class="chat-pending" role="status"><i></i><i></i><i></i><span>Đang tra cứu…</span></div>' : ''}
        ${error ? `<div class="chat-error" role="alert">${esc(error)}${failed ? chatAction('retry', 'Thử gửi lại', 'Thử lại') : ''}</div>` : ''}
        <div data-chat-end></div>
    </div>`;
}

export function renderChatPanel({ wide, showHistory, chats, messages, busy, error, failed, draft, ctx, verification = null, verifying = false, verifyError = "" }) {
    const info = isOnline() && backendInfo()?.ai === 'ai_missing'
        ? 'Chưa kết nối mô hình AI. Tác vụ chỉ được lưu sau khi bạn xác nhận bản xem trước.'
        : !isOnline()
        ? 'Đang thử với dữ liệu mẫu; chưa kết nối mô hình AI.'
        : backendInfo()?.ai === 'ai_tools'
            ? 'Đã thiết lập mô hình AI, nhưng kết nối chỉ được xác nhận khi có phản hồi. Luôn đối chiếu nguồn dữ liệu.'
            : 'Chế độ tra cứu và biểu mẫu theo từ khóa. Tác vụ chỉ được lưu sau khi xác nhận.';
    const mode = !isOnline() ? 'Dữ liệu mẫu' : backendInfo()?.ai === 'ai_missing' ? 'AI chưa cấu hình' : backendInfo()?.ai === 'ai_tools' ? 'Đã cấu hình AI' : 'Tra cứu nội bộ';
    const liveConfigured = isOnline() && backendInfo()?.ai === 'ai_tools';
    const checkSection = liveConfigured
        ? `<div class="chat-ai-check">${chatAction('verify', verifying ? 'Đang kiểm tra mô hình' : 'Kiểm tra mô hình AI thật', verifying ? 'Đang kiểm tra…' : 'Kiểm tra AI thật', verifying ? 'disabled' : '')}
            ${verification?.connected ? `<span class="chat-ai-verified">Đã kết nối và gọi công cụ: ${esc(verification.model)}</span>` : ''}
            ${verifyError ? `<span class="chat-ai-warning">${esc(verifyError)}</span>` : ''}
           </div>`
        : '';
    const mobile = window.matchMedia('(max-width:760px)').matches;
    return `<section class="chatbot ${wide ? 'chatbot-wide' : ''}" role="dialog" aria-modal="${mobile}" aria-labelledby="chat-title">
        <header class="chat-header">
            <span class="chat-brand">${brandMark()}</span>
            <div><h2 id="chat-title">Lac Hong Chatbot</h2><p><i></i>${mode}</p></div>
            <div class="chat-toolbar">
                ${chatAction('history', 'Lịch sử hội thoại', icon('clock'), `aria-expanded="${showHistory}"`)}
                ${chatAction('new', 'Cuộc trò chuyện mới', icon('plus'))}
                ${mobile ? '' : chatAction('expand', wide ? 'Thu gọn chatbot' : 'Mở rộng chatbot', icon('layers'))}
                ${chatAction('close', 'Đóng chatbot', icon('close'))}
            </div>
        </header>
        ${checkSection}
        ${chatBody({showHistory, chats, messages, busy, error, failed, ctx})}
        <form id="chat-form" class="chat-composer">
            <label for="chat-input" class="sr-only">Tin nhắn cho chatbot</label>
            <textarea id="chat-input" name="message" rows="2" maxlength="1500" placeholder="Nhập câu hỏi của bạn…" ${busy ? 'disabled' : ''}>${esc(draft)}</textarea>
            <div><span>Enter để gửi · Shift + Enter xuống dòng</span>
                ${busy ? chatAction('stop', 'Dừng chờ phản hồi', icon('close')) : '<button type="submit" aria-label="Gửi tin nhắn">' + icon('arrow') + '</button>'}
            </div>
        </form>
        <footer class="chat-disclaimer">${info}</footer>
    </section>`;
}
