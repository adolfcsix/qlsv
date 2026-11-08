import { esc } from '../../../components/ui.js';
import { renderOrganizationScreen } from './organization-common.js';
// Ngành thuộc một khoa nhưng có chương trình theo từng khóa tuyển sinh.
export function majors(ctx) {
    return renderOrganizationScreen(ctx, {
        tableName: 'majors',
        columns: ['MÃ NGÀNH', 'TÊN NGÀNH', 'KHOA QUẢN LÝ'],
        cells: (item, { db }) => [`<strong>${esc(item.code)}</strong>`, esc(item.name), esc(item.department || db.departments.find(d => d.id === item.departmentId)?.name)]
    });
}
