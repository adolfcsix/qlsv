import { heading,card } from '../../components/ui.js';
import { resultsPanel } from '../_shared.js';
import { isOnline } from '../../services/repository.js';
import { resourceNotice } from '../../services/resource-pages.js';
import { summaryTable,warningTable } from '../../features/assessment/summary-tables.js';
export function results(ctx) {
    const head=heading('KẾT QUẢ / HỌC TẬP','Kết quả học tập','Điểm đã công bố, tín chỉ được công nhận và tiến độ của bạn.');
    const details=resultsPanel(ctx,ctx.user.profileId);
    if(!isOnline())return head+details;
    const summaries=ctx.remoteSummaries?.state==='ready'?summaryTable(ctx.remoteSummaries.data,'student'):resourceNotice(ctx.remoteSummaries||{state:'loading'});
    const warnings=ctx.remoteWarnings?.state==='ready'?warningTable(ctx.remoteWarnings.data,'student'):resourceNotice(ctx.remoteWarnings||{state:'loading'});
    return head+details+card('Tổng kết học kỳ đã duyệt','Chỉ xem bản tổng kết hiện hành. Quy chế demo có nhãn minh họa.',summaries)+
        card('Quyết định cảnh báo học tập','Chỉ hiển thị cảnh báo đã duyệt và còn hiệu lực.',warnings);
}
