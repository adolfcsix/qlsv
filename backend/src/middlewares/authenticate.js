import { authenticate } from '../modules/auth/auth.service.js';
import { ensure } from '../core/errors.js';
export async function requireSession(db, req) {
    const user = await authenticate(db, req);
    ensure(user, 'Phiên đăng nhập đã hết hạn.', 401, 'UNAUTHENTICATED');
    return user;
}
