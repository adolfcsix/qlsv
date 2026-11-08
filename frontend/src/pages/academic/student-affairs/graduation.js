import { esc, heading, card, table, btn, empty, badge } from '../../../components/ui.js';
import { isOnline } from '../../../services/repository.js';
import { resourceNotice } from '../../../services/resource-pages.js';

// Both decisions are separate: academic credit recognition is not a GPA change;
// an approved graduation review is not an automatic graduation status.
export function graduation(ctx) {
    const title = heading('CÁN BỘ / CÔNG TÁC SINH VIÊN', 'Công nhận & xét tốt nghiệp',
        'Đối chiếu kết quả học tập, hồ sơ tương đương và điều kiện bổ sung trước khi trình duyệt.');
    if (!isOnline()) return title + '<div class="notice">Chức năng này cần dữ liệu backend, không chạy với hồ sơ minh họa.</div>';
    return graduationOnline(ctx, title);
}

// Exported to test HTML escaping and view states without a simulated browser login.
export function graduationOnline(ctx, title = '') {
    const selected = ctx.graduationStudentId;
    const options = (ctx.db.students || []).map(student =>
        `<option value="${esc(student.id)}" ${String(student.id)===String(selected)?'selected':''}>${esc(student.code)} · ${esc(student.name)}</option>`).join('');
    const select = `<section class="card pad"><label>Chọn sinh viên để xét<select data-filter="graduationStudentId"><option value="">Chọn sinh viên</option>${options}</select></label></section>`;
    if (!selected) return title + select + '<div class="notice">Chọn sinh viên để xem hồ sơ.</div>';
    const progress = ctx.remoteCurriculumProgress;
    const readiness = progress?.state==='ready' ? progress.data : null;
    const explanation = readiness ? `<p><strong>${esc(readiness.student.code)} · ${esc(readiness.student.name)}</strong> — ${esc(readiness.program.name)}</p>
        <p>Tín chỉ được công nhận: <strong>${esc(readiness.earnedCredits)}/${esc(readiness.requiredCredits)}</strong>.
        Môn bắt buộc còn thiếu: ${esc(readiness.requiredOutstanding)}. Nhóm tự chọn còn thiếu: ${esc(readiness.unmetElectives)}.</p>
        <p>${readiness.readyForManualReview?'Đủ điều kiện sơ bộ về học phần để lập hồ sơ kiểm tra.':'Chưa đủ điều kiện sơ bộ về học phần; không được tự duyệt tốt nghiệp.'}</p>` :
        resourceNotice(progress || {state:'loading'});
    const candidates = ctx.remoteRecognitionCandidates;
    const r = ctx.remoteCreditRecognitions;
    const recognitions = r?.state==='ready' ? r.data.records : [];
    const recognitionRows = recognitions.map(item => [esc(item.decisionNumber),
        `${esc(item.sourceCode)} → ${esc(item.targetCode)}`,esc(item.decisionDate),
        item.revokedAt?badge('cancelled','Đã thu hồi'):badge('passed','Hiệu lực'),
        item.revokedAt?'—':btn('Thu hồi','recognition-revoke','small danger-text',`data-id="${esc(item.id)}"`)]);
    const records = ctx.remoteGraduationReviews;
    const reviews = records?.state==='ready' ? records.data.records : [];
    const reviewRows = reviews.map(item => [esc(item.id),esc(item.createdAt),
        item.status==='approved'?badge('passed','Đã duyệt'):item.status==='rejected'?badge('cancelled','Từ chối'):badge('draft','Dự thảo'),
        esc(item.reviewNote || '—'),
        item.status==='draft' ? `<div class="row-actions">${btn('Duyệt','graduation-review-approve','small',`data-id="${esc(item.id)}"`)}${btn('Từ chối','graduation-review-reject','small danger-text',`data-id="${esc(item.id)}"`)}</div>` : '—']);
    return title + select +
        card('Đối chiếu tiến độ', 'Kết quả học lại và công nhận tương đương chỉ được tính một lần; không suy ra GPA.', explanation) +
        card('Quyết định công nhận học phần tương đương',
            'Mỗi quyết định gắn một kết quả nguồn đã công bố và một học phần đích trong chương trình.',
            (candidates?.state==='ready' && candidates.data.sources.length && candidates.data.targets.length ?
                btn('Công nhận tương đương','recognition-create','primary') : '')+
            (r?.state!=='ready' ? resourceNotice(r || {state:'loading'}) : recognitions.length ?
                table(['QUYẾT ĐỊNH','MÔN NGUỒN → ĐÍCH','NGÀY','TRẠNG THÁI','THAO TÁC'], recognitionRows) :
                empty('Chưa có quyết định','Chỉ công nhận khi có đủ hồ sơ đối chiếu và số quyết định.'))) +
        card('Hồ sơ xét tốt nghiệp',
            'Cần tổng kết học kỳ đã duyệt, bằng chứng rèn luyện, kỷ luật, chứng chỉ và điều kiện bổ sung. Duyệt hồ sơ không tự chuyển trạng thái tốt nghiệp.',
            (readiness?.readyForManualReview && !reviews.some(review=>['draft','approved'].includes(review.status)) ?
                btn('Lập hồ sơ xét','graduation-review-create','primary') : '')+
            (records?.state!=='ready' ? resourceNotice(records || {state:'loading'}) : reviews.length ?
                table(['MÃ','NGÀY LẬP','TRẠNG THÁI','GHI CHÚ','THAO TÁC'],reviewRows) :
                empty('Chưa có hồ sơ','Lập hồ sơ khi tiến độ học phần đủ điều kiện sơ bộ.')));
}
