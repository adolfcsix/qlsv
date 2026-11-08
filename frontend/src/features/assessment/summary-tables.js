// Thẻ hiển thị dùng chung cho cán bộ đào tạo và sinh viên.
import { esc, table, badge, btn } from '../../components/ui.js';

export function summaryTable(rows, role) {
    if (!rows.length) return '<p class="muted">Chưa có bản tổng kết phù hợp.</p>';
    return table(['HỌC KỲ / PHIÊN BẢN','TÍN CHỈ','GPA KỲ','GPA TÍCH LŨY','TRẠNG THÁI',''],rows.map(r=>[
        `<strong>${esc(r.semesterName)}</strong><small>Phiên bản ${esc(r.revision)} · ${esc(r.policyCode)}${r.demo?' · Minh họa':''}</small>`,
        `${esc(r.earnedCredits)} đạt / ${esc(r.attemptedCredits)} đã học<small>${esc(r.cumulativeEarnedCredits)} tín chỉ tích lũy</small>`,
        r.semesterGpa==null?'—':Number(r.semesterGpa).toFixed(2),
        r.cumulativeGpa==null?'—':Number(r.cumulativeGpa).toFixed(2),
        badge(r.status==='approved'?'published':'draft',r.status==='approved'?(r.isCurrent?'Hiện hành':'Đã thay thế'):'Bản nháp'),
        role==='academic'&&r.status==='draft' ? btn('Duyệt tổng kết','summary-approve','',`data-id="${esc(r.id)}"`) : '—'
    ]));
}

export function warningTable(rows,role) {
    if(!rows.length)return '<p class="muted">Chưa có cảnh báo học tập được ghi nhận.</p>';
    return table(['HỌC KỲ','CĂN CỨ','QUYẾT ĐỊNH','TRẠNG THÁI',''], rows.map(w=>[
        `<strong>${esc(w.semesterName)}</strong><small>Mức ${esc(w.level)} · ${esc(w.consecutiveCount)} kỳ liên tiếp</small>`,
        esc(w.reason),esc(w.decisionNumber||'Chưa cấp'),
        badge(w.status==='approved'?'published':'draft',({approved:'Đã duyệt',draft:'Chờ duyệt',revoked:'Đã thu hồi'})[w.status]||w.status),
        role==='academic' ? w.status==='draft' ? btn('Ra quyết định','warning-approve','',`data-id="${esc(w.id)}"`) :
            w.status==='approved' ? btn('Thu hồi','warning-revoke','',`data-id="${esc(w.id)}"`) : '—' : '—'
    ]));
}
