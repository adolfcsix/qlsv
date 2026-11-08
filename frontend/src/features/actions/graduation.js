import { api, isOnline } from '../../services/repository.js';
import { modal, field, select, textarea, confirm } from '../../components/ui.js';

export function createActions({context,checkAcademic,saved}) {
    function current() {
        checkAcademic();
        if (!isOnline()) throw new Error('Cần kết nối backend để xét hồ sơ.');
        const ctx=context();
        const studentId=ctx.filters.graduationStudentId || ctx.db.students[0]?.id;
        if (!studentId) throw new Error('Chọn sinh viên trước.');
        return {studentId,revision:ctx.db.revision};
    }
    return {
        'recognition-create': async () => {
            const {studentId,revision}=current();
            const candidates=await api(`/credit-recognitions/candidates?studentId=${encodeURIComponent(studentId)}`);
            if (!candidates.sources.length || !candidates.targets.length)
                throw new Error('Chưa có kết quả đã đạt hoặc môn đích phù hợp để đối chiếu.');
            modal('Công nhận học phần tương đương',
                select('sourceResultId','Kết quả học phần nguồn *',candidates.sources.map(r=>[r.id,`${r.code} · ${r.name} (${r.credits} TC)`]),'','required') +
                select('targetAssignmentId','Học phần đích trong chương trình *',candidates.targets.map(r=>[r.id,`${r.code} · ${r.name} (${r.credits} TC)`]),'','required') +
                field('decisionNumber','Số quyết định *','','text','required maxlength="100"') +
                field('decisionDate','Ngày quyết định *',new Date().toISOString().slice(0,10),'date','required') +
                textarea('explanation','Căn cứ đối chiếu *','','required maxlength="500"') +
                '<p class="muted">Chỉ công nhận môn nguồn đã đạt và công bố. Quyết định không tự thay GPA.</p>',
                async form => {
                    await api('/credit-recognitions',{method:'POST',body:{...form,revision,studentId}});
                    await saved('Đã ghi nhận quyết định tương đương; lịch sử điểm gốc không thay đổi.');
                },true);
        },
        'recognition-revoke': el => {
            const {revision}=current();
            modal('Thu hồi công nhận tương đương',
                textarea('reason','Lý do thu hồi *','','required minlength="10" maxlength="500"'),
                async form => {
                    await api(`/credit-recognitions/${el.dataset.id}/revoke`,{
                        method:'POST',body:{revision,reason:form.reason}});
                    await saved('Đã thu hồi quyết định tương đương, giữ lịch sử tra cứu.');
                });
        },
        'graduation-review-create': () => {
            const {studentId,revision}=current();
            modal('Lập hồ sơ xét tốt nghiệp',
                textarea('note','Nội dung đối chiếu ban đầu *','','required maxlength="500"')+
                '<p class="muted">Đây là hồ sơ nháp, không phải quyết định công nhận tốt nghiệp.</p>',
                async form => {
                    await api('/graduation-reviews',{method:'POST',body:{studentId,revision,note:form.note}});
                    await saved('Đã lập hồ sơ nháp. Cần kiểm tra điều kiện khác và duyệt theo thẩm quyền.');
                });
        },
        'graduation-review-approve': el => {
            const {revision}=current();
            const checks=[['conduct','Rèn luyện'],['discipline','Kỷ luật'],
                ['certificates','Chứng chỉ'],['otherRequirements','Điều kiện bổ sung']];
            const checklist=checks.map(([key,label])=>`<label class="check-row"><input type="checkbox" name="${key}" required /> Đã đối chiếu: ${label}</label>`).join('');
            modal('Duyệt hồ sơ xét tốt nghiệp',checklist+
                field('decisionNumber','Số quyết định xét *','','text','required maxlength="100"')+
                textarea('evidence','Bằng chứng đối chiếu ngoài hệ thống *','','required maxlength="1000"')+
                textarea('note','Kết luận xét duyệt *','','required maxlength="1000"')+
                '<p class="muted">Chỉ duyệt khi đã có tổng kết học kỳ phê duyệt. Chưa tự động chuyển hồ sơ thành “đã tốt nghiệp”.</p>',
                async form => {
                    const externalChecks=Object.fromEntries(checks.map(([key])=>[key,form[key]==='on']));
                    await api(`/graduation-reviews/${el.dataset.id}/approve`,{method:'POST',
                        body:{revision,externalChecks,decisionNumber:form.decisionNumber,evidence:form.evidence,note:form.note}});
                    await saved('Đã duyệt hồ sơ xét và lưu quyết định; trạng thái tốt nghiệp chưa tự thay đổi.');
                },true);
        },
        'graduation-review-reject': el => {
            const {revision}=current();
            modal('Từ chối hồ sơ xét tốt nghiệp',
                textarea('note','Lý do từ chối *','','required maxlength="1000"'),
                async form=>{
                    await api(`/graduation-reviews/${el.dataset.id}/reject`,{method:'POST',
                        body:{revision,note:form.note}});
                    await saved('Đã từ chối hồ sơ với lý do và lịch sử xử lý.');
                });
        }
    };
}
