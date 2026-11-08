import { ensure } from '../../core/errors.js';
import { hashPassword, verifyPassword, login } from './auth.service.js';
import { writeAudit } from '../audit/audit.service.js';
import { snapshot } from '../reports/snapshot.service.js';
export function sessionCookie(token, expired = false) {
    const attrs = [`qlsv_session=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${expired ? 0 : 28800}`];
    if (process.env.NODE_ENV === 'production')
        attrs.push('Secure');
    return attrs.join('; ');
}
export async function handleLogin(ctx) {
    if (ctx.route !== '/api/v1/auth/login' || ctx.method !== 'POST')
        return false;
    ctx.limit(ctx.req.socket.remoteAddress + ':login', 10);
    const body = await ctx.body();
    const session = await ctx.db.tx(() => login(ctx.db, body.username, body.password));
    ctx.res.setHeader('Set-Cookie', sessionCookie(session.token));
    ctx.json(200, { data: { csrf: session.csrf } });
    return true;
}
export async function handleAuth(ctx) {
    const { route, method, db, user, res } = ctx;
    if (route === '/api/v1/auth/logout' && method === 'POST') {
        await db.run('DELETE FROM sessions WHERE token_hash=?', [user.token_hash]);
        res.setHeader('Set-Cookie', sessionCookie('', true));
        ctx.json(200, { data: { ok: true } });
        return true;
    }
    if (route === '/api/v1/auth/me' && method === 'GET') {
        const state = await db.tx(() => snapshot(db, user));
        ctx.json(200, { data: { user: state.accounts.find(a => Number(a.id) === user.user_id), csrf: user.csrf_token } });
        return true;
    }
    if (route === '/api/v1/auth/password' && method === 'POST') {
        const body = await ctx.body();
        ensure(typeof body.password === 'string' && body.password.length >= 10 && body.password.length <= 128 && body.password !== body.current, 'Mật khẩu mới cần từ 10 đến 128 ký tự và khác mật khẩu cũ.');
        const account = await db.get('SELECT password_hash FROM users WHERE user_id=?', [user.user_id]);
        ensure(typeof body.current === 'string' && body.current.length <= 128 && await verifyPassword(body.current, account.password_hash), 'Mật khẩu hiện tại chưa đúng.', 422);
        const hash = await hashPassword(body.password);
        await db.tx(async () => {
            await db.update('users', 'user_id', user.user_id, { password_hash: hash });
            await db.update('user_security', 'user_id', user.user_id, { must_change_password: 0 });
            await db.run('DELETE FROM sessions WHERE user_id=?', [user.user_id]);
            await writeAudit(db, user, 'CHANGE_PASSWORD', 'users', user.user_id);
        });
        res.setHeader('Set-Cookie', sessionCookie('', true));
        ctx.json(200, { data: { loginRequired: true } });
        return true;
    }
    return false;
}
