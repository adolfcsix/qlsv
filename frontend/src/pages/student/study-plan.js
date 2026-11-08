import { getContext } from '../../services/repository.js';
import { esc, link, empty, table, card, heading } from '../../components/ui.js';
import { onlinePlan } from '../../features/curriculum/progress-panel.js';
import { isOnline } from '../../services/repository.js';
import { resourceNotice } from '../../services/resource-pages.js';


export function plan(ctx) {
    const head = heading('KẾ HOẠCH HỌC TẬP', 'Chương trình học',
        'Theo dõi học phần bắt buộc, các nhóm tự chọn và điều kiện tiên quyết.',
        link('Đăng ký học phần', '/student/registration', 'btn primary'));
    if (isOnline()) {
        const remote = ctx.remoteCurriculumProgress;
        const reviews = ctx.remoteGraduationReviews;
        const approved = reviews?.state === 'ready' ? reviews.data.records : [];
        const decisions = reviews?.state === 'ready' ? card('Hồ sơ xét tốt nghiệp đã duyệt',
            'Đây là kết quả xét hồ sơ, không thay thế quyết định công nhận tốt nghiệp có hiệu lực.',
            approved.length ? approved.map(row => `<p>Hồ sơ #${esc(row.id)} · ${esc(row.approvedAt || '')} · ${esc(row.reviewNote || '')}</p>`).join('') :
            '<p class="muted">Chưa có hồ sơ xét được phê duyệt.</p>') : '';
        return head + (remote?.state === 'ready' ? onlinePlan(remote.data) : resourceNotice(remote || {state:'loading'})) + decisions;
    }
    const { db, user } = ctx;
    const student = db.students.find(s => s.id === user.profileId);
    const context = getContext(db, student);
    const subjects = db.curriculum?.filter(row => row.programId === context.program?.id) || [];
    return head + '<div class="notice">Chế độ minh họa ngoại tuyến: không tính tiến độ tốt nghiệp/GPA chính thức.</div>' +
        card('Chương trình minh họa', esc(context.program?.name || 'Chưa có chương trình'),
            subjects.length ? table(['HỌC PHẦN','LOẠI','KỲ GỢI Ý'],subjects.map(cs => [
                esc(db.subjects.find(s => s.id === cs.subjectId)?.name || '—'),
                cs.requirement_type === 'required' ? 'Bắt buộc' : 'Tự chọn', esc(cs.recommended_semester || '—')])) :
            empty('Chưa có danh mục','Vui lòng kết nối máy chủ để xem tiến độ từ dữ liệu thật.'));
}
