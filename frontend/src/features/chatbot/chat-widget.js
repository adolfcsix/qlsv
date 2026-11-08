import { brandMark } from '../../components/brand.js';
import { api, isOnline, backendInfo } from '../../services/repository.js';
import { demoChat } from '../../demo/chat.js';
import { esc, icon, csv } from '../../components/ui.js';
import { renderChatPanel, chatAction } from './chat-panel.js';
let verification = null, verifying = false, verifyError = '';
let root, ctx, owner = '', generation = 0, visible = false, wide = false, showHistory = false, chats = [], messages = [], conversationId = null, busy = false, error = '', draft = '', controller = null, failed = '', returnFocus = null;
const action = chatAction;
export function resetAssistant() { document.body.classList.remove('chat-modal-open'); if (document.querySelector('#app'))
    document.querySelector('#app').inert = false; generation++; controller?.abort(); ctx = null; owner = ''; visible = false; messages = []; chats = []; conversationId = null; busy = false; draft = ''; error = ''; failed = ''; verification = null; verifying = false; verifyError = ''; root?.remove(); root = null; }
export function openAssistant(question = '') { visible = true; showHistory = false; if (question)
    draft = question; returnFocus = document.activeElement; draw(); root?.querySelector('textarea')?.focus(); }
export function mountChatbot(context) {
    const identity = (isOnline() ? 'server:' : 'demo:') + context.user.id;
    if (owner !== identity) {
        resetAssistant();
        ctx = context;
        owner = identity;
        const token = generation;
        if (isOnline())
            api('/ai/conversations').then(rows => { if (token !== generation)
                return; chats = rows; draw(); }).catch(() => { });
    }
    else
        ctx = context;
    if (!root) {
        root = document.createElement('div');
        root.id = 'chatbot-root';
        document.body.append(root);
    }
    draw();
}
function draw({ focus = false, scroll = false } = {}) {
    if (!ctx || !root)
        return;
    const typing = document.activeElement === root.querySelector('textarea'), selection = root.querySelector('textarea')?.selectionStart, scrollTop = root.querySelector('.chat-scroll')?.scrollTop || 0;
    const modal = visible && window.matchMedia('(max-width:760px)').matches;
    document.body.classList.toggle('chat-modal-open', modal);
    const app = document.querySelector('#app');
    if (app)
        app.inert = modal;
    root.innerHTML = (visible ? renderChatPanel({
        wide, showHistory, chats, messages, busy, error, failed, draft, ctx, verification, verifying, verifyError
    }) : '') + action(visible ? 'close' : 'open',
        visible ? 'Thu gọn chatbot' : 'Mở chatbot Lac Hong',
        visible ? icon('close') : brandMark() + '<span>Hỏi Lac Hong</span>',
        `class="chat-launcher" aria-expanded="${visible}"`);
    root.querySelectorAll('[data-chat]').forEach(el => el.onclick = async () => {
        const type = el.dataset.chat;
        if (type === 'close') {
            visible = false;
            draw();
            returnFocus?.focus();
            return;
        }
        if (type === 'open')
            return openAssistant();
        if (type === 'verify') {
            if (!isOnline() || verifying || busy) return;
            verifying = true; verifyError = ''; verification = null; draw();
            const token = generation;
            try {
                const data = await api('/ai/verify', { method: 'POST', body: {} });
                if (token === generation) verification = data;
            } catch (e) {
                if (token === generation) verifyError = e.message || 'Không kết nối được mô hình AI.';
            } finally {
                if (token === generation) { verifying = false; draw(); }
            }
            return;
        }
        if (type === 'stop') {
            controller?.abort();
            return;
        }
        if (type === 'expand') {
            wide = !wide;
            draw();
            return;
        }
        if (type === 'history') {
            showHistory = !showHistory;
            draw();
            return;
        }
        if (type === 'export') {
            const result = messages[Number(el.dataset.index)]?.result;
            if (result?.rows)
                csv('chatbot-tra-cuu', result.columns.map(c => c.label), result.rows.map(r => result.columns.map(c => r[c.key] ?? '')));
            return;
        }
        if (busy)
            return;
        if(type==='confirm-action'||type==='cancel-action'){
            busy=true;error='';const token=generation,proposalId=el.dataset.proposal,index=Number(el.dataset.index);const currentProposal=messages[index]?.result?.proposal;if(currentProposal)currentProposal.status='processing';draw();
            try{const result=await api('/ai/proposals/'+proposalId,{method:'POST',body:{decision:type==='confirm-action'?'confirm':'cancel'}});if(token!==generation)return;const m=messages[index]?.result;if(m?.proposal?.id===proposalId){m.proposal.status=result.status;m.reply=result.status==='confirmed'?'Đã thực hiện sau khi bạn xác nhận.':'Đã hủy, không thay đổi dữ liệu.';}if(result.status==='confirmed')window.dispatchEvent(new Event('lhu-ai-changed'));}
            catch(e){if(token===generation){if(currentProposal)currentProposal.status='pending';error=e.message;}}finally{if(token===generation){busy=false;draw({scroll:true});}}return;
        }

        if (type === 'suggest') {
            draft = el.dataset.question;
            await send(draft);
            return;
        }
        if (type === 'retry') {
            await send(failed, true);
            return;
        }
        if (type === 'new') {
            conversationId = null;
            messages = [];
            draft = '';
            error = '';
            failed = '';
            showHistory = false;
            draw({ focus: true });
            return;
        }
        if (type === 'conversation') {
            const token = generation;
            try {
                const chat = isOnline() ? await api('/ai/conversations/' + el.dataset.id) : chats.find(c => c.id === el.dataset.id);
                if (token !== generation)
                    return;
                conversationId = chat.id;
                messages = structuredClone(chat.messages);
                error = '';
                showHistory = false;
                draw({ scroll: true });
            }
            catch (e) {
                error = e.message;
                showHistory = false;
                draw();
            }
        }
    });
    const form = root.querySelector('#chat-form');
    if (form)
        form.onsubmit = e => { e.preventDefault(); send(form.elements.message.value); };
    const input = root.querySelector('textarea');
    if (input) {
        input.oninput = () => { draft = input.value; };
        input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            form.requestSubmit();
        } };
    }
    if (focus || typing) {
        input?.focus();
        if (typing && selection !== undefined)
            input?.setSelectionRange(selection, selection);
    }
    if (scroll)
        root.querySelector('[data-chat-end]')?.scrollIntoView({ block: 'nearest' });
    else if (root.querySelector('.chat-scroll'))
        root.querySelector('.chat-scroll').scrollTop = scrollTop;
}
async function send(value, retry = false) {
    const message = value.trim();
    if (!message || busy)
        return;
    const token = generation;
    failed = '';
    error = '';
    if (!retry)
        messages.push({ role: 'user', message });
    draft = '';
    root?.querySelector('textarea') && (root.querySelector('textarea').value = '');
    busy = true;
    showHistory = false;
    controller = new AbortController();
    draw({ scroll: true });
    try {
        const previous = messages.filter(m => m.result).at(-1)?.result?.query || {};
        const response = isOnline() ? await api('/ai/messages', { method: 'POST', body: { message, ...(conversationId ? { conversationId } : {}) }, signal: controller.signal }) : demoChat(ctx, message, previous);
        if (token !== generation)
            return;
        if(response.result.replacesPreviousProposal||response.result.proposalReset)for(const old of messages)if(old.result?.proposal?.status==='pending')old.result.proposal.status=response.result.proposalReset?'cancelled':'superseded';
        messages.push({ role: 'assistant', result: response.result });
        if (isOnline()) {
            conversationId = response.conversationId;
            try {
                const next = await api('/ai/conversations');
                if (token === generation)
                    chats = next;
            }
            catch { }
        }
        else {
            conversationId = conversationId || 'demo-' + Date.now();
            const found = chats.find(c => c.id === conversationId);
            if (found)
                found.messages = structuredClone(messages);
            else
                chats.unshift({ id: conversationId, title: message, messages: structuredClone(messages) });
        }
    }
    catch (e) {
        if (token !== generation)
            return;
        failed = e.name === 'AbortError' ? '' : message;
        error = e.name === 'AbortError' ? 'Đã dừng chờ. Máy chủ có thể vẫn đang xử lý; mở lịch sử để kiểm tra.' : e.message;
    }
    finally {
        if (token === generation) {
            busy = false;
            controller = null;
            draw({ focus: visible, scroll: true });
        }
    }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && visible && !document.querySelector('dialog[open]')) {
    visible = false;
    draw();
    returnFocus?.focus();
} });
document.addEventListener('keydown', e => { if (e.key !== 'Tab' || !visible || !window.matchMedia('(max-width:760px)').matches)
    return; const nodes = [...root.querySelectorAll('.chatbot a[href],.chatbot button:not([disabled]),.chatbot textarea:not([disabled]),.chatbot summary')].filter(n => n.getClientRects().length); const first = nodes[0], last = nodes.at(-1); if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
}
else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
} });
window.matchMedia('(max-width:760px)').addEventListener('change', () => { if (ctx)
    draw(); });
