import { matches, pageSlice } from '../../../utils/view-model.js';
import { esc, icon, btn, link, heading, table } from '../../../components/ui.js';
import { pagination } from '../../_shared.js';
import { renderHierarchyFilters } from '../../../features/organization/hierarchy-filter.js';
import { paginatedRows, resourceNotice } from '../../../services/resource-pages.js';
// Một bảng dùng chung, nhưng nội dung mỗi phân hệ được định nghĩa tại file riêng.
export const organizationTabs = [
    ['cohorts', 'Khóa tuyển sinh'], ['departments', 'Khoa'], ['majors', 'Ngành đào tạo'],
    ['programs', 'Chương trình'], ['groups', 'Lớp hành chính']
];
export function rowActions(tableName, item) {
    return `<div class="row-actions">${btn('Sửa', 'edit-org', 'small', 'aria-label="Sửa ' + esc(item.code) + '" data-table="' + tableName + '" data-id="' + item.id + '"')}${btn('Xóa', 'delete-org', 'small danger-text', 'aria-label="Xóa ' + esc(item.code) + '" data-table="' + tableName + '" data-id="' + item.id + '"')}</div>`;
}
export function renderOrganizationScreen(ctx, { tableName, columns, cells }) {
    const { db, filters } = ctx;
    const title = organizationTabs.find(([id]) => id === tableName)?.[1] || tableName;
    const remote = ctx.remoteList || null;
    let list = remote ? (remote.state === 'ready' ? remote.data.items : []) : [...(db[tableName] || [])];
    if (!remote && ['programs', 'groups'].includes(tableName)) {
        list = list.filter(item => {
            const p = tableName === 'programs' ? item : db.programs.find(p => p.id === item.programId);
            return (!filters.cohort || p?.cohortId === filters.cohort) && (!filters.major || p?.majorId === filters.major) && (!filters.department || db.majors.some(m => m.id === p?.majorId && m.departmentId === filters.department)) && (!filters.program || p?.id === filters.program);
        });
    }
    if (!remote && filters.search)
        list = list.filter(item => matches(`${item.name} ${item.code}`, filters.search));
    const page = remote?.state === 'ready' ? paginatedRows({ ...remote.data, items: list }) : pageSlice(list, filters, 10);
    const controls = `<div class="filter-bar"><div class="search-field">${icon('search')}<input data-filter="search" value="${esc(filters.search || '')}" placeholder="Tìm mã hoặc tên…" aria-label="Tìm danh mục"></div>${['programs', 'groups'].includes(tableName) ? renderHierarchyFilters(db, filters, null, tableName === 'groups' ? ['cohort', 'department', 'major', 'program'] : ['cohort', 'department', 'major']) : ''}${btn('Xóa bộ lọc', 'clear-filters', 'text-button')}<span class="count-label">${remote?.state === 'ready' ? remote.data.pagination.total : list.length} ${title.toLocaleLowerCase('vi-VN')}</span></div>`;
    const tabs = `<nav class="tabs" aria-label="Danh mục đào tạo">${organizationTabs.map(([id, label]) => link(label, '/academic/organization/' + id, id === tableName ? 'active' : '')).join('')}</nav>`;
    return heading('CÁN BỘ / TỔ CHỨC ĐÀO TẠO', 'Khóa, khoa, ngành & lớp', 'Khoa → Ngành → Chương trình theo khóa → Lớp hành chính.', btn(icon('plus') + ' Thêm ' + title.toLocaleLowerCase('vi-VN'), 'new-org', 'primary', 'data-table="' + tableName + '"')) +
        `<div class="notice">${icon('layers')}<p><strong>Khoa → Ngành → Chương trình theo khóa → Lớp hành chính.</strong><br>Khoa và ngành dùng chung qua các khóa. Lớp học phần được tổ chức riêng theo môn và học kỳ.</p></div>` +
        tabs + `<section class="card">${controls}${remote && remote.state !== 'ready' ? resourceNotice(remote) : table([...columns, 'THAO TÁC'], page.rows.map(item => [...cells(item, ctx), rowActions(tableName, item)])) + pagination(page)}</section>`;
}
