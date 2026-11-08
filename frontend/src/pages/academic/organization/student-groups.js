import { esc, link } from '../../../components/ui.js';
import { renderOrganizationScreen } from './organization-common.js';
// Lớp hành chính thuộc chương trình/khóa; không phải lớp học phần.
export function student_groups(ctx) {
    return renderOrganizationScreen(ctx, {
        tableName: 'groups',
        columns: ['LỚP HÀNH CHÍNH', 'KHÓA / NGÀNH', 'CHƯƠNG TRÌNH', 'CỐ VẤN', 'SĨ SỐ / TỐI ĐA'],
        cells: (item, { db }) => {
            const program = db.programs.find(p => p.id === item.programId);
            return [
                link(esc(item.name), `/academic/group/${item.id}`, 'table-link'),
                `${esc(db.cohorts.find(c => c.id === program?.cohortId)?.code)}<small>${esc(db.majors.find(m => m.id === program?.majorId)?.name)}</small>`,
                esc(program?.name),
                esc(item.advisorName || db.lecturers.find(l => l.id === item.advisor)?.name || 'Chưa phân công'),
                `${item.activeStudentCount ?? item.studentCount ?? db.students.filter(s => s.groupId === item.id && !['withdrawn','graduated'].includes(s.status)).length} / ${item.capacity ?? 50}`
            ];
        }
    });
}
