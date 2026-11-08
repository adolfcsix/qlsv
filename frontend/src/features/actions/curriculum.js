import { api, isOnline } from '../../services/repository.js';
import { modal, confirm, field, select, textarea } from '../../components/ui.js';

// The server owns all domain validation, including prerequisite cycles and
// versioning rules. The UI only collects values and shows the server errors.
export function createActions({ context, checkAcademic, saved }) {
    async function current() {
        checkAcademic();
        if (!isOnline()) throw new Error('Kết nối backend trước khi sửa chương trình.');
        const ctx = context();
        const curriculumId = ctx.filters.curriculumProgramId || ctx.db.programs[0]?.id;
        if (!curriculumId) throw new Error('Chọn chương trình đào tạo.');
        const data = await api(`/curriculum-plan?curriculumId=${encodeURIComponent(curriculumId)}`);
        if (!data.editable) throw new Error('Chương trình đã có kết quả công bố; cần lập phiên bản mới để sửa.');
        return { ctx, data, curriculumId, revision: ctx.db.revision };
    }
    return {
        'curriculum-version-form': async () => {
            checkAcademic();
            if (!isOnline()) throw new Error('Cần kết nối backend để lập phiên bản.');
            const ctx = context();
            const sourceCurriculumId = ctx.filters.curriculumProgramId || ctx.db.programs[0]?.id;
            if (!sourceCurriculumId) throw new Error('Chọn chương trình nguồn trước.');
            const source = await api(`/curriculum-plan?curriculumId=${encodeURIComponent(sourceCurriculumId)}`);
            modal('Lập phiên bản chương trình',
                field('code','Mã phiên bản mới *',`${source.program.code}-V2`,'text','required maxlength="50"') +
                field('name','Tên phiên bản *',`${source.program.name} (bản điều chỉnh)`,'text','required maxlength="200"') +
                textarea('note','Lý do lập phiên bản *','','required maxlength="500"') +
                '<p class="muted">Học phần và nhóm tự chọn sẽ được sao chép. Lớp sinh viên vẫn giữ chương trình cũ.</p>',
                async values => {
                    await api('/curriculum-versions',{method:'POST',body:{revision:ctx.db.revision,
                        sourceCurriculumId,...values}});
                    await saved('Đã lập phiên bản chương trình dạng dự thảo.');
                });
        },
        'curriculum-version-approve': async el => {
            checkAcademic();
            if (!isOnline()) throw new Error('Cần kết nối máy chủ.');
            const revision = context().db.revision;
            confirm('Duyệt phiên bản chương trình',
                'Khi duyệt, cấu trúc phiên bản này sẽ bị khóa sửa trực tiếp. Dữ liệu sinh viên hiện tại không được chuyển tự động.',
                async () => {
                    await api(`/curriculum-versions/${el.dataset.id}/approve`,{method:'POST',body:{revision}});
                    await saved('Đã duyệt phiên bản; cấu trúc được khóa để bảo toàn lịch sử.');
                });
        },
        'curriculum-group-form': async el => {
            const { data, curriculumId, revision } = await current();
            const old = data.electiveGroups.find(g => String(g.id) === String(el.dataset.id));
            modal(old ? 'Sửa nhóm tự chọn' : 'Thêm nhóm tự chọn',
                field('code', 'Mã nhóm *', old?.code || '', 'text', 'required maxlength="255"') +
                field('name', 'Tên nhóm *', old?.name || '', 'text', 'required maxlength="255"') +
                field('minimumCredits', 'Số tín chỉ tối thiểu *', old?.minimumCredits || 3, 'number', 'required min="1" max="1000"'),
                async values => {
                    await api(`/elective-groups${old ? '/' + old.id : ''}`, {method: old ? 'PATCH' : 'POST',
                        body: {revision, curriculumId, ...values, minimumCredits: Number(values.minimumCredits)}});
                    await saved('Đã cập nhật nhóm tự chọn.');
                });
        },
        'curriculum-group-delete': async el => {
            const {data,revision} = await current();
            const row = data.electiveGroups.find(g => String(g.id) === String(el.dataset.id));
            if (!row) throw new Error('Nhóm tự chọn không còn tồn tại.');
            confirm('Xóa nhóm tự chọn', `Xóa nhóm ${row.code}? Không được xóa nhóm đang có học phần.`,
                async () => { await api(`/elective-groups/${row.id}`, {method:'DELETE',body:{revision}}); await saved(); });
        },
        'curriculum-subject-form': async el => {
            const { ctx, data, curriculumId, revision } = await current();
            const old = data.subjects.find(s => String(s.id) === String(el.dataset.id));
            const available = ctx.db.subjects.filter(s => s.status !== 'inactive' &&
                (old && String(s.id) === String(old.subjectId) || !data.subjects.some(a => String(a.subjectId) === String(s.id))));
            if (!old && !available.length) throw new Error('Không còn học phần chưa được gán.');
            const opts = available.map(s => [s.id, `${s.code} · ${s.name}`]);
            const groups = [['', 'Không chọn (học phần bắt buộc)'], ...data.electiveGroups.map(g => [g.id, g.name])];
            modal(old ? 'Sửa học phần trong chương trình' : 'Thêm học phần vào chương trình',
                select('subjectId','Học phần *',opts,old?.subjectId || available[0]?.id, old ? 'disabled' : 'required') +
                select('requirementType','Loại học phần *', [['required','Bắt buộc'],['elective','Tự chọn']],old?.requirementType || 'required','required') +
                select('electiveGroupId','Nhóm tự chọn (nếu có)',groups,old?.electiveGroupId || '') +
                field('recommendedSemester','Học kỳ gợi ý',old?.recommendedSemester ?? '','number','min="1" max="30"') +
                '<p class="muted">Chọn “Tự chọn” thì bắt buộc chọn nhóm. Học phần bắt buộc không có nhóm.</p>',
                async values => {
                    const requirementType = values.requirementType;
                    await api(`/curriculum-subjects${old ? '/' + old.id : ''}`, {
                        method: old ? 'PATCH' : 'POST', body:{revision, curriculumId,
                            ...values, subjectId: old?.subjectId || values.subjectId,
                            requirementType, electiveGroupId: requirementType === 'required' ? null : values.electiveGroupId,
                            recommendedSemester: values.recommendedSemester || null}
                    });
                    await saved('Đã cập nhật học phần trong chương trình.');
                });
        },
        'curriculum-subject-delete': async el => {
            const {data,revision} = await current();
            const row = data.subjects.find(s => String(s.id) === String(el.dataset.id));
            if (!row) throw new Error('Học phần không còn tồn tại.');
            confirm('Gỡ học phần khỏi chương trình', `Gỡ ${row.code} khỏi chương trình? Không xóa học phần trong danh mục toàn trường.`,
                async () => { await api(`/curriculum-subjects/${row.id}`, {method:'DELETE',body:{revision}}); await saved(); });
        },
        'curriculum-prerequisite-form': async () => {
            const {ctx,data,revision} = await current();
            if (!data.subjects.length) throw new Error('Cần gán học phần vào chương trình trước.');
            const choices = ctx.db.subjects.map(s => [s.id, `${s.code} · ${s.name}`]);
            modal('Thêm môn tiên quyết',
                select('subjectId','Học phần cần tiên quyết *',data.subjects.map(s => [s.subjectId,`${s.code} · ${s.name}`]),'','required') +
                select('prerequisiteSubjectId','Môn phải đạt trước *',choices,'','required') +
                '<p class="muted">Quan hệ tiên quyết được định nghĩa ở cấp môn học toàn trường. Hệ thống không cho phép tạo vòng phụ thuộc.</p>',
                async values => { await api('/subject-prerequisites', {method:'POST',body:{revision,...values}});
                    await saved('Đã thêm điều kiện tiên quyết.'); });
        },
        'curriculum-prerequisite-delete': async el => {
            const {revision} = await current();
            confirm('Gỡ điều kiện tiên quyết', 'Điều kiện này áp dụng cho học phần ở toàn trường. Bạn xác nhận gỡ?',
                async () => { await api('/subject-prerequisites', {method:'DELETE',body:{revision,
                    subjectId:el.dataset.subject, prerequisiteSubjectId:el.dataset.prerequisite}}); await saved(); });
        }
    };
}
