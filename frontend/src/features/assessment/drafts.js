import { transact, audit, api, refresh, isOnline } from '../../services/repository.js';
import { gradeMeta } from '../../utils/view-model.js';

export function createFormHandlers(runtime) {
    const { context, saved, state } = runtime;
    async function saveGrades() {
        const ctx = context(), form = document.querySelector('#grades-form');
        if (!form) return;
        const data = new FormData(form);
        if (isOnline()) {
            const displayed = ctx.remoteGradebook?.state === 'ready' &&
                String(ctx.remoteGradebook.data.classId) === String(form.dataset.class) ?
                ctx.remoteGradebook.data.items : null;
            if (!displayed) throw new Error('Sổ điểm chưa tải xong. Vui lòng tải lại trước khi nhập điểm.');
            const rows = displayed.filter(g => !g.published && data.has(g.id + '_process') && data.has(g.id + '_midterm')).map(g => ({
                enrollmentId: g.id,
                expected: (() => { const value = displayed.find(item => item.id === g.id); return value ? { process: value.process, midterm: value.midterm } : null; })(),
                scores: Object.fromEntries(['process','midterm'].map(key => {
                    const raw = data.get(g.id + '_' + key);
                    return [key, raw === '' ? null : Number(raw)];
                }))
            }));
            if (rows.length) await api('/classes/' + form.dataset.class + '/gradebook', {method:'POST', body:{rows}});
            await refresh();
        } else {
            await transact(db => {
                for (const g of db.grades.filter(g => g.classId === form.dataset.class)) {
                    if (g.published) continue;
                    for (const key of ['process','midterm']) {
                        const raw = data.get(g.id + '_' + key);
                        if (raw === null) continue;
                        const value = raw === '' ? null : Number(raw);
                        const max = gradeMeta(db, g.classId).find(a => a.key === key)?.max || 10;
                        if (value !== null && (!Number.isFinite(value) || value < 0 || value > max)) throw new Error('Điểm phải từ 0 đến ' + max + '.');
                        g[key] = value;
                    }
                }
                audit(db, ctx.user.name, 'Lưu điểm nháp', form.dataset.class);
            });
        }
        state.dirtyGrades = false;
        await saved('Đã lưu bản nháp. Chưa công bố kết quả.');
    }
    return { saveGrades };
}
