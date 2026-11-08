import { esc, heading, card, table, btn, badge, empty } from '../../../components/ui.js';
import { isOnline } from '../../../services/repository.js';
import { resourceNotice } from '../../../services/resource-pages.js';
import { onlinePlan } from '../../../features/curriculum/progress-panel.js';

// The editor displays the same read model as the student's plan. No SQL or
// validation policy is duplicated in the browser.
export function curriculumEditor(ctx) {
    const programs = ctx.db.programs || [];
    const selected = ctx.curriculumId || ctx.filters.curriculumProgramId || programs[0]?.id || '';
    const selector = `<section class="card pad"><label>Chương trình đào tạo<select data-filter="curriculumProgramId">` +
        programs.map(program => `<option value="${esc(program.id)}" ${String(program.id) === String(selected) ? 'selected' : ''}>${esc(program.code)} · ${esc(program.name)}</option>`).join('') +
        '</select></label></section>';
    const title = heading('CÁN BỘ / CHƯƠNG TRÌNH', 'Học phần, nhóm tự chọn & tiên quyết',
        'Mỗi chương trình áp dụng theo ngành và khóa. Mọi thay đổi phải giữ được lịch sử kết quả đã công bố.');
    if (!isOnline()) return title + '<div class="notice">Cần kết nối backend để chỉnh sửa cấu trúc chương trình; không lưu dữ liệu mẫu như dữ liệu nhà trường.</div>';
    const remote = ctx.remoteCurriculumPlan;
    if (remote?.state !== 'ready') return title + selector + resourceNotice(remote || { state:'loading' });
    const data = remote.data;
    const { program, subjects, electiveGroups, prerequisites } = data;
    const canEdit = data.editable;
    const restricted = canEdit ? 'Thay đổi sẽ được kiểm tra quyền, phiên bản và lưu nhật ký.' :
        'Chương trình đã được sinh viên đăng ký học hoặc có tổng kết được duyệt. Muốn thay đổi cấu trúc, cần tạo phiên bản mới.';
    const versions = ctx.remoteCurriculumVersions;
    const versionRows = versions?.state === 'ready' ? versions.data.map(v => [
        `${esc(v.sourceCode)} → ${esc(v.targetCode)}`,
        v.status === 'approved' ? badge('passed', 'Đã duyệt') : badge('draft', 'Dự thảo'),
        esc(v.note), v.status === 'draft' ? btn('Duyệt phiên bản','curriculum-version-approve','small',`data-id="${esc(v.id)}"`) : '—'
    ]) : [];
    const versionPanel = card('Phiên bản chương trình',
        'Tạo bản sao có mã riêng; không sửa cấu trúc chương trình cũ đã phát sinh lịch sử. Không tự chuyển lớp/sinh viên sang phiên bản mới.',
        btn('Lập phiên bản mới','curriculum-version-form','primary') +
        (versions?.state !== 'ready' ? resourceNotice(versions || {state:'loading'}) :
            versionRows.length ? table(['PHIÊN BẢN','TRẠNG THÁI','LÝ DO','THAO TÁC'], versionRows) :
                empty('Chưa có phiên bản mới','Khi cần sửa chương trình đã có lịch sử, tạo phiên bản mới để giữ nguyên dữ liệu cũ.')));
    const matchingGroups = new Set((ctx.db.groups || []).filter(g =>
        String(g.programId) === String(selected)).map(g => String(g.id)));
    const eligibleStudents = (ctx.db.students || []).filter(st => matchingGroups.has(String(st.groupId)));
    const selectedStudent = ctx.filters.curriculumStudentId || '';
    const progressSelector = `<label>Đối chiếu tiến độ sinh viên<select data-filter="curriculumStudentId"><option value="">Chọn sinh viên</option>${eligibleStudents.map(st =>
        `<option value="${esc(st.id)}" ${String(st.id) === String(selectedStudent) ? 'selected' : ''}>${esc(st.code)} · ${esc(st.name)}</option>`).join('')}</select></label>`;
    const progressPanel = selectedStudent ?
        (ctx.remoteCurriculumProgress?.state === 'ready' ? onlinePlan(ctx.remoteCurriculumProgress.data) :
            resourceNotice(ctx.remoteCurriculumProgress || {state:'loading'})) :
        '<p class="muted">Chọn sinh viên thuộc chương trình này để xem số tín chỉ được công nhận và các nhóm tự chọn chưa đạt.</p>';
    const prerequisiteText = (subjectId) => prerequisites.filter(p => String(p.subjectId) === String(subjectId))
        .map(p => p.prerequisiteCode).join(', ') || '—';
    const subjectRows = subjects.map(s => [
        `<strong>${esc(s.name)}</strong><small>${esc(s.code)}</small>`,
        esc(s.credits), s.requirementType === 'required' ? 'Bắt buộc' : 'Tự chọn',
        esc(electiveGroups.find(g => String(g.id) === String(s.electiveGroupId))?.name || '—'),
        esc(s.recommendedSemester ?? '—'), esc(prerequisiteText(s.subjectId)),
        canEdit ? `<div class="row-actions">${btn('Sửa','curriculum-subject-form','small',`data-id="${esc(s.id)}"`)}${btn('Xóa','curriculum-subject-delete','small danger-text',`data-id="${esc(s.id)}"`)}</div>` : '—'
    ]);
    const groupRows = electiveGroups.map(g => [esc(g.code), esc(g.name), esc(g.minimumCredits),
        canEdit ? `<div class="row-actions">${btn('Sửa','curriculum-group-form','small',`data-id="${esc(g.id)}"`)}${btn('Xóa','curriculum-group-delete','small danger-text',`data-id="${esc(g.id)}"`)}</div>` : '—']);
    const prerequisiteRows = prerequisites.map(p => [esc(p.code), esc(p.prerequisiteCode),
        canEdit ? btn('Gỡ','curriculum-prerequisite-delete','small danger-text',
            `data-subject="${esc(p.subjectId)}" data-prerequisite="${esc(p.prerequisiteSubjectId)}"`) : '—']);
    return title + selector + versionPanel + `<div class="notice"><p><strong>${esc(program.name)} (${esc(program.code)})</strong> · ${esc(program.admissionYear)} · ${esc(program.requiredCredits)} tín chỉ mục tiêu. ${esc(restricted)}</p></div>` +
        card('Nhóm học phần tự chọn', 'Mỗi nhóm có định mức tín chỉ tối thiểu, riêng theo chương trình.',
            (canEdit ? btn('Thêm nhóm','curriculum-group-form','primary') : '') +
            (electiveGroups.length ? table(['MÃ','TÊN NHÓM','TỐI THIỂU','THAO TÁC'],groupRows) : empty('Chưa có nhóm tự chọn','Thêm nhóm trước khi gán học phần tự chọn.'))) +
        card('Danh mục học phần', 'Học phần bắt buộc, tự chọn, học kỳ gợi ý và mã môn tiên quyết.',
            (canEdit ? btn('Thêm học phần','curriculum-subject-form','primary') : '') +
            (subjects.length ? table(['HỌC PHẦN','TC','LOẠI','NHÓM','KỲ','TIÊN QUYẾT','THAO TÁC'], subjectRows) : empty('Chưa gán học phần','Chọn học phần từ danh mục và gắn vào chương trình.'))) +
        card('Quan hệ tiên quyết', 'Môn tiên quyết áp dụng ở cấp học phần toàn trường, không được tạo vòng phụ thuộc.',
            (canEdit ? btn('Thêm môn tiên quyết','curriculum-prerequisite-form','primary') : '') +
            (prerequisites.length ? table(['HỌC PHẦN','CẦN HOÀN THÀNH','THAO TÁC'],prerequisiteRows) : empty('Chưa có môn tiên quyết','Chỉ thêm khi có điều kiện đào tạo được phê duyệt.'))) +
        card('Đối chiếu tiến độ theo sinh viên', 'Chỉ cán bộ đào tạo được tra cứu; đây không phải quyết định xét tốt nghiệp.',
            progressSelector + progressPanel);
}
