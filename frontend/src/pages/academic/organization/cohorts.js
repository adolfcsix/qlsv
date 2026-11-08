import { esc } from '../../../components/ui.js';
import { renderOrganizationScreen } from './organization-common.js';
// Quản lý các khóa tuyển sinh. Mỗi khóa có thể có nhiều chương trình và lớp.
export function cohorts(ctx) {
    return renderOrganizationScreen(ctx, {
        tableName: 'cohorts',
        columns: ['MÃ KHÓA', 'TÊN KHÓA', 'NĂM TUYỂN SINH', 'CHƯƠNG TRÌNH'],
        cells: (item, { db }) => [`<strong>${esc(item.code)}</strong>`, esc(item.name), item.year, item.programCount ?? db.programs.filter(p => p.cohortId === item.id).length]
    });
}
