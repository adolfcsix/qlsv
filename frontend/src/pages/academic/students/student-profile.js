import { roles, statuses } from '../../../demo/data.js';
import { memberTabs } from '../../../app/navigation.js';
import { getContext, balance, summary } from '../../../services/repository.js';
import { esc, money, date, icon, badge, btn, link, person, empty, table, card, stat, heading } from '../../../components/ui.js';
import { profileTabs, classInfo, requestTable, feePanel, resultsPanel, examsPanel, details, timeline } from '../../_shared.js';
import { password } from '../../account/security.js';
export function profile(ctx) {
    const { db, user } = ctx, id = ctx.parts[2] || user.profileId, tab = ctx.parts[3] || (user.role === 'student' ? 'personal' : 'overview'), s = db.students.find(s => s.id === id);
    if (!s)
        return empty('Không tìm thấy hồ sơ', 'Hồ sơ có thể đã được thay đổi.');
    if (user.role === 'student' && id !== user.profileId)
        return empty('Bạn không có quyền xem hồ sơ này');
    if (user.role === 'lecturer' && getContext(db, s).group?.advisor !== user.profileId)
        return empty('Hồ sơ không thuộc lớp cố vấn');
    const tabs = user.role === 'student' ? memberTabs : profileTabs.filter(([k]) => user.role !== 'lecturer' || !['fees', 'requests', 'account'].includes(k));
    if (!tabs.some(([k]) => k === tab))
        return empty('Mục hồ sơ không thuộc quyền của bạn', 'Hãy chọn một mục được cấp quyền.');
    const c = getContext(db, s), sm = summary(db, id), canEdit = user.role === 'academic';
    let content = '';
    if (tab === 'overview')
        content = `<div class="stats three">${stat('Tín chỉ đã đạt', `${sm.credits}<em> / ${c.program?.credits}</em>`, 'Tiến độ học tập', 'cap')}${stat('GPA đã tổng kết', sm.gpa === null ? '—' : sm.gpa.toFixed(2), 'Theo bản tổng kết được duyệt', 'chart')}${user.role === 'lecturer' ? stat('Tín chỉ đang học', sm.current, 'Các lớp đã đăng ký', 'book') : stat('Học phí còn thiếu', money(balance(db, id).due), 'Theo lịch sử phiếu thu', 'wallet')}</div><div class="two-cols">${card('Thông tin đào tạo', 'Gắn với chương trình và lớp hành chính', details([['Lớp hành chính', c.group?.name], ['Ngành', c.major?.name], ['Khoa', c.department?.name], ['Chương trình', c.program?.name], ['Cố vấn', db.lecturers.find(l => l.id === c.group?.advisor)?.name || 'Chưa phân công'], ['Ngày nhập học', date(s.admissionDate)]]))}${card('Hoạt động gần đây', 'Lịch sử có căn cứ', timeline(db.history.filter(h => h.studentId === id)))}</div>`;
    if (tab === 'personal')
        content = card('Thông tin cá nhân', 'Thông tin hồ sơ tách biệt tài khoản đăng nhập', details([['Mã sinh viên', s.code], ['Họ và tên', s.name], ['Ngày sinh', date(s.dob)], ['Giới tính', s.gender], ['Email hồ sơ', s.email], ['Điện thoại', s.phone || 'Chưa cập nhật'], ['Địa chỉ', s.address], ['Ngày nhập học', date(s.admissionDate)]]), '');
    if (tab === 'contacts')
        content = card('Người liên hệ', 'Người thân và liên hệ khẩn cấp', table(['HỌ VÀ TÊN', 'QUAN HỆ', 'ĐIỆN THOẠI', 'ĐỊA CHỈ', ''], db.contacts.filter(x => x.studentId === id).map(x => [esc(x.name), esc(x.relationship), esc(x.phone), esc(x.address), x.emergency ? badge('active', 'Liên hệ khẩn cấp') : '—'])), canEdit ? btn(icon('plus') + ' Thêm liên hệ', 'new-contact', '', 'data-student="' + id + '"') : '');
    if (tab === 'attempts')
        content = card('Các lần học', 'Học lại và cải thiện tạo lần học mới, giữ lịch sử trước đó', table(['HỌC PHẦN / LẦN HỌC', 'LOẠI', 'HỌC KỲ', 'KẾT QUẢ'], [...db.results.filter(x => x.studentId === id).map(r => [`<strong>${esc(r.name)}</strong><small>${esc(r.code)} · Lần học trước</small>`, ({ first: 'Lần đầu', repeat: 'Học lại', improve: 'Cải thiện' }[r.type] || 'Đã công bố'), esc(r.semester), badge(r.status, `${r.score == null ? '—' : Number(r.score).toFixed(2)} · ${r.status === 'passed' ? 'Đã đạt' : 'Chưa đạt'}`)]), ...db.enrollments.filter(e => e.studentId === id).map(e => { const c = classInfo(db, db.classes.find(c => c.id === e.classId)); return [`<strong>${esc(c.subject?.name)}</strong><small>${esc(c.code)}</small>`, { first: 'Lần đầu', repeat: 'Học lại', improve: 'Cải thiện' }[e.type], esc(c.semester), badge(e.status)]; })]));
    if (tab === 'exams')
        content = examsPanel(ctx, id);
    if (tab === 'progress')
        content = resultsPanel(ctx, id);
    if (tab === 'fees')
        content = feePanel(ctx, id);
    if (tab === 'requests')
        content = card('Yêu cầu học vụ', 'Nội dung, phản hồi và kết quả xử lý', requestTable(ctx, id), user.role !== 'lecturer' ? btn(icon('plus') + ' Tạo yêu cầu', 'new-request', '', 'data-student="' + id + '"') : '');
    if (tab === 'history')
        content = card('Lịch sử & quyết định', 'Giữ căn cứ, người thực hiện và ngày hiệu lực', timeline(db.history.filter(h => h.studentId === id)), canEdit ? btn('Biến động học vụ', 'student-status', '', 'data-id="' + id + '"') : '');
    if (tab === 'account') {
        const a = db.accounts.find(a => a.role === 'student' && a.profileId === id);
        content = card('Tài khoản liên kết', 'Quản lý quyền truy cập riêng với hồ sơ học tập', a ? details([['Tên đăng nhập', a.code], ['Email đăng nhập', a.email], ['Vai trò', roles[a.role]], ['Trạng thái', statuses[a.status]], ['Mật khẩu', 'Không hiển thị']]) : empty('Chưa được cấp tài khoản', 'Quản trị sẽ cấp sau khi đối chiếu hồ sơ.')) + (user.role === 'student' ? password({ ...ctx, embedded: true }) : '');
    }
    return heading('SINH VIÊN / HỒ SƠ CHI TIẾT', user.role === 'student' ? 'Hồ sơ của tôi' : 'Hồ sơ sinh viên', user.role === 'student' ? 'Thông tin cá nhân, người liên hệ và bảo mật tài khoản.' : 'Hồ sơ đào tạo và lịch sử học vụ.', canEdit ? `${btn(icon('search') + ' Hỏi AI về hồ sơ', 'ask-student', '', 'data-id="' + id + '"')}${btn('Chỉnh thông tin', 'edit-student', 'primary', 'data-id="' + id + '"')}` : '') + `<div class="profile-hero"><div class="profile-person">${person(s, `${s.code} / ${c.group?.name}`)}<p>${esc(c.major?.name)} <span>·</span> ${esc(c.program?.name)}</p></div><div>${badge(s.status)}<small>Ngày nhập học ${date(s.admissionDate)}</small></div></div><nav class="tabs profile-tabs" aria-label="Các phần hồ sơ">${tabs.map(([key, label]) => link(label, `/${user.role}/profile/${id}/${key}`, key === tab ? 'active' : '')).join('')}</nav>${content}`;
}
