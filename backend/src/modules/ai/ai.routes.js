import { classAccess } from '../assessment/gradebook.service.js';
import { decideAction } from './action-engine.js';
import { allowedActions } from './action-registry.js';
import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { answer, executeLookup } from './ai.service.js';
import { verifyProvider } from './ai-provider.js';
export async function handleAi(ctx) {
    const { route, method, db, user } = ctx;
    if(route==='/api/v1/ai/actions'&&method==='GET'){ctx.json(200,{data:allowedActions(user)});return true;}
    const proposal=/^\/api\/v1\/ai\/proposals\/([a-f0-9-]{36})$/.exec(route);if(proposal&&method==='POST'){ctx.limit('ai-confirm:'+user.user_id,20);const body=await ctx.body();ensure(Object.keys(body).every(k=>k==='decision'),'Chỉ gửi quyết định, không thay nội dung đề xuất.');ctx.json(200,{data:await decideAction(db,user,proposal[1],body.decision)});return true;}
    if (route === '/api/v1/ai/verify' && method === 'POST') {
        ctx.limit('ai-verify:' + user.user_id, 5);
        ctx.json(200, { data: await verifyProvider() });
        return true;
    }
    if (route === '/api/v1/lookup' && method === 'POST') {
        const args = await ctx.body();
        ctx.json(200, { data: await db.tx(() => executeLookup(db, user, args)) });
        return true;
    }
    if (route === '/api/v1/ai/conversations' && method === 'GET') {
        const rows = await db.all('SELECT conversation_id AS id,title,created_at AS createdAt FROM ai_conversations WHERE user_id=? ORDER BY conversation_id DESC LIMIT 50', [user.user_id]);
        ctx.json(200, { data: rows });
        return true;
    }
    const chat = route.match(/^\/api\/v1\/ai\/conversations\/(\d+)$/);
    if (chat && method === 'GET') {
        const conv = await db.get('SELECT * FROM ai_conversations WHERE conversation_id=? AND user_id=?', [id(chat[1]), user.user_id]);
        ensure(conv, 'Không tìm thấy cuộc trò chuyện.', 404);
        const rows = await db.all('SELECT * FROM ai_messages WHERE conversation_id=? ORDER BY message_id', [conv.conversation_id]);
        const messages = [];
        for (const row of rows) {
            const content = JSON.parse(row.content_json);
            if(row.role==='assistant'&&content.proposal){const proposal=await db.get('SELECT status,actor_role,expires_at,session_hash,action_name,payload_json FROM ai_action_proposals WHERE proposal_id=? AND user_id=?',[content.proposal.id,user.user_id]);let scopeValid=true;if(proposal?.action_name==='grade.update'){try{await classAccess(db,user,JSON.parse(proposal.payload_json).input.classId);}catch{scopeValid=false;}}if(!proposal||proposal.actor_role!==user.role||proposal.session_hash!==(user.token_hash||'')||!scopeValid){messages.push({role:'assistant',result:{reply:'Đề xuất cũ không còn thuộc quyền hiện tại.',rows:[],columns:[],sources:[],links:[]}});continue;}content.proposal.status=proposal.status==='pending'&&proposal.expires_at<=new Date().toISOString()?'expired':proposal.status;}
            if (row.role === 'assistant' && content.query) {
                try {
                    const fresh = await db.tx(() => executeLookup(db, user, content.query));
                    const sameData = fresh.total === content.total && JSON.stringify(fresh.rows) === JSON.stringify(content.rows);
                    if (sameData && content.replyMode === 'llm') {
                        fresh.replyMode = 'llm';
                        fresh.reply = content.reply;
                    } else if (!sameData) {
                        fresh.notice = 'Dữ liệu đã thay đổi; nội dung bảng được tải lại. Lời diễn giải AI cũ không còn được sử dụng.';
                    }
                    messages.push({ role: row.role, result: fresh });
                }
                catch {
                    messages.push({ role: 'assistant', result: { title: 'Quyền truy cập đã thay đổi', message: 'Không thể mở lại dữ liệu này với quyền hiện tại.', rows: [], columns: [], sources: [], links: [] } });
                }
            }
            else
                messages.push(row.role === 'user' ? { role: 'user', message: content.message } : { role: 'assistant', result: content });
        }
        ctx.json(200, { data: { id: String(conv.conversation_id), title: conv.title, messages } });
        return true;
    }
    if (route === '/api/v1/ai/messages' && method === 'POST') {
        ctx.limit('ai:' + user.user_id, 20);
        ctx.json(200, { data: await answer(db, user, await ctx.body()) });
        return true;
    }
    return false;
}
