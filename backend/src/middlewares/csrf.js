import { ensure } from '../core/errors.js';
export function checkWriteRequest(req, method, user) {
    if (['GET', 'HEAD'].includes(method))
        return;
    if (req.headers.origin) {
        const origin = process.env.APP_ORIGIN || `http://${req.headers.host}`;
        ensure(req.headers.origin === origin, 'Nguồn yêu cầu không được phép.', 403, 'ORIGIN_REJECTED');
    }
    if (user)
        ensure(req.headers['x-csrf-token'] === user.csrf_token, 'Phiên thao tác không hợp lệ. Tải lại trang.', 403, 'CSRF_REJECTED');
}
