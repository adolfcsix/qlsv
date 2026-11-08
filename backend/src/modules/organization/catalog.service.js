import { ensure } from '../../core/errors.js';
import { listParameters } from './organization.service.js';
import { listCatalog } from './catalog.repository.js';

export const catalogPaths = Object.freeze({
    cohorts: 'cohorts', departments: 'departments', majors: 'majors', programs: 'programs'
});

export async function getCatalog(db, user, type, params) {
    ensure(['ACADEMIC_STAFF', 'ADMIN'].includes(user.role),
        'Không có quyền tra cứu danh mục này.', 403, 'FORBIDDEN');
    ensure(Object.hasOwn(catalogPaths, type), 'Danh mục không tồn tại.', 404);
    const query = listParameters(params);
    if (type === 'programs' && params.has('cohortId')) {
        const cohortId = params.get('cohortId');
        ensure(/^[1-9]\d*$/.test(cohortId), 'Bộ lọc cohortId không hợp lệ.');
        const row = await db.get('SELECT admission_year FROM cohorts WHERE cohort_id=?', [Number(cohortId)]);
        // Missing cohort yields no records, never silently removes the requested filter.
        if (!row) return { items: [], pagination: { page: query.page, limit: query.limit,
            total: 0, pages: 1 } };
        if (query.admissionYear != null && query.admissionYear !== row.admission_year)
            return { items: [], pagination: { page: query.page, limit: query.limit,
                total: 0, pages: 1 } };
        query.admissionYear = row.admission_year;
    }
    const { total, items } = await listCatalog(db, type, query);
    return { items, pagination: { page: query.page, limit: query.limit,
        total, pages: Math.max(1, Math.ceil(total / query.limit)) } };
}
