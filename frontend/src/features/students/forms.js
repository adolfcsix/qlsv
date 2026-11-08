import { prepareStudentPhoto, bindPhotoPreview } from './photo.js';
import { read, upsert, uid } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import { hierarchyForm, bindHierarchyForm } from '../organization/dependent-selects.js';
const { field, select, textarea, modal } = ui;
export function createFormHandlers(runtime) {
    const { context, checkAcademic, options, log, saved, getUser, render, state } = runtime;
    async function studentForm(id) {
        checkAcademic();
        const db = read();
        const student = db.students.find(x => x.id === id) || {};
        const groupFields = id ? '' : await hierarchyForm('students', db, student, options);
        modal(id ? 'Chỉnh thông tin sinh viên' : 'Thêm hồ sơ sinh viên',
            `<div class="form-grid">${id ? field('code', 'Mã sinh viên', student.code,
                'text', 'readonly') : field('code', 'Mã sinh viên *', '', 'text',
                'required pattern="[A-Za-z0-9_-]+" maxlength="30"')}` +
            field('name', 'Họ và tên *', student.name, 'text', 'required maxlength="200"') +
            field('dob', 'Ngày sinh *', student.dob, 'date', 'required') +
            select('gender', 'Giới tính', [['Nam', 'Nam'], ['Nữ', 'Nữ'], ['Khác', 'Khác']], student.gender) +
            groupFields + field('admissionDate', 'Ngày nhập học *',
                student.admissionDate || '2026-09-01', 'date', `required ${id ? 'readonly' : ''}`) +
            field('email', 'Email hồ sơ', student.email, 'email') +
            field('phone', 'Số điện thoại', student.phone, 'tel', 'pattern="[0-9+ .-]{8,20}"') +
            textarea('address', 'Địa chỉ liên hệ', student.address) +
            `<section class="photo-field full"><div><strong>Ảnh hồ sơ (không bắt buộc)</strong><p>Chỉ cán bộ được thêm, thay hoặc gỡ ảnh. Sinh viên chỉ xem ảnh trong hồ sơ.</p><label class="field"><span>Ảnh JPEG / PNG / WebP · tối đa 5 MB</span><input type="file" name="photoFile" accept="image/jpeg,image/png,image/webp"></label>${student.photoUrl ? '<label class="check-label"><input type="checkbox" name="removePhoto"> Gỡ ảnh hiện tại</label>' : ''}</div><img class="photo-preview" data-photo-preview ${student.photoUrl ? 'src="'+ui.esc(student.photoUrl)+'"' : 'hidden'} alt="Ảnh hồ sơ xem trước"></section>` +
            '</div><p class="muted helper">Khoa, ngành và khóa được xác định qua lớp hành chính. ' +
            'Thêm hồ sơ không tự cấp tài khoản hoặc tạo học phí.</p>', async data => {
                const file=data.photoFile; delete data.photoFile;
                const photoData=await prepareStudentPhoto(file);
                if(photoData!==undefined)data.photoData=photoData;
                else if(data.removePhoto==='on')data.photoData='';
                delete data.removePhoto;
                data.name = data.name.trim();
                if (!data.name) throw new Error('Vui lòng nhập họ và tên.');
                if (data.dob >= data.admissionDate)
                    throw new Error('Ngày sinh phải trước ngày nhập học.');
                if (!id && !data.groupId) throw new Error('Vui lòng chọn lớp hành chính.');
                // Các trường phân cấp phục vụ chọn lớp; bản ghi sinh viên chỉ lưu groupId.
                for (const key of ['cohortId', 'departmentId', 'majorId', 'programId']) delete data[key];
                await upsert('students', { ...student, ...data,
                    id: id || uid('s'), status: student.status || 'studying' });
                await log(id ? 'Sửa hồ sơ' : 'Thêm sinh viên', data.code);
                await saved();
            }, true);
        bindPhotoPreview(document.querySelector('#modal'));
        if (!id) bindHierarchyForm(document.querySelector('#modal'), 'students', options);
    }
    return { studentForm };
}
