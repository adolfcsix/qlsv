import { ensure } from '../core/errors.js';
export function createRateLimiter() {
    const hits = new Map();
    return function limit(key, max = 40) {
        const now = Date.now(), record = hits.get(key) || { count: 0, start: now };
        if (now - record.start > 60000) {
            record.count = 0;
            record.start = now;
        }
        record.count++;
        hits.set(key, record);
        if (hits.size > 5000)
            for (const [k, v] of hits)
                if (now - v.start > 60000)
                    hits.delete(k);
        ensure(record.count <= max, 'Quá nhiều yêu cầu. Vui lòng thử lại sau một phút.', 429, 'RATE_LIMITED');
    };
}
