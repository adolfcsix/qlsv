import { esc, badge, table, card, stat } from '../../components/ui.js';

export function onlinePlan(progress) {
    const { program, subjects, electiveGroups } = progress;
    const rows = subjects.map(subject => [
        `<strong>${esc(subject.name)}</strong><small>${esc(subject.code)}</small>${subject.recognitionDecision ? `<small>Công nhận tương đương: ${esc(subject.recognitionDecision)}</small>` : ''}`,
        esc(subject.credits), subject.requirementType === 'required' ? 'Bắt buộc' : 'Tự chọn',
        esc(subject.recommendedSemester || '—'),
        badge(subject.learningStatus === 'passed' ? 'passed' : 'draft',
            {passed:'Đã đạt', failed:'Chưa đạt', in_progress:'Đang học', not_started:'Chưa học'}[subject.learningStatus]),
        subject.prerequisites.map(p => `${esc(p.code)}: ${p.passed ? 'Đã đạt' : 'Chưa đạt'}`).join(', ') || '—'
    ]);
    const groupRows = electiveGroups.map(g => [esc(g.name), esc(g.minimumCredits), esc(g.earnedCredits), esc(g.remainingCredits)]);
    const note = `<div class="notice"><p>${esc(progress.note)} ${progress.readyForManualReview ? 'Đủ điều kiện sơ bộ về các học phần đã cấu hình để đề nghị rà soát.' : 'Chưa đáp ứng tất cả điều kiện về học phần hoặc tín chỉ.'}</p>${progress.needsCreditReview ? '<p>Điểm công bố dùng số tín chỉ khác danh mục hiện hành. Cần cán bộ kiểm tra.</p>' : ''}${progress.unrecognizedSubjects.length ? `<p>Học phần ngoài chương trình chưa được công nhận tương đương: ${esc(progress.unrecognizedSubjects.join(', '))}.</p>` : ''}</div>`;
    return `<div class="notice"><p><strong>${esc(program.name)} (${esc(program.code)})</strong> · Ngành ${esc(program.majorName)} · Khóa ${esc(program.admissionYear)}.</p></div><div class="stats three">${stat('Đã công nhận', progress.earnedCredits + ' TC', 'Theo các lần học đã công bố', 'cap')}${stat('Yêu cầu chương trình', progress.requiredCredits + ' TC', 'Chưa tính điều kiện tốt nghiệp khác', 'book')}${stat('Tín chỉ còn thiếu', progress.remainingCredits + ' TC', 'Không bao gồm phần cần xác minh', 'layers')}</div>` + note +
        card('Nhóm môn tự chọn','Mỗi nhóm cần đạt số tín chỉ tối thiểu; không chỉ xét tổng tín chỉ toàn khóa.',
            electiveGroups.length ? table(['NHÓM','TỐI THIỂU','ĐÃ ĐẠT','CÒN THIẾU'], groupRows) : 'Chương trình chưa có nhóm tự chọn.') +
        card('Tiến độ từng học phần', 'Lần học cũ vẫn được giữ; không tính tín chỉ của một học phần hai lần.',
            subjects.length ? table(['HỌC PHẦN','TC','LOẠI','KỲ GỢI Ý','TIẾN ĐỘ','TIÊN QUYẾT'],rows) : empty('Chưa có học phần','Cán bộ đào tạo cần hoàn thiện danh mục chương trình.'));
}

