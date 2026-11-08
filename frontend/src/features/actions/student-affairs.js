import { api, isOnline } from '../../services/repository.js';
import { confirm, modal, field, textarea } from '../../components/ui.js';

export function createActions({context,checkAcademic,saved}) {
    function ready() {checkAcademic();if(!isOnline())throw new Error('Cần kết nối backend để xử lý hồ sơ học vụ.');}
    return {
        'summary-draft': async()=>{
            ready();const ctx=context();
            const studentId=ctx.filters.summaryStudentId||ctx.db.students[0]?.id;
            const semesterId=ctx.filters.summarySemesterId;
            if(!studentId||!semesterId)throw new Error('Chọn sinh viên và học kỳ trước khi lập tổng kết.');
            const response=await api('/semester-summaries',{method:'POST',body:{studentId,semesterId}});
            await saved(`Đã lập bản tổng kết nháp phiên bản ${response.revision}${response.demo?' (minh họa)':''}.`);
        },
        'summary-approve':el=>{
            ready();const id=el.dataset.id;
            confirm('Duyệt bản tổng kết học kỳ',
                'Hệ thống sẽ đối chiếu lại toàn bộ nguồn điểm và quy chế, giữ phiên bản cũ để truy vết. Bạn xác nhận duyệt?',
                async()=>{const r=await api(`/semester-summaries/${id}/approve`,{method:'POST',body:{}});
                    await saved(`Đã duyệt bản tổng kết${r.demo?' theo quy chế minh họa':''}.`);});
        },
        'warning-draft':async el=>{
            ready();await api('/academic-warnings',{method:'POST',body:{summaryId:el.dataset.summary}});
            await saved('Đã lập dự thảo cảnh báo. Cần kiểm tra và cấp số quyết định trước khi duyệt.');
        },
        'warning-approve':el=>{
            ready();const id=el.dataset.id;
            modal('Duyệt cảnh báo học tập',field('decisionNumber','Số quyết định *','','text','required minlength="3" maxlength="100"')+
                '<p class="muted">Đề nghị chỉ được công bố sau khi có số quyết định và người duyệt.</p>',
                async form=>{await api(`/academic-warnings/${id}/approve`,{method:'POST',body:{decisionNumber:form.decisionNumber}});
                    await saved('Đã duyệt cảnh báo và lưu nhật ký quyết định.');});
        },
        'warning-revoke':el=>{
            ready();const id=el.dataset.id;
            modal('Thu hồi quyết định cảnh báo',textarea('reason','Lý do thu hồi *','', 'required minlength="10" maxlength="1000"'),
                async form=>{await api(`/academic-warnings/${id}/revoke`,{method:'POST',body:{reason:form.reason}});
                    await saved('Đã thu hồi cảnh báo; lịch sử quyết định vẫn được lưu.');});
        }
    };
}
