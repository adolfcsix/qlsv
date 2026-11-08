import { ensure } from '../../core/errors.js';
import { getStudentGroups, listParameters } from '../organization/organization.service.js';
import { getCatalog } from '../organization/catalog.service.js';
import { findLookupRows, lookupTypes } from './lookups.repository.js';

export async function getLookup(db, user, type, params) {
    ensure(['ACADEMIC_STAFF', 'ADMIN'].includes(user.role),
        'Không có quyền truy cập danh mục biểu mẫu.', 403, 'FORBIDDEN');
    ensure(lookupTypes.includes(type), 'Danh mục không tồn tại.', 404, 'NOT_FOUND');
    const query = listParameters(params);
    const extraInteger = key => {
        const value = params.get(key);
        if (!value) return null;
        ensure(/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)),
            `Bộ lọc ${key} không hợp lệ.`);
        return Number(value);
    };
    query.programId = extraInteger('programId');
    query.semesterId = extraInteger('semesterId');
    const cohortId = extraInteger('cohortId');
    if (cohortId != null && (type === 'programs' || type === 'groups')) {
        const cohort = await db.get('SELECT admission_year FROM cohorts WHERE cohort_id=?', [cohortId]);
        if (!cohort || query.admissionYear != null && query.admissionYear !== cohort.admission_year)
            return { items: [], pagination: { page: query.page, limit: query.limit, total: 0, pages: 1 } };
        query.admissionYear = cohort.admission_year;
    }
    // Không âm thầm bỏ qua bộ lọc không áp dụng cho danh mục được chọn.
    const permitted = {
        cohorts: [], departments: [], majors: ['departmentId'],
        programs: ['departmentId', 'majorId', 'admissionYear', 'cohortId'],
        groups: ['departmentId', 'majorId', 'admissionYear', 'cohortId', 'programId'],
        lecturers: ['departmentId'], subjects: ['departmentId'], classes: ['semesterId']
    }[type];
    for (const key of ['departmentId', 'majorId', 'admissionYear', 'cohortId', 'programId', 'semesterId'])
        ensure(!params.has(key) || permitted.includes(key), `Không hỗ trợ lọc ${key} cho danh mục này.`);
    // Dùng lại bộ truy vấn danh mục và lớp hành chính, tránh hai bộ SQL đồng nghĩa.
    if (['cohorts', 'departments', 'majors', 'programs'].includes(type))
        return getCatalog(db, user, type, params);
    if (type === 'groups') {
        const filters = new URLSearchParams(params);
        if (query.programId != null) filters.set('curriculumId', String(query.programId));
        if (query.admissionYear != null) filters.set('admissionYear', String(query.admissionYear));
        const result = await getStudentGroups(db, user, filters);
        return { ...result, items: result.items.map(row => ({
            ...row, id: String(row.id), code: row.code, name: row.name
        })) };
    }
    const { total, items } = await findLookupRows(db, type, query);
    return { items, pagination: { page: query.page, limit: query.limit, total,
        pages: Math.max(1, Math.ceil(total / query.limit)) } };
}
