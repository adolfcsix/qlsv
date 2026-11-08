import { ensure, AppError } from './errors.js';
export async function readJson(req) {
    ensure((req.headers['content-type'] || '').startsWith('application/json'), 'API chỉ nhận JSON.', 415, 'CONTENT_TYPE');
    const chunks = [];
    let size = 0;
    for await (const part of req) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        size += chunk.length;
        ensure(size <= 131072, 'Nội dung yêu cầu quá lớn.', 413, 'PAYLOAD_TOO_LARGE');
        chunks.push(chunk);
    }
    let body;
    try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw new AppError(400, 'INVALID_JSON', 'JSON không hợp lệ.');
    }
    ensure(body !== null && typeof body === 'object' && !Array.isArray(body),
        'Nội dung JSON phải là một đối tượng.', 400, 'INVALID_BODY');
    return body;
}
