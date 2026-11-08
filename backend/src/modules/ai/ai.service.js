import { assistantTurn } from './assistant-turn.js';
import {ensure} from '../../core/errors.js';
import {id,text} from '../../utils/validation.js';
import {writeAudit} from '../audit/audit.service.js';
import {norm,localIntent} from '../../../../shared/lookup-intents.js';
import {executeLookup,isoNow} from './ai-tools.js';
import {providerIntent,providerReply} from './ai-provider.js';

export {localIntent} from '../../../../shared/lookup-intents.js';
export {executeLookup} from './ai-tools.js';

export async function answer(db, user, body) {
    const message = text(body.message, 'Câu hỏi', 1500);
    let conv;
    if (body.conversationId)
        conv = await db.get('SELECT * FROM ai_conversations WHERE conversation_id=? AND user_id=?', [id(body.conversationId), user.user_id]);
    if (body.conversationId)
        ensure(conv, 'Không tìm thấy cuộc trò chuyện.', 404, 'NOT_FOUND');
    let context = conv ? JSON.parse(conv.context_json) : {};
    const previous = conv ? await db.all('SELECT role,content_json FROM ai_messages WHERE conversation_id=? ORDER BY message_id DESC LIMIT 8', [conv.conversation_id]) : [];
    const history = previous.reverse().flatMap(row => { const c = JSON.parse(row.content_json); return c.message ? [{ role: 'user', content: c.message }] : c.reply ? [{ role: 'assistant', content: c.reply }] : []; });
    const assisted=await assistantTurn(db,user,{message,context,conv,task:body.task});if(assisted)return assisted;
    const mustUseAi = process.env.AI_REQUIRE_LIVE === '1';
    ensure(!mustUseAi || process.env.AI_API_KEY, 'Chưa cấu hình mô hình AI thật. Xem docs/HUONG_DAN_TICH_HOP_AI.md.', 503, 'AI_REQUIRED');
    let llm = null;
    let providerUnavailable = false;
    if (process.env.AI_API_KEY) {
        try { llm = await providerIntent(message, context, history); }
        catch (error) {
            // Không để lỗi mạng/mô hình khiến công cụ đọc dữ liệu của trường ngừng hoạt động.
            // Tuyệt đối không trả lỗi chi tiết (URL, khóa API) về trình duyệt.
            if (mustUseAi) ensure(false, 'Mô hình AI không phản hồi hoặc chưa hỗ trợ công cụ tra cứu.', 503, 'AI_PROVIDER_UNAVAILABLE');
            providerUnavailable = true;
        }
    }
    const args = llm ? { ...context, ...llm } : localIntent(message, context);
    const result = await db.tx(() => executeLookup(db, user, args));
    result.query = args;
    result.reply = result.message;
    result.replyMode = 'data';
    if (providerUnavailable)
        result.notice = 'Không kết nối được mô hình AI; câu trả lời này dùng bộ tra cứu nội bộ và dữ liệu theo quyền truy cập.';
    if (args.intent === 'help') {
        result.reply = /^(xin chao|chao|hello|hi)\b/.test(norm(message)) ? 'Chào bạn! Tôi là chatbot Lac Hong. Bạn muốn xem thông tin khóa, lớp hay tra cứu một sinh viên? Bạn có thể nhập mã sinh viên hoặc chọn câu hỏi gợi ý.' : result.message;
    }
    if (llm) {
        try {
            result.reply = await providerReply(message, result, history);
            result.replyMode = 'llm';
        }
        catch {
            if (mustUseAi) ensure(false, 'Mô hình AI không thể diễn giải dữ liệu tra cứu. Vui lòng kiểm tra mô hình.', 503, 'AI_REPLY_UNAVAILABLE');
            result.notice = 'Đã lấy dữ liệu; phần diễn giải AI tạm thời không phản hồi. Bạn vẫn có thể kiểm tra bảng và nguồn bên dưới.';
        }
    }
    const conversationId = await db.tx(async () => { const cid = conv?.conversation_id || await db.insert('ai_conversations', { user_id: user.user_id, title: message.slice(0, 100), context_json: JSON.stringify(args), created_at: isoNow() }); await db.update('ai_conversations', 'conversation_id', cid, { context_json: JSON.stringify(args) }); await db.insert('ai_messages', { conversation_id: cid, role: 'user', content_json: JSON.stringify({ message }), created_at: isoNow() }); await db.insert('ai_messages', { conversation_id: cid, role: 'assistant', content_json: JSON.stringify(result), created_at: isoNow() }); await writeAudit(db, user, 'AI_LOOKUP', 'ai_conversations', cid, null, { intent: args.intent }); return cid; });
    return { conversationId: String(conversationId), mode: result.replyMode === 'llm' ? 'ai_tools' : 'local_lookup', result };
}
