import { esc } from '../../../components/ui.js';
import { renderOrganizationScreen } from './organization-common.js';
// Một khoa quản lý nhiều ngành; đổi tên không làm đổi mã hay quan hệ.
export function faculties(ctx) {
    return renderOrganizationScreen(ctx, {
        tableName: 'departments',
        columns: ['MÃ KHOA', 'TÊN KHOA', 'SỐ NGÀNH'],
        cells: (item, { db }) => [`<strong>${esc(item.code)}</strong>`, esc(item.name), item.majorCount ?? db.majors.filter(m => m.departmentId === item.id).length]
    });
}
