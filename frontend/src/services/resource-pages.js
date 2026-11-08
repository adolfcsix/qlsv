// Paginated server lists are independent of /state, which still serves other screens.
// This module knows only query parameters and loading state; no DOM and no SQL.

import { weekRange } from '../utils/view-model.js';

const organizationResources = new Set(['cohorts', 'departments', 'majors', 'programs', 'groups']);

export function resourceQuery(type, filters, db) {
    if(type==='admin-calendar')return '/admin/calendar';
    if(['admin-overview','admin-personnel','admin-rooms'].includes(type)) {
        const params=new URLSearchParams({page:String(filters.page||1),limit:'20'});
        if(filters.search)params.set('search',filters.search.trim());
        if(type==='admin-overview') {
            params.set('kind',filters.overviewKind||'students');if(filters.overviewIssue)params.set('issue',filters.overviewIssue);
            for(const [key,param] of Object.entries({overviewCohort:'cohortId',overviewDepartment:'departmentId',overviewMajor:'majorId',overviewGroup:'groupId'}))if(filters[key])params.set(param,filters[key]);
        }
        if(type==='admin-personnel'){params.set('type',filters.type);if(filters.personnelDepartment)params.set('departmentId',filters.personnelDepartment);}
        if(type==='admin-rooms'&&filters.roomEnabled)params.set('enabled',filters.roomEnabled);
        const path={'admin-overview':'overview','admin-personnel':'personnel','admin-rooms':'rooms'}[type];
        return `/admin/${path}?${params}`;
    }
    if (type === 'staff-scheduling') {
        const params = new URLSearchParams();
        const cohort = db.cohorts.find(c=>c.id===filters.scheduleCohort);
        if(cohort)params.set('cohort',cohort.year);
        for(const [name,key] of Object.entries({scheduleDepartment:'department',scheduleMajor:'major',scheduleGroup:'group',classId:'classId'}))if(filters[name])params.set(key,filters[name]);
        return `/staff/scheduling?${params}`;
    }
    if (type === 'registration-requests') {
        const params=new URLSearchParams({page:String(filters.requestPage || 1)});
        if(filters.requestStatus)params.set('status',filters.requestStatus);
        return `/enrollment-requests?${params}`;
    }
    if (type === 'timetable') return `/timetable?start=${weekRange(Number(filters.week || 0)).start}`;
    if (type === 'my-enrollments') return '/enrollments';
    if (type === 'curriculum-versions') return `/curriculum-versions?curriculumId=${encodeURIComponent(filters.curriculumId)}`;
    if (type === 'credit-recognitions') return `/credit-recognitions?studentId=${encodeURIComponent(filters.studentId || '')}`;
    if (type === 'recognition-candidates') return `/credit-recognitions/candidates?studentId=${encodeURIComponent(filters.studentId)}`;
    if (type === 'graduation-reviews') return filters.studentId ?
        `/graduation-reviews?studentId=${encodeURIComponent(filters.studentId)}` : '/graduation-reviews';
    if (type === 'curriculum-plan') return `/curriculum-plan?curriculumId=${encodeURIComponent(filters.curriculumId)}`;
    if (type === 'curriculum-progress') return filters.studentId ? `/curriculum-progress?studentId=${encodeURIComponent(filters.studentId)}` : '/curriculum-progress';
    if (type === 'academic-semesters') return '/academic-semesters';
    if (type === 'semester-summaries') return `/semester-summaries?studentId=${encodeURIComponent(filters.studentId)}`;
    if (type === 'academic-warnings') return `/academic-warnings?studentId=${encodeURIComponent(filters.studentId)}`;
    if (type === 'summary-preview') return `/semester-summaries/preview?studentId=${encodeURIComponent(filters.studentId)}&semesterId=${encodeURIComponent(filters.semesterId)}`;
    if (type === 'gradebook') return `/classes/${encodeURIComponent(filters.classId)}/gradebook`;
    if (type === 'grade-changes') return `/grade-change-requests?classId=${encodeURIComponent(filters.classId)}`;
    if (type === 'course-sections' || type === 'registration-sections') {
        const params = new URLSearchParams({
            page: String(Math.max(1, Math.floor(Number(filters.page) || 1))), limit: '10'
        });
        if (filters.search) params.set('search', filters.search.trim());
        if (type === 'registration-sections') params.set('status', 'open');
        return `/course-sections?${params}`;
    }
    const params = new URLSearchParams();
    const limit = type === 'students' ? 8 : 10;
    const year = db.cohorts.find(item => String(item.id) === String(filters.cohort))?.year;
    if (year) params.set('admissionYear', year);
    // Each catalog accepts only the filters that have meaning for it.
    const filterMap = {
        cohorts: {}, departments: {}, majors: { department: 'departmentId' },
        programs: { department: 'departmentId', major: 'majorId' },
        groups: { department: 'departmentId', major: 'majorId', program: 'curriculumId' },
        students: { department: 'departmentId', major: 'majorId', program: 'curriculumId', group: 'groupId' }
    };
    for (const [name, param] of Object.entries(filterMap[type] || {}))
        if (filters[name]) params.set(param, filters[name]);
    if (filters.search) params.set('search', filters.search.trim());
    if (type === 'students' && filters.status) params.set('status', filters.status);
    params.set('page', Math.max(1, Math.floor(Number(filters.page) || 1)));
    params.set('limit', limit);
    const path = type === 'groups' ? 'student-groups' :
        organizationResources.has(type) ? type : 'students';
    return `/${path}?${params}`;
}

export function createResourcePages(request, onComplete) {
    const pages = new Map();
    return {
        get(type, filters, db) {
            const route = resourceQuery(type, filters, db);
            const current = pages.get(route);
            if (current) return current;
            // Prevent a long editing session with many searches retaining every page.
            if (pages.size >= 20) pages.delete(pages.keys().next().value);
            const pending = { state: 'loading' };
            pages.set(route, pending);
            request(route).then(data => {
                if (pages.get(route) !== pending) return;
                pages.set(route, { state: 'ready', data });
                onComplete();
            }).catch(error => {
                if (pages.get(route) !== pending) return;
                pages.set(route, { state: 'error', message: error.message });
                onComplete();
            });
            return pending;
        },
        clear() { pages.clear(); }
    };
}

export function paginatedRows(result) {
    const { items, pagination } = result;
    const { page, pages, total, limit } = pagination;
    return { rows: items, page, pages, total,
        from: total ? (page - 1) * limit + 1 : 0,
        to: Math.min(page * limit, total) };
}

export function resourceNotice(resource) {
    if (resource.state === 'error')
        return `<div class="notice" role="alert">Không tải được danh sách. ${String(resource.message || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))} <button type="button" class="btn" data-action="retry-resource">Thử lại</button></div>`;
    return '<div class="notice" role="status">Đang tải danh sách từ máy chủ…</div>';
}
