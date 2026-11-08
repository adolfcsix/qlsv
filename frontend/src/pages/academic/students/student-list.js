import { statuses } from '../../../demo/data.js';
import { filteredStudents, pageSlice } from '../../../utils/view-model.js';
import { getContext } from '../../../services/repository.js';
import { esc, icon, btn, link, person, badge, table, heading } from '../../../components/ui.js';
import { pagination, filterSelect } from '../../_shared.js';
import { renderHierarchyFilters } from '../../../features/organization/hierarchy-filter.js';
import { paginatedRows, resourceNotice } from '../../../services/resource-pages.js';
export function students(ctx) {
    const { db, user, filters } = ctx;
    const remote = ctx.remoteList;
    const list = remote ? remote.state === 'ready' ? remote.data.items.map(item => ({
        ...item, id: String(item.id), groupId: String(item.groupId)
    })) : [] : filteredStudents(ctx);
    const page = remote?.state === 'ready' ? paginatedRows({ ...remote.data, items: list }) : pageSlice(list, filters);
    const stateOptions = Object.entries(statuses)
        .filter(([key]) => ['studying', 'on_leave', 'suspended', 'withdrawn', 'graduated'].includes(key))
        .map(([id, name]) => ({ id, name }));
    const filtersHtml = `<div class="filter-bar">
    <div class="search-field">${icon('search')}
      <input aria-label="Tìm sinh viên" data-filter="search"
        placeholder="Mã sinh viên hoặc họ tên, có hoặc không dấu…" value="${esc(filters.search || '')}">
    </div>
    ${renderHierarchyFilters(db, filters, user)}
    ${filterSelect('status', 'Tất cả trạng thái', stateOptions, filters.status)}
    ${btn('Xóa bộ lọc', 'clear-filters', 'text-button')}
  </div>`;
    const headingHtml = heading('HỒ SƠ SINH VIÊN', user.role === 'lecturer' ? 'Lớp cố vấn' : 'Sinh viên', 'Tra cứu theo khóa, khoa, ngành, chương trình, lớp và trạng thái học tập.', `${btn(icon('download') + ' Xuất kết quả lọc', 'export-students')}${user.role === 'academic' ? btn(icon('plus') + ' Thêm sinh viên', 'new-student', 'primary') : ''}`);
    return headingHtml + `<section class="card">${filtersHtml}${remote && remote.state !== 'ready' ? resourceNotice(remote) : table([
        'SINH VIÊN', 'LỚP HÀNH CHÍNH', 'NGÀNH / KHÓA', 'TRẠNG THÁI', ''
    ], page.rows.map(s => {
        const context = getContext(db, s);
        return [person(s), esc(context.group?.name),
            `${esc(context.major?.name)}<small>${esc(context.cohort?.code)}</small>`,
            badge(s.status), link('Mở hồ sơ ' + icon('arrow'), `/${user.role}/profile/${s.id}/overview`, 'btn small')];
    })) + pagination(page, 'hồ sơ')}</section>`;
}
