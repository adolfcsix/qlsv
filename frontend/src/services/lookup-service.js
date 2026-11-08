// Danh mục phục vụ select: không lấy dữ liệu online từ snapshot /state.
import { api, isOnline, read } from './repository.js';

const cache = new Map();
export function clearLookupCache() { cache.clear(); }

function label(row, type) {
    const main = row.name && row.name !== row.code ? `${row.code} · ${row.name}` : row.code;
    return type === 'programs' && row.admissionYear ? `${main} (${row.admissionYear})` : main;
}

export async function getLookupOptions(type, placeholder = '', filters = {}) {
    if (!isOnline()) {
        const db = read();
        const rows = (db[type] || []).filter(row => {
            const program = type === 'groups' ? db.programs.find(p => p.id === row.programId) :
                type === 'programs' ? row : null;
            const major = program ? db.majors.find(m => m.id === program.majorId) : null;
            return Object.entries(filters).every(([key, value]) => {
                if (value === '' || value == null) return true;
                const expected = String(value);
                if (key === 'departmentId') return String(type === 'majors' ? row.departmentId :
                    major?.departmentId) === expected;
                if (key === 'majorId') return String(program?.majorId) === expected;
                if (key === 'cohortId') return String(program?.cohortId) === expected;
                if (key === 'programId') return String(row.programId) === expected;
                return false;
            });
        });
        return [...(placeholder ? [['', placeholder]] : []),
            ...rows.map(row => [String(row.id), label(row, type)])];
    }
    const params = new URLSearchParams(Object.entries(filters)
        .filter(([, value]) => value !== '' && value != null));
    const key = `${type}?${params.toString()}`;
    if (!cache.has(key)) {
        const promise = (async () => {
            const options = [];
            for (let page = 1; page <= 10; page++) {
                const query = new URLSearchParams(params);
                query.set('page', page);
                query.set('limit', '100');
                const { items, pagination } = await api(`/lookups/${encodeURIComponent(type)}?${query}`);
                options.push(...items.map(item => [item.id, label(item, type)]));
                if (page >= pagination.pages) return options;
            }
            throw new Error('Danh mục quá lớn để chọn trực tiếp. Vui lòng sử dụng bộ lọc hẹp hơn.');
        })().catch(err => { cache.delete(key); throw err; });
        cache.set(key, promise);
    }
    const rows = await cache.get(key);
    return [...(placeholder ? [['', placeholder]] : []), ...rows];
}
