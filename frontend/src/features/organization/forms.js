import { read, upsert, uid } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import { hierarchyForm, bindHierarchyForm } from './dependent-selects.js';
const { field, select, modal } = ui;
export function createFormHandlers(runtime) {
    const { context, checkAcademic, options, log, saved, getUser, render, state } = runtime;
    async function orgForm(table, id) {
        checkAcademic();
        const db = read();
        const item = db[table].find(x => x.id === id) || {};
        const titles = { cohorts: 'khóa tuyển sinh', departments: 'khoa', majors: 'ngành',
            programs: 'chương trình', groups: 'lớp hành chính' };
        let fields = field('code', 'Mã *', item.code, 'text', 'required maxlength="50"') +
            field('name', 'Tên *', item.name, 'text', 'required maxlength="200"');
        if (table === 'cohorts')
            fields += field('year', 'Năm tuyển sinh *', item.year || 2027,
                'number', 'required min="1950" max="2100"');
        if (table === 'majors')
            fields += select('departmentId', 'Khoa quản lý *',
                await options('departments', 'Chọn khoa'), item.departmentId, 'required');
        if (table === 'programs')
            fields += await hierarchyForm('programs', db, item, options) +
                field('credits', 'Tín chỉ yêu cầu *', item.credits || 130,
                    'number', 'required min="1" max="300"');
        if (table === 'groups')
            fields += await hierarchyForm('groups', db, item, options) +
                select('advisor', 'Giảng viên cố vấn',
                    await options('lecturers', 'Chưa phân công'), item.advisor) +
                field('capacity','Sĩ số tối đa *',item.capacity ?? 50,'number','required min="1" max="1000" step="1"');
        modal(`${id ? 'Sửa' : 'Thêm'} ${titles[table]}`,
            `<div class="form-grid">${fields}</div><p class="helper muted">Mã phải duy nhất. ` +
            'Không thay quan hệ của bản ghi đã phát sinh dữ liệu.</p>', async (d) => {
                for (const key of Object.keys(d)) d[key] = d[key].trim();
                if (!d.code || !d.name) throw new Error('Mã và tên không được để trống.');
                // Khoa là trường lọc cho ngành, không phải cột độc lập của chương trình.
                if (table === 'programs' || table === 'groups') {
                    if (!d.departmentId || !d.majorId || !d.cohortId)
                        throw new Error('Vui lòng chọn đầy đủ khóa, khoa và ngành.');
                    if (table === 'groups' && !d.programId)
                        throw new Error('Vui lòng chọn chương trình đào tạo.');
                    delete d.departmentId;
                    if (table === 'groups') { delete d.majorId; delete d.cohortId; }
                }
                if (id) {
                    const relation = { majors: 'departmentId', programs: 'majorId',
                        groups: 'programId' }[table];
                    if (relation && item[relation] !== d[relation]) {
                        const used = table === 'majors' ? db.programs.some(p => p.majorId === id) :
                            table === 'programs' ? db.groups.some(g => g.programId === id) :
                                db.students.some(s => s.groupId === id);
                        if (used) throw new Error('Đã có dữ liệu liên quan. Không thể thay đổi quan hệ.');
                    }
                    if (table === 'programs' &&
                        db.groups.some(g => g.programId === id) && item.cohortId !== d.cohortId)
                        throw new Error('Chương trình đã có lớp, không thể đổi khóa.');
                }
                if (d.year) d.year = Number(d.year);
                if (d.credits) d.credits = Number(d.credits);
                if (d.capacity) d.capacity = Number(d.capacity);
                await upsert(table, { ...d, id: id || uid(table) });
                await log(id ? 'Sửa danh mục' : 'Thêm danh mục', d.code);
                await saved();
            });
        bindHierarchyForm(document.querySelector('#modal'), table, options);
    }
    return { orgForm };
}
