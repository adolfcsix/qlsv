import { esc } from '../../../components/ui.js';
import { renderOrganizationScreen } from './organization-common.js';
// Chương trình được gắn đồng thời với một ngành và một khóa.
export function programs(ctx) {
    return renderOrganizationScreen(ctx, {
        tableName: 'programs',
        columns: ['CHƯƠNG TRÌNH', 'NGÀNH', 'KHÓA', 'TÍN CHỈ', 'LỚP'],
        cells: (item, { db }) => [`<strong>${esc(item.name)}</strong><small>${esc(item.code)}</small>`, esc(item.major || db.majors.find(m => m.id === item.majorId)?.name), esc(item.cohort || db.cohorts.find(c => c.id === item.cohortId)?.code), item.credits, item.groupCount ?? db.groups.filter(g => g.programId === item.id).length]
    });
}
