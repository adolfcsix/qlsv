import * as demo from '../demo/repository.js';
export { uid, audit, getContext, register, collect, balance } from '../demo/repository.js';
let online = false, cache = null, csrf = '', user = null, health = null;
export const isOnline = () => online;
export const serverUser = () => user;
export const backendInfo = () => health;
export async function api(path, options = {}) { const headers = { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers }; const response = await fetch('/api/v1' + path, { ...options, headers, credentials: 'same-origin', body: options.body === undefined ? undefined : JSON.stringify(options.body) }); let data; try {
    data = await response.json();
}
catch {
    throw new Error('Máy chủ trả về dữ liệu chưa hợp lệ.');
} if (!response.ok) {
    const err = new Error(data.error?.message || 'Không thể xử lý yêu cầu.');
    err.code = data.error?.code;
    err.status = response.status;
    if (response.status === 401 && online) {
        user = null;
        csrf = '';
        cache = empty();
        sessionStorage.removeItem('hocvu-account');
        window.dispatchEvent(new Event('api-session-expired'));
    }
    throw err;
} return data.data; }
export async function initialize() {
    let response;
    try {
        response = await fetch('/api/v1/health', { credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
    }
    catch {
        throw new Error('Không kết nối được máy chủ. Hãy kiểm tra kết nối và thử lại.');
    }
    if (response.status === 404)
        return;
    if (!response.ok)
        throw new Error('Máy chủ chưa sẵn sàng. Vui lòng thử lại.');
    if (!(response.headers.get('content-type') || '').includes('application/json'))
        return;
    const payload = await response.json();
    if (payload.data?.status !== 'ok')
        throw new Error('Phản hồi máy chủ không hợp lệ.');
    health = payload.data;
    online = true;
    cache = empty();
    try {
        const result = await api('/auth/me');
        user = result.user;
        csrf = result.csrf;
        sessionStorage.setItem('hocvu-account', user.id);
        await refresh();
    }
    catch (e) {
        if (e.status !== 401)
            throw e;
        sessionStorage.removeItem('hocvu-account');
    }
}
function empty() { return Object.fromEntries(['cohorts', 'departments', 'majors', 'programs', 'groups', 'lecturers', 'students', 'subjects', 'classes', 'enrollments', 'results', 'grades', 'exams', 'requests', 'charges', 'receipts', 'contacts', 'history', 'accounts', 'audit'].map(k => [k, []])); }
export function read() { return online ? (cache || empty()) : demo.read(); }
export async function refresh() { if (online)
    cache = await api('/state'); return read(); }
export async function signIn(username, password) { const result = await api('/auth/login', { method: 'POST', body: { username, password } }); csrf = result.csrf; const me = await api('/auth/me'); user = me.user; csrf = me.csrf; sessionStorage.setItem('hocvu-account', user.id); await refresh(); return user; }
export async function signOut() {
    if (online) {
        try { await api('/auth/logout', { method: 'POST', body: {} }); }
        catch (error) { if (error.status !== 401) throw error; }
    }
    user = null; csrf = ''; cache = empty(); sessionStorage.removeItem('hocvu-account');
}
export async function transact(fn, extra = {}) { if (!online)
    return demo.transact(fn); const before = structuredClone(read()), after = structuredClone(before); const result = fn(after); const changes = []; for (const key of Object.keys(before)) {
    if (!Array.isArray(before[key]) || key === 'audit')
        continue;
    const oldMap = new Map(before[key].map(x => [String(x.id), x])), newMap = new Map(after[key].map(x => [String(x.id), x]));
    for (const row of after[key]) {
        const old = oldMap.get(String(row.id));
        if (JSON.stringify(old) !== JSON.stringify(row))
            changes.push({ table: key, id: row.id, before: old || null, after: row });
    }
    for (const row of before[key])
        if (!newMap.has(String(row.id)))
            changes.push({ table: key, id: row.id, before: row, after: null });
} if (!changes.length)
    return result; try {
    await api('/changes', { method: 'POST', body: { revision: before.revision, changes, ...extra } });
}
catch (e) {
    if (e.status === 409)
        await refresh();
    throw e;
} await refresh(); return result; }
export async function upsert(table, item) { if (!online)
    return demo.upsert(table, item); const { temporaryPassword, ...safe } = item; const before = read()[table].find(x => x.id === item.id) || null; const changes = [{ table, id: item.id, before: table === 'accounts' && before && temporaryPassword ? { ...before, mustChange: false } : before, after: safe }]; const resource = { cohorts: '/cohorts', departments: '/departments',
        majors: '/majors', programs: '/programs', groups: '/student-groups',
        students: '/students' }[table];
    if (resource) {
        await api(resource + (before ? '/' + encodeURIComponent(before.id) : ''), {
            method: before ? 'PATCH' : 'POST',
            body: { revision: read().revision, before, after: safe }
        });
    } else {
        await api('/changes', { method: 'POST', body: { revision: read().revision, changes,
            ...(temporaryPassword ? { temporaryPassword } : {}) } });
    }
    await refresh(); return safe; }
export async function remove(table, id) { if (!online)
    return demo.remove(table, id); const before = read()[table].find(x => x.id === id); const path = { cohorts: '/cohorts', departments: '/departments',
        majors: '/majors', programs: '/programs', groups: '/student-groups' }[table];
    if (path) {
        await api(path + '/' + encodeURIComponent(id), {
            method: 'DELETE', body: { revision: read().revision, before }
        });
    } else {
        await api('/changes', { method: 'POST',
            body: { revision: read().revision, changes: [{ table, id, before, after: null }] } });
    }
    await refresh(); }
export function summary(db, studentId) { const value = demo.summary(db, studentId); if (online && db.academicSummary?.[studentId])
    return { ...value, ...db.academicSummary[studentId] }; return value; }
