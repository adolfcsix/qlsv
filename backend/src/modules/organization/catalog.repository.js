// Only these predefined catalog definitions can produce SQL identifiers.
// Client input is always passed as bound parameters, never concatenated into SQL.
const catalogs = {
    cohorts: {
        from: 'FROM cohorts c',
        columns: `c.cohort_id AS id, c.code, c.name, c.admission_year AS year,
          (SELECT COUNT(*) FROM curricula p WHERE p.admission_year=c.admission_year) AS programCount`,
        search: ['c.code', 'c.name'], filters: { admissionYear: 'c.admission_year' },
        order: 'c.admission_year DESC, c.code'
    },
    departments: {
        from: 'FROM departments d',
        columns: `d.department_id AS id, d.department_code AS code, d.name,
          (SELECT COUNT(*) FROM majors m WHERE m.department_id=d.department_id) AS majorCount`,
        search: ['d.department_code', 'd.name'], filters: {}, order: 'd.department_code'
    },
    majors: {
        from: 'FROM majors m JOIN departments d ON d.department_id=m.department_id',
        columns: `m.major_id AS id, m.major_code AS code, m.name,
          m.department_id AS departmentId, d.name AS department,
          (SELECT COUNT(*) FROM curricula p WHERE p.major_id=m.major_id) AS programCount`,
        search: ['m.major_code', 'm.name'], filters: { departmentId: 'm.department_id' },
        order: 'm.major_code'
    },
    programs: {
        from: `FROM curricula p
          JOIN majors m ON m.major_id=p.major_id
          JOIN departments d ON d.department_id=m.department_id
          LEFT JOIN cohorts c ON c.admission_year=p.admission_year`,
        columns: `p.curriculum_id AS id, p.code, p.name, p.required_credits AS credits,
          p.major_id AS majorId, m.name AS major, m.department_id AS departmentId,
          d.name AS department, p.admission_year AS admissionYear,
          c.cohort_id AS cohortId, c.code AS cohort,
          (SELECT COUNT(*) FROM student_groups g WHERE g.curriculum_id=p.curriculum_id) AS groupCount`,
        search: ['p.code', 'p.name'],
        filters: { admissionYear: 'p.admission_year', departmentId: 'm.department_id', majorId: 'p.major_id' },
        order: 'p.admission_year DESC, p.code'
    }
};

function likeTerm(value) {
    return '%' + value.replace(/[!%_]/g, '!$&') + '%';
}

export async function listCatalog(db, type, query) {
    const def = catalogs[type];
    if (!def) throw new Error('Danh mục không tồn tại.');
    const where = [], args = [];
    for (const [key, column] of Object.entries(def.filters)) {
        if (query[key] != null) {
            where.push(`${column}=?`);
            args.push(query[key]);
        }
    }
    if (query.search) {
        const fields = def.search.map(field => db.driver === 'sqlite'
            ? `QLSV_NORMALIZE(${field})` : field);
        where.push('(' + fields.map(field => `${field} LIKE ? ESCAPE '!'`).join(' OR ') + ')');
        for (let i = 0; i < fields.length; i++)
            args.push(likeTerm(db.driver === 'sqlite' ? query.normalized : query.search));
    }
    const condition = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const count = await db.get(`SELECT COUNT(*) AS total ${def.from}${condition}`, args);
    const items = await db.all(`SELECT ${def.columns} ${def.from}${condition}
        ORDER BY ${def.order} LIMIT ? OFFSET ?`, [...args, query.limit, query.offset]);
    return { total: Number(count.total), items: items.map(item => ({ ...item,
        id: String(item.id),
        ...(item.majorId != null ? { majorId: String(item.majorId) } : {}),
        ...(item.departmentId != null ? { departmentId: String(item.departmentId) } : {}),
        ...(item.cohortId != null ? { cohortId: String(item.cohortId) } : {})
    })) };
}
