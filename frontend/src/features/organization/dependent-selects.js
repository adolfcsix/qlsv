import { select } from '../../components/form-controls.js';
import { esc } from '../../components/format.js';

// Chỉ biểu diễn quan hệ giữa các trường trên biểu mẫu. API quyết định danh sách hợp lệ.
const dependencies = Object.freeze({
    cohortId: [], departmentId: [], majorId: ['departmentId'],
    programId: ['cohortId', 'majorId'], groupId: ['programId']
});
const fields = Object.freeze({
    cohortId: ['cohorts', 'Khóa tuyển sinh'],
    departmentId: ['departments', 'Khoa'],
    majorId: ['majors', 'Ngành'],
    programId: ['programs', 'Chương trình đào tạo'],
    groupId: ['groups', 'Lớp hành chính']
});
export const hierarchyFields = Object.freeze({
    programs: ['cohortId', 'departmentId', 'majorId'],
    groups: ['cohortId', 'departmentId', 'majorId', 'programId'],
    students: ['cohortId', 'departmentId', 'majorId', 'programId', 'groupId']
});

export function initialHierarchy(db, kind, record = {}) {
    const group = kind === 'students' ? db.groups.find(g => String(g.id) === String(record.groupId)) : null;
    const programId = kind === 'groups' ? record.programId : kind === 'students' ? group?.programId : '';
    const program = kind === 'programs' ? record : db.programs.find(p => String(p.id) === String(programId));
    const major = db.majors.find(m => String(m.id) === String(program?.majorId));
    return {
        cohortId: String(program?.cohortId || ''),
        departmentId: String(major?.departmentId || record.departmentId || ''),
        majorId: String(program?.majorId || ''),
        programId: String(programId || ''),
        groupId: String(record.groupId || '')
    };
}

export function hierarchyParams(name, values) {
    const required = dependencies[name] || [];
    if (required.some(key => !values[key])) return null;
    if (name === 'majorId') return { departmentId: values.departmentId };
    if (name === 'programId') return { cohortId: values.cohortId, majorId: values.majorId };
    if (name === 'groupId') return { programId: values.programId };
    return {};
}

export async function hierarchyForm(kind, db, record, options) {
    const names = hierarchyFields[kind];
    if (!names) return '';
    const values = initialHierarchy(db, kind, record);
    const html = [];
    for (const name of names) {
        const [type, label] = fields[name];
        const params = hierarchyParams(name, values);
        const list = params === null ? [['', `Chọn ${label.toLocaleLowerCase('vi-VN')} trước`]] :
            await options(type, `Chọn ${label.toLocaleLowerCase('vi-VN')}`, params);
        html.push(select(name, `${label} *`, list, values[name],
            `required ${params === null ? 'disabled' : ''}`));
    }
    return html.join('');
}

// Chỉ làm mới con cháu bị ảnh hưởng; chọn khóa không tự xóa khoa đang chọn.
export function bindHierarchyForm(dialog, kind, options) {
    const names = hierarchyFields[kind];
    if (!names || !dialog) return;
    const elements = Object.fromEntries(names.map(name =>
        [name, dialog.querySelector(`select[name="${name}"]`)]));
    let generation = 0;
    const submit = dialog.querySelector('[type="submit"]');
    for (const name of names) {
        elements[name]?.addEventListener('change', async () => {
            const version = ++generation;
            if (submit) submit.disabled = true;
            const notice = dialog.querySelector('.form-error');
            if (notice) notice.hidden = true;
            const impacted = new Set([name]);
            for (const next of names) {
                if (!dependencies[next]?.some(parent => impacted.has(parent))) continue;
                impacted.add(next);
                const element = elements[next];
                element.value = '';
                element.disabled = true;
                element.innerHTML = '<option value="">Đang cập nhật lựa chọn…</option>';
            }
            for (const next of names) {
                if (next === name || !impacted.has(next)) continue;
                const element = elements[next];
                const values = Object.fromEntries(names.map(key => [key, elements[key]?.value || '']));
                const params = hierarchyParams(next, values);
                if (params === null) {
                    element.innerHTML = '<option value="">Vui lòng chọn mục phía trước</option>';
                    continue;
                }
                try {
                    const [type, label] = fields[next];
                    const list = await options(type, `Chọn ${label.toLocaleLowerCase('vi-VN')}`, params);
                    if (version !== generation || !dialog.open) return;
                    element.innerHTML = list.map(([value, title]) =>
                        `<option value="${esc(value)}">${esc(title)}</option>`).join('');
                    element.disabled = false;
                } catch (error) {
                    if (version !== generation || !dialog.open) return;
                    element.innerHTML = '<option value="">Không tải được danh mục</option>';
                    const message = dialog.querySelector('.form-error');
                    if (message) { message.textContent = error.message; message.hidden = false; }
                }
            }
            if (version === generation && dialog.open && submit) submit.disabled = false;
        });
    }
}
