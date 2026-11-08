import { esc } from '../../components/ui.js';
// Chỉ dựng danh mục bộ lọc; quyền truy cập thực sự phải kiểm tra tại backend.
export function hierarchyOptions(db, filters = {}, user = null) {
    const visibleGroups = user?.role === 'lecturer'
        ? db.groups.filter(group => group.advisor === user.profileId) : db.groups;
    // Cán bộ vẫn phải thấy chương trình chưa có lớp để có thể tạo lớp mới.
    const visiblePrograms = user?.role === 'lecturer'
        ? db.programs.filter(p => visibleGroups.some(group => group.programId === p.id))
        : db.programs;
    const departments = (db.departments || []).filter(department => user?.role !== 'lecturer' || visiblePrograms.some(p => db.majors.some(m => m.id === p.majorId && m.departmentId === department.id)));
    const majors = (db.majors || []).filter(major => (!filters.department || major.departmentId === filters.department) &&
        (user?.role !== 'lecturer' || visiblePrograms.some(p => p.majorId === major.id)));
    const cohorts = (db.cohorts || []).filter(cohort => user?.role !== 'lecturer' || visiblePrograms.some(p => p.cohortId === cohort.id));
    const programs = visiblePrograms.filter(program => (!filters.cohort || program.cohortId === filters.cohort) &&
        (!filters.major || program.majorId === filters.major) &&
        (!filters.department || majors.some(m => m.id === program.majorId)));
    const groups = visibleGroups.filter(group => {
        const p = db.programs.find(p => p.id === group.programId);
        return p && (!filters.cohort || p.cohortId === filters.cohort) &&
            (!filters.major || p.majorId === filters.major) &&
            (!filters.department || majors.some(m => m.id === p.majorId)) &&
            (!filters.program || group.programId === filters.program);
    });
    return { cohorts, departments, majors, programs, groups };
}
export function hierarchySelect(key, label, options, selected = '') {
    return `<select data-filter="${esc(key)}" aria-label="${esc(label)}">
    <option value="">${esc(label)}</option>
    ${options.map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
  </select>`;
}
export function renderHierarchyFilters(db, filters = {}, user = null, keys = ['cohort', 'department', 'major', 'program', 'group']) {
    const list = hierarchyOptions(db, filters, user);
    const config = {
        cohort: ['Tất cả khóa', list.cohorts],
        department: ['Tất cả khoa', list.departments],
        major: ['Tất cả ngành', list.majors],
        program: ['Tất cả chương trình', list.programs],
        group: ['Tất cả lớp', list.groups]
    };
    return keys.map(key => hierarchySelect(key, ...config[key], filters[key])).join('');
}
