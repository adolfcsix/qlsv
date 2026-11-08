import { warningTable } from '../../../features/assessment/summary-tables.js';
import { btn, card } from '../../../components/ui.js';
import { resourceNotice } from '../../../services/resource-pages.js';

export function warningSection(ctx, selected) {
    const r=ctx.remoteWarnings;
    const content=r?.state==='ready' ? warningTable(r.data,ctx.user.role) : resourceNotice(r||{state:'loading'});
    const draft=ctx.user.role==='academic'&&selected ? btn('Lập dự thảo cảnh báo','warning-draft','',`data-summary="${selected.id}"`) : '';
    return card('Cảnh báo học tập','Không tự cảnh báo khi chưa có ngưỡng theo quy chế và bản tổng kết đã duyệt. '+
        'Quyết định chỉ có hiệu lực sau phê duyệt.', draft+content);
}
