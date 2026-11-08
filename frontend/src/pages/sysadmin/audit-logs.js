import { matches, pageSlice } from '../../utils/view-model.js';
import { heading } from '../../components/ui.js';
import { pagination, searchBar, auditTable } from '../_shared.js';
export function audits(ctx) { const rows = ctx.db.audit.filter(a => matches(`${a.actor} ${a.action} ${a.detail}`, ctx.filters.search)), pg = pageSlice(rows, ctx.filters, 12); return heading('QUẢN TRỊ / TRUY VẾT', 'Nhật ký thao tác', 'Thời gian, người thực hiện và căn cứ thay đổi.') + `<section class="card">${searchBar(ctx, 'Tìm người thực hiện hoặc thao tác')}${auditTable({ ...ctx, db: { ...ctx.db, audit: pg.rows } })}${pagination(pg, 'hoạt động')}</section>`; }
