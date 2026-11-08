// Các danh mục được khai báo cố định. Không nhận tên bảng/cột SQL từ client.
const definitions = Object.freeze({
    lecturers: {
        from: 'lecturers l', id: 'l.lecturer_id', code: 'l.lecturer_code', name: 'l.full_name',
        order: 'l.lecturer_code', filters: { departmentId: 'l.department_id' }
    },
    subjects: {
        from: 'subjects s', id: 's.subject_id', code: 's.subject_code', name: 's.name',
        order: 's.subject_code', filters: { departmentId: 's.department_id' }
    },
    classes: {
        from: 'classes c JOIN subjects s ON s.subject_id=c.subject_id',
        id: 'c.class_id', code: 'c.class_code', name: 's.name',
        extra: 'c.semester_id AS semesterId', order: 'c.class_code',
        filters: { semesterId: 'c.semester_id' }
    }
});

export const lookupTypes = Object.freeze([
    'cohorts', 'departments', 'majors', 'programs', 'groups', ...Object.keys(definitions)
]);

function escapeLike(term) { return term.replace(/[!%_]/g, '!$&'); }

export async function findLookupRows(db, type, query) {
    const def = definitions[type];
    const where = [], args = [];
    for (const [key, column] of Object.entries(def.filters)) {
        if (query[key] == null) continue;
        where.push(`${column}=?`);
        args.push(query[key]);
    }
    if (query.search) {
        const columns = [def.code, def.name].map(column => db.driver === 'sqlite'
            ? `QLSV_NORMALIZE(${column})` : column);
        where.push('(' + columns.map(column => `${column} LIKE ? ESCAPE '!'`).join(' OR ') + ')');
        const term = '%' + escapeLike(db.driver === 'sqlite' ? query.normalized : query.search) + '%';
        args.push(term, term);
    }
    const condition = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const row = await db.get(`SELECT COUNT(*) AS total FROM ${def.from}${condition}`, args);
    const items = await db.all(`SELECT ${def.id} AS id, ${def.code} AS code, ${def.name} AS name${def.extra ? ', ' + def.extra : ''}
        FROM ${def.from}${condition} ORDER BY ${def.order} LIMIT ? OFFSET ?`,
    [...args, query.limit, query.offset]);
    return { total: Number(row.total), items: items.map(item => ({ ...item, id: String(item.id) })) };
}
