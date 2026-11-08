import { read, isOnline, api, refresh } from '../../services/repository.js';
import { esc, icon, btn, modal, select, field, textarea, confirm, info, csv } from '../../components/ui.js';
import { filteredGrades } from '../../utils/view-model.js';

export function createActions(runtime) {
    const { context, checkAcademic, saveGrades, saved, state } = runtime;
    return {
        'save-grades': saveGrades,
        'publish-grades': async el => {
            checkAcademic();
            const classId = el.dataset.class;
            await saveGrades();
            const rows = read().grades.filter(g => g.classId === classId && !g.published);
            if (!rows.length) throw new Error('Không còn kết quả cần công bố.');
            if (rows.some(g => g.process === null || g.midterm === null || g.final === null)) throw new Error('Chưa đủ điểm để công bố. Hoàn thiện điểm thành phần và điểm thi trước.');
            if (!isOnline()) {
                info('Cần backend để công bố', '<p>Bản xem giao diện chỉ lưu điểm nháp. Chạy dự án full-stack để lưu kết quả và nguồn điểm.</p>');
                return;
            }
            confirm('Công bố kết quả học phần', `Công bố ${rows.length} kết quả theo quy chế gắn với chương trình. Kết quả khóa sửa trực tiếp, GPA chưa được tổng kết.`, async () => {
                const result = await api('/classes/' + classId + '/publish', { method: 'POST', body: {} });
                await refresh();
                await saved(`Đã công bố ${result.count} kết quả${result.demo ? ' theo quy chế minh họa' : ''}.`);
            });
        },
        'request-grade-change': el => {
            if (!isOnline()) throw new Error('Yêu cầu sửa điểm chỉ thực hiện khi kết nối backend.');
            const ctx = context(), row = ctx.remoteGradebook?.data?.items.find(g => g.id === el.dataset.id);
            if (!row?.published) throw new Error('Không tìm thấy kết quả đã công bố.');
            const sources = Object.entries(row.sources || {}).filter(([,v]) => v?.sourceId);
            if (!sources.length) throw new Error('Chưa có nguồn điểm hợp lệ để gửi đề nghị.');
            modal('Đề nghị sửa điểm đã công bố', `<p>SV: <strong>${esc(row.studentCode)} · ${esc(row.studentName)}</strong></p><div class="form-grid">${select('source', 'Đầu điểm cần sửa *', sources.map(([key,s]) => [key, s.assessment + ' · hiện tại ' + (row[key] ?? 'trống')]))}${field('score', 'Điểm đề nghị *', '', 'number', 'required min="0" step="0.01"')}${textarea('reason','Lý do và căn cứ *','', 'required minlength="10" maxlength="1000"')}</div><p class="muted">Điểm chỉ thay đổi sau khi cán bộ khác phê duyệt và hệ thống tính lại kết quả. Đề nghị không thay điểm ngay.</p>`, async d => {
                const source = row.sources[d.source];
                if (!source) throw new Error('Đầu điểm không còn hợp lệ.');
                await api('/grade-change-requests', {method:'POST', body:{ type:source.type, sourceId:source.sourceId, proposedScore:Number(d.score), reason:d.reason }});
                await refresh();
                await saved('Đã gửi đề nghị. Chờ cán bộ đào tạo xét duyệt.');
            });
        },
        'review-grade-change': async el => {
            checkAcademic();
            if (!isOnline()) throw new Error('Cần kết nối máy chủ để xét duyệt.');
            const ctx = context(), row = ctx.remoteGradeChanges?.data?.items.find(r => r.id === el.dataset.id);
            if (!row || row.status !== 'submitted') throw new Error('Đề nghị không còn chờ xử lý.');
            modal('Xét đề nghị sửa điểm', `<p><strong>${esc(row.studentName)} · ${esc(row.assessment)}</strong></p><p>Điểm hiện tại: ${row.oldScore} → đề nghị: <strong>${row.proposedScore}</strong></p><p>Lý do đề nghị: ${esc(row.reason)}</p><div class="form-grid">${select('decision','Quyết định *', [['reject','Từ chối'],['approve','Phê duyệt và áp dụng']])}${textarea('reason','Căn cứ quyết định *','', 'required minlength="10" maxlength="1000"')}</div><p class="muted">Phê duyệt sẽ tính lại kết quả từ quy chế đã dùng. Nếu đã có tổng kết học kỳ được duyệt, máy chủ sẽ chặn để tránh đổi GPA âm thầm.</p>`, async d => {
                await api('/grade-change-requests/' + row.id + '/review', {method:'POST', body: {decision:d.decision, reason:d.reason}});
                await refresh();
                await saved(d.decision === 'approve' ? 'Đã phê duyệt, cập nhật kết quả và ghi nhật ký.' : 'Đã từ chối và lưu căn cứ.');
            });
        },
        'export-grades': () => {
            const ctx = context(), classId = document.querySelector('#grades-form')?.dataset.class;
            const rows = ctx.remoteGradebook?.state === 'ready' ? ctx.remoteGradebook.data.items : filteredGrades(ctx, classId);
            csv('bang-diem', ['Mã sinh viên','Họ tên','Quá trình','Giữa kỳ','Cuối kỳ'], rows.map(g => {
                const student = ctx.db.students.find(s => s.id === g.studentId);
                return [student?.code || g.studentCode, student?.name || g.studentName, g.process, g.midterm, g.final];
            }));
        }
    };
}
