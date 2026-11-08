import { esc, heading, card, btn } from '../../../components/ui.js';
import { isOnline } from '../../../services/repository.js';
import { resourceNotice } from '../../../services/resource-pages.js';
import { summaryTable } from '../../../features/assessment/summary-tables.js';
import { warningSection } from '../student-affairs/warnings.js';

export function semesterResults(ctx) {
    const headingHtml=heading('LAC HONG UNIVERSITY / ĐỐI CHIẾU','Tổng kết học kỳ & cảnh báo',
        'Lập bản tính theo quy chế, kiểm tra nguồn điểm, duyệt theo phiên bản; cảnh báo cần có quyết định.');
    if(!isOnline())return headingHtml+'<div class="notice"><p>Cần chạy backend để lập và duyệt tổng kết. Dữ liệu mô phỏng trên frontend không có giá trị quyết định học vụ.</p></div>';
    const people=ctx.db.students;
    const studentId=ctx.summaryStudentId;
    const termId=ctx.summarySemesterId;
    const terms=ctx.remoteSemesters?.state==='ready'?ctx.remoteSemesters.data:[];
    const personOptions=people.map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(studentId)?'selected':''}>${esc(s.code)} · ${esc(s.name)}</option>`).join('');
    const termOptions=terms.map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(termId)?'selected':''}>${esc(s.name)} · ${esc(s.startDate)} — ${esc(s.endDate)}</option>`).join('');
    const selector=`<section class="card pad"><div class="form-grid"><label>Chọn sinh viên<select data-filter="summaryStudentId"><option value="">Chọn sinh viên</option>${personOptions}</select></label><label>Chọn học kỳ<select data-filter="summarySemesterId"><option value="">Chọn học kỳ</option>${termOptions}</select></label></div><p class="muted">Chỉ dùng kết quả đã công bố. Điểm thiếu không được coi là 0; tín chỉ học lại không được cộng lần thứ hai.</p></section>`;
    const summary=ctx.remoteSummaries?.state==='ready'?summaryTable(ctx.remoteSummaries.data,'academic'):resourceNotice(ctx.remoteSummaries||{state:'loading'});
    let preview='<p class="muted">Chọn sinh viên và học kỳ ở trên để xem bản tính đối chiếu.</p>';
    if(studentId && termId){
        const p=ctx.remoteSummaryPreview;
        if(p?.state==='ready') {
            const v=p.data;
            preview=`<div class="notice"><p><strong>Bản tính đối chiếu${v.demo?' — minh họa':''}:</strong> ${esc(v.attemptedCredits)} tín chỉ đã học, ${esc(v.earnedCredits)} tín chỉ đạt trong kỳ; ${esc(v.cumulativeEarnedCredits)} tín chỉ tích lũy; GPA kỳ ${v.semesterGpa??'—'}, GPA tích lũy ${v.cumulativeGpa??'—'} theo ${esc(v.policyCode)}.</p></div>${btn('Lập bản tổng kết nháp','summary-draft','primary')}`;
        } else preview=resourceNotice(p||{state:'loading'});
    }
    const current=ctx.remoteSummaries?.state==='ready'?ctx.remoteSummaries.data.find(r=>r.isCurrent):null;
    return headingHtml+selector+card('Đối chiếu dữ liệu trước khi lập nháp','Phải có quy tắc GPA đã được cấu hình, không tự dùng quy chế chung của trường khác.',preview)+
        card('Các phiên bản tổng kết','Không xóa phiên bản cũ khi có bản mới. Sinh viên chỉ xem phiên bản đã duyệt hiện hành.',summary)+
        warningSection(ctx,current);
}
