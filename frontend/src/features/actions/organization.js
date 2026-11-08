import { remove } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
const { confirm } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'new-org': el => orgForm(el.dataset.table),
        'edit-org': el => orgForm(el.dataset.table, el.dataset.id),
        'delete-org': el => { checkAcademic(); confirm('Xóa danh mục', 'Chỉ có thể xóa bản ghi không còn dữ liệu liên quan. Tiếp tục?', async () => { await remove(el.dataset.table, el.dataset.id); log('Xóa danh mục', el.dataset.id); await saved(); }); }
    };
}
